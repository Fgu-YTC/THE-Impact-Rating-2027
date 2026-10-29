(async function () {
  const $ = (sel) => document.querySelector(sel);

  const [questionsData, methodologyZh, methodologyEn, priorYear] = await Promise.all([
    fetch("data/questions.json?v=20261029n").then((r) => r.json()),
    fetch("data/methodology-zh.json").then((r) => r.json()),
    fetch("data/methodology-en.json").then((r) => r.json()),
    fetch("data/prior-year.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
  ]);

  let units = [];
  let unitGroups = THEUI.DEFAULT_UNIT_GROUPS.slice();
  const questions = (questionsData.questions || []).filter((q) => q.fillable !== false);
  const metricsByRef = Object.fromEntries(
    (questionsData.metrics || []).map((m) => [String(m.ref), m])
  );
  const sdgs = questionsData.sdgs;

  let currentUnitId = "";
  let currentSdg = null;
  let activeQuestionId = null;
  let activeRef = null; // selected indicator/metric ref for methodology
  let activeMetricRef = null;
  let lang = THEUI.getLang();
  const pendingFiles = new Map();
  let remoteAnswers = {};
  let drafts = {};
  let unsubAnswers = function () {};
  let holdRender = false;
  let renderQueued = false;
  let returns = {};
  const returnOpen = new Set();

  const unitSelect = $("#unitSelect");
  const sdgTabs = $("#sdgTabs");
  const questionList = $("#questionList");
  const methodTitle = $("#methodTitle");
  const methodBody = $("#methodBody");
  const emptyState = $("#emptyState");

  function syncChromeLang() {
    const en = lang === "en";
    const unitLab = document.querySelector('label[for="unitSelect"]');
    if (unitLab) unitLab.textContent = en ? "Unit" : "填寫單位";
    const yearNote = $("#dataYearNote");
    if (yearNote) {
      yearNote.innerHTML = en
        ? "Data year: For Impact 2027, collect academic year <strong>113</strong> data. Use AY 113 for numbers; policies/measures must be in place by the end of that academic year. If a question’s methodology states otherwise, follow that question."
        : "資料年度：Impact 2027 請蒐集 <strong>113 學年度</strong>資料。數字題以 113 學年為準；政策／措施須於該學年度結束前已生效。若該題方法論另有註明，以該題為準。";
    }
    $("#submitHint").textContent = en
      ? "Submit on the right (enter filler’s name). You can edit and submit again later."
      : "改完按右邊提交（會問填寫人）。提交後仍可修改，再提交即可更新。";
    $("#btnSubmit").textContent = en ? "Submit" : "提交";
    $("#fillerTitle").textContent = en ? "Who filled this?" : "這次是誰填的？";
    $("#fillerNote").textContent = en
      ? "After submit, this unit and the admin page will see the name. For confirmation only."
      : "送出後，這個單位和管理頁都會看到填寫人。僅作確認使用。";
    $("#fillerName").placeholder = en ? "Filler name" : "填寫人姓名";
    $("#fillerCancel").textContent = en ? "Cancel" : "取消";
    $("#fillerSend").textContent = en ? "Send" : "送出";
    const tourBtn = $("#btnTour");
    if (tourBtn) tourBtn.textContent = en ? "Replay guide" : "重看提交教學";
    const askBtn = $("#methodAskBtn");
    if (askBtn) askBtn.textContent = en ? "Ask Gemini" : "問 Gemini";
    const askHint = $("#methodAskHint");
    if (askHint) {
      askHint.textContent = en
        ? "Not a premium model — please wait patiently."
        : "非高階模型，使用時請耐心等候。";
    }
  }

  let tourAutoShown = false;
  let tourActive = false;

  function findTourExampleUnit() {
    return (
      units.find((u) => u.name === "永續辦") ||
      units.find((u) => u.name === "永續發展辦公室") ||
      null
    );
  }

  /** 教學示範：強制切到永續辦並帶出題目；成功回 true */
  function prepareTourExample() {
    const office = findTourExampleUnit();
    if (!office) return false;
    const keepQ = activeQuestionId;
    const needSwitch = currentUnitId !== office.id;
    currentUnitId = office.id;
    if (!unitSelect.querySelector(`option[value="${office.id}"]`)) {
      renderUnitOptions();
    }
    unitSelect.value = office.id;
    if (needSwitch) {
      activeQuestionId = null;
      activeRef = null;
      activeMetricRef = null;
      watchUnit(office.id);
    }
    const assigned = assignmentsForUnit(office.id);
    if (!currentSdg || !assigned.some((q) => q.sdg === currentSdg)) {
      currentSdg = assigned.length ? assigned[0].sdg : null;
    }
    renderTabs();
    renderQuestions();
    const prefer =
      (keepQ && assigned.find((q) => q.id === keepQ)) ||
      assigned.find((q) => q.sdg === currentSdg) ||
      assigned[0];
    if (prefer) selectQuestion(prefer);
    else renderMethod();
    return assigned.length > 0;
  }

  /** 教學結束：回到未選單位的初始畫面 */
  function restoreTourSelection() {
    tourActive = false;
    currentUnitId = "";
    unitSelect.value = "";
    currentSdg = null;
    activeQuestionId = null;
    activeRef = null;
    activeMetricRef = null;
    watchUnit("");
    renderTabs();
    renderQuestions();
    renderMethod();
  }

  const tour = THETour.bind({
    getLang: () => lang,
    prepareExample: () => {
      tourActive = true;
      return new Promise((resolve) => {
        let tries = 0;
        const tick = () => {
          if (prepareTourExample()) {
            resolve(true);
            return;
          }
          tries += 1;
          if (tries >= 40) {
            resolve(false);
            return;
          }
          setTimeout(tick, 200);
        };
        tick();
      });
    },
    restoreSelection: restoreTourSelection,
  });

  THEUI.bindLangToggle($("#langToggle"), (next) => {
    lang = next;
    syncChromeLang();
    renderUnitOptions();
    renderQuestions();
    renderMethod();
    if (tour && tour.syncLang) tour.syncLang();
  });

  function renderUnitOptions() {
    THEUI.fillGroupedUnitSelect(unitSelect, units, {
      groupOrder: unitGroups,
      lang,
      selectedId: currentUnitId,
      placeholder: lang === "en" ? "Select a unit…" : "選擇單位…",
    });
  }

  function assignmentsForUnit(unitId) {
    const unit = units.find((u) => u.id === unitId);
    const ids = new Set(unit?.questionIds || []);
    return questions.filter((q) => ids.has(q.id));
  }

  function sdgsForUnit(unitId) {
    const set = new Set(assignmentsForUnit(unitId).map((q) => q.sdg));
    return [...set].sort((a, b) => a - b);
  }

  function showSdgOverview(n) {
    currentSdg = n;
    activeQuestionId = null;
    activeRef = null;
    activeMetricRef = null;
    renderTabs();
    renderQuestions();
    // 點 SDG 或問號：右側顯示該篇完整方法論
    renderMethod();
    const pane = document.querySelector(".pane-right");
    if (pane && typeof pane.scrollIntoView === "function") {
      pane.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function renderTabs() {
    sdgTabs.innerHTML = "";
    if (!currentUnitId) {
      updateUnitProgressLabel();
      return;
    }
    const list = sdgsForUnit(currentUnitId);
    if (!list.length) {
      currentSdg = null;
      updateUnitProgressLabel();
      return;
    }
    if (!currentSdg || !list.includes(currentSdg)) currentSdg = list[0];
    list.forEach((n) => {
      const { filled, total } = unitProgress(currentUnitId, n);
      const chip = document.createElement("div");
      chip.className = "sdg-chip has-items" + (n === currentSdg ? " active" : "");
      if (total > 0 && filled === total) chip.classList.add("done");
      else if (filled > 0) chip.classList.add("partial");

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sdg-tab";
      const name = document.createElement("span");
      name.className = "sdg-name";
      name.textContent = `SDG${n}`;
      const prog = document.createElement("span");
      prog.className = "sdg-prog";
      prog.textContent = `${filled}/${total}`;
      prog.title =
        lang === "en" ? `${filled} of ${total} filled` : `已填 ${filled}／共 ${total}`;
      btn.appendChild(name);
      btn.appendChild(prog);
      btn.addEventListener("click", () => showSdgOverview(n));

      const help = document.createElement("button");
      help.type = "button";
      help.className = "field-help sdg-help";
      help.textContent = "?";
      help.title = lang === "en" ? `What is SDG${n} about?` : `SDG${n} 在說什麼？`;
      help.setAttribute("aria-label", help.title);
      help.addEventListener("click", (e) => {
        e.stopPropagation();
        showSdgOverview(n);
      });

      chip.appendChild(btn);
      chip.appendChild(help);
      sdgTabs.appendChild(chip);
    });
    updateUnitProgressLabel();
  }

  function selectQuestion(q) {
    const same = activeQuestionId === q.id;
    activeQuestionId = q.id;
    activeRef = q.ref || null;
    activeMetricRef = q.metricRef || null;
    if (same) {
      renderMethod();
      return;
    }
    renderQuestions();
    renderMethod();
  }

  function selectMetric(metric) {
    activeQuestionId = null;
    activeRef = metric.ref || null;
    activeMetricRef = metric.ref || null;
    renderQuestions();
    renderMethod();
  }

  function renderMethod() {
    const askForm = $("#methodAsk");
    if (!currentUnitId) {
      THEMethod.render(methodTitle, methodBody, {
        title: lang === "en" ? "Methodology" : "方法論",
        html: `<p class="method-p method-empty">${
          lang === "en" ? "Select a unit first." : "請先選擇填寫單位。"
        }</p>`,
      });
      if (askForm) askForm.hidden = true;
      return;
    }
    const resolved = THEMethod.resolve({
      lang,
      methodologyZh,
      methodologyEn,
      sdg: currentSdg,
      ref: activeRef,
      metricRef: activeMetricRef,
    });
    THEMethod.render(methodTitle, methodBody, resolved);
    const q = questions.find((item) => item.id === activeQuestionId);
    const label = (item) => (lang === "en" ? item.en : item.zh);
    window.THEAskQuestion = {
      ref: (q && q.ref) || activeRef || "",
      sdg: (q && q.sdg) || currentSdg || "",
      title: q ? label(q) : resolved.title || "",
      answerType: (q && q.answerType) || "",
      options: ((q && q.options) || []).map(label).filter(Boolean),
    };
    if (askForm) askForm.hidden = !(q || currentSdg);
  }

  function showQuestionMethodology(q) {
    selectQuestion(q);
    const pane = document.querySelector(".pane-right");
    if (pane && typeof pane.scrollIntoView === "function") {
      pane.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function getAnswer(qid) {
    return { ...(remoteAnswers[qid] || {}), ...(drafts[qid] || {}) };
  }

  function saveAnswer(qid, patch) {
    drafts[qid] = { ...(drafts[qid] || {}), ...patch };
    renderTabs();
    updateUnitProgressLabel();
  }

  function answerHasContent(answer) {
    if (!answer) return false;
    if (answer.yesNo || answer.public || answer.comment) return true;
    if (String(answer.evidence || "").trim() || answer.evidenceFileName || answer.evidenceFileUrl) return true;
    if (answer.options && answer.options.length) return true;
    return Object.values(answer.values || {}).some((value) => value != null && String(value) !== "");
  }

  function questionLooksFilled(qid) {
    return answerHasContent(getAnswer(qid)) || pendingFiles.has(qid);
  }

  function unitProgress(unitId, sdg) {
    const mine = assignmentsForUnit(unitId).filter((q) => sdg == null || q.sdg === sdg);
    const filled = mine.filter((q) => questionLooksFilled(q.id)).length;
    return { filled, total: mine.length };
  }

  function updateUnitProgressLabel() {
    const el = $("#unitProgress");
    if (!el) return;
    if (!currentUnitId) {
      el.textContent = "";
      el.hidden = true;
      return;
    }
    const { filled, total } = unitProgress(currentUnitId);
    el.hidden = !total;
    el.textContent =
      lang === "en" ? `Filled ${filled}/${total}` : `已填 ${filled}/${total}`;
    el.title =
      lang === "en"
        ? `${filled} of ${total} assigned questions filled`
        : `已填 ${filled} 題，共分派 ${total} 題`;
  }

  function requestRender() {
    if (holdRender) renderQueued = true;
    else renderQuestions();
  }

  /** 退回開關等必須立刻重繪，不能被輸入框 focus 的 holdRender 卡住 */
  function forceRender() {
    holdRender = false;
    renderQueued = false;
    renderQuestions();
  }

  function renderQuestions() {
    questionList.innerHTML = "";
    if (!currentUnitId) {
      emptyState.hidden = false;
      emptyState.textContent = lang === "en" ? "Select a unit first." : "請先選擇填寫單位。";
      return;
    }
    const assigned = assignmentsForUnit(currentUnitId);
    if (!assigned.length) {
      emptyState.hidden = false;
      emptyState.textContent =
        lang === "en"
          ? "This unit has no assigned questions yet."
          : "此單位尚未被分派任何題目。請到管理頁勾選題目後按「分派給此單位」。";
      return;
    }
    const mine = assigned.filter((q) => q.sdg === currentSdg);
    if (!mine.length) {
      emptyState.hidden = false;
      const sdgs = sdgsForUnit(currentUnitId).join(", ");
      emptyState.textContent =
        lang === "en"
          ? `No questions for this SDG. Assigned SDGs: ${sdgs || "—"}.`
          : `此單位尚未被分派此 SDG 題目。目前有分派的 SDG：${sdgs || "—"}。`;
      return;
    }
    emptyState.hidden = true;

    const byMetric = new Map();
    mine.forEach((q) => {
      const key = THEUI.parentRef(q) || "_";
      if (!byMetric.has(key)) byMetric.set(key, []);
      byMetric.get(key).push(q);
    });
    const metricKeys = [...byMetric.keys()].sort((a, b) =>
      String(a).localeCompare(String(b), undefined, { numeric: true })
    );

    metricKeys.forEach((metricKey) => {
      const group = byMetric.get(metricKey).sort((a, b) =>
        String(a.ref).localeCompare(String(b.ref), undefined, { numeric: true })
      );
      const first = group[0];
      const metric = metricsByRef[metricKey] || {
        ref: first.metricRef,
        en: first.metricEn,
        zh: first.metricZh,
      };
      const zhNote = THEMethod.metricBlurb(
        (methodologyZh.byRef || {})[metricKey],
        metricKey
      );
      const enNote = THEMethod.metricBlurb(
        (methodologyEn.byRef || {})[metricKey],
        metricKey
      );
      const note = lang === "en" ? enNote || zhNote : zhNote || enNote;
      const clickable = Boolean(note);

      const block = document.createElement("div");
      block.className = "metric-block";
      const header = THEUI.renderMetricHeader(metric, lang, {
        note,
        clickable,
        selected: clickable && activeRef === (metric.ref || metricKey) && !activeQuestionId,
      });
      if (clickable) {
        header.addEventListener("click", (e) => {
          if (THEUI.isTextSelecting(e)) return;
          selectMetric(metric);
        });
      }
      block.appendChild(header);
      const listWrap = document.createElement("div");
      listWrap.className = "metric-indicators";
      block.appendChild(listWrap);
      questionList.appendChild(block);
      const host = listWrap;

      group.forEach((q) => {
        const card = document.createElement("article");
        card.className = "q-card" + (activeQuestionId === q.id ? " selected" : "");
        card.dataset.id = q.id;
        card.addEventListener("click", (e) => {
          if (e.target.closest("input, select, textarea, label, button, a")) return;
          if (THEUI.isTextSelecting(e)) return;
          selectQuestion(q);
        });
        // 點進輸入欄也同步右側方法論（勿在選取文字時重繪）
        card.addEventListener("focusin", () => {
          if (THEUI.isTextSelecting()) return;
          if (activeQuestionId !== q.id) selectQuestion(q);
        });

        const ans = getAnswer(q.id);
        const meta = document.createElement("div");
        meta.className = "q-meta";
        const ref = document.createElement("span");
        ref.className = "q-ref ref-indicator";
        ref.textContent = q.ref || q.id;
        meta.appendChild(ref);
        if (ans.filledBy) {
          const who = document.createElement("span");
          who.className = "filled-by";
          who.textContent = lang === "en" ? `Filler: ${ans.filledBy}` : `填寫人：${ans.filledBy}`;
          meta.appendChild(who);
        }
        const methodBtn = document.createElement("button");
        methodBtn.type = "button";
        methodBtn.className = "secondary q-method-btn";
        methodBtn.textContent = lang === "en" ? "View THE methodology" : "看 THE 方法論";
        methodBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          showQuestionMethodology(q);
        });
        meta.appendChild(methodBtn);

        const returnBtn = document.createElement("button");
        returnBtn.type = "button";
        returnBtn.className =
          "secondary q-return-btn" + (returns[q.id] ? " is-returned" : "");
        returnBtn.textContent = returns[q.id]
          ? lang === "en"
            ? "Returned"
            : "已退回"
          : lang === "en"
            ? "Return"
            : "退回";
        returnBtn.title = lang === "en"
          ? "Cannot answer — open return form"
          : "本單位無法回答時，按此填寫退回建議";
        returnBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (returnOpen.has(q.id)) returnOpen.delete(q.id);
          else returnOpen.add(q.id);
          forceRender();
        });
        meta.appendChild(returnBtn);
        card.appendChild(meta);

        const returning = returnOpen.has(q.id);
        if (returning) {
          card.classList.add("q-card-returning");
          card.appendChild(
            THEUI.renderReturnEditor({
              ret: returns[q.id] || null,
              lang,
              onReturn: async (suggestion) => {
                await THELive.saveReturn(currentUnitId, q.id, suggestion);
                // 退回後自本單位取消分派，供管理頁重新分配
                await THELive.unassignQuestions(currentUnitId, [q.id]);
                returnOpen.delete(q.id);
                forceRender();
              },
              onClear: async () => {
                await THELive.clearReturn(currentUnitId, q.id);
                returnOpen.delete(q.id);
                forceRender();
              },
              onClose: () => {
                returnOpen.delete(q.id);
                forceRender();
              },
            })
          );
        } else {
          card.appendChild(THEUI.renderQuestionCopy(q, lang));
          const fields = document.createElement("div");
          fields.className = "fields";
          const pending = pendingFiles.get(q.id);
          THEUI.appendAnswerFields(fields, q, {
            lang,
            getAnswer: () => getAnswer(q.id),
            pendingName: pending ? pending.name : "",
            resolveFileUrl: (answer) =>
              window.THESubmit && THESubmit.fileUrl ? THESubmit.fileUrl(answer) : Promise.resolve(""),
            onPatch: (partial) => saveAnswer(q.id, partial),
            onFile: (file) => {
              if (file) pendingFiles.set(q.id, file);
              else pendingFiles.delete(q.id);
            },
          });
          card.appendChild(
            THEUI.renderFillCompare({
              lang,
              prior: THEUI.renderPriorYear(priorYear[q.ref], q),
              fields,
            })
          );
        }
        host.appendChild(card);
      });
    });
  }

  questionList.addEventListener("focusin", () => {
    holdRender = true;
  });
  questionList.addEventListener("focusout", (e) => {
    if (questionList.contains(e.relatedTarget)) return;
    holdRender = false;
    if (renderQueued) {
      renderQueued = false;
      renderQuestions();
    }
  });

  function watchUnit(unitId) {
    unsubAnswers();
    remoteAnswers = {};
    returns = {};
    drafts = {};
    pendingFiles.clear();
    if (!unitId) return;
    const stops = [];
    stops.push(
      THELive.listenUnitAnswers(
        unitId,
        (map) => {
          if (unitId !== currentUnitId) return;
          remoteAnswers = map || {};
          requestRender();
        },
        (err) => showSubmitBanner("bad", `讀取填答失敗。${THELive.explain(err)}`)
      )
    );
    stops.push(
      THELive.listenUnitReturns(
        unitId,
        (map) => {
          if (unitId !== currentUnitId) return;
          returns = map || {};
          requestRender();
        },
        (err) => showSubmitBanner("bad", `讀取退回失敗。${THELive.explain(err)}`)
      )
    );
    unsubAnswers = function () {
      stops.forEach((stop) => stop());
    };
  }

  unitSelect.addEventListener("change", () => {
    currentUnitId = unitSelect.value;
    currentSdg = null;
    activeQuestionId = null;
    activeRef = null;
    activeMetricRef = null;
    watchUnit(currentUnitId);
    renderTabs();
    // renderTabs 會把 currentSdg 設成此單位第一個有分派的 SDG
    renderQuestions();
    const first = assignmentsForUnit(currentUnitId).find((q) => q.sdg === currentSdg);
    if (first) selectQuestion(first);
    else renderMethod();
  });

  let ensuredGroups = false;
  THELive.listenUnitGroups(
    (groups) => {
      unitGroups = groups && groups.length ? groups : THEUI.DEFAULT_UNIT_GROUPS.slice();
      renderUnitOptions();
    },
    () => {}
  );
  THELive.listenUnits(
    (next) => {
      units = next || [];
      if (!ensuredGroups) {
        ensuredGroups = true;
        THELive.ensureUnitGroups(units)
          .then((groups) => {
            if (groups && groups.length) unitGroups = groups;
            renderUnitOptions();
          })
          .catch(() => {});
      }
      renderUnitOptions();
      if (tourActive) {
        // 教學中單位清單更新時，維持永續辦示範，避免又變空白
        prepareTourExample();
        return;
      }
      if (currentUnitId && !units.some((u) => u.id === currentUnitId)) {
        currentUnitId = "";
        unitSelect.value = "";
        watchUnit("");
      }
      renderTabs();
      requestRender();
      if (currentUnitId) {
        const first = assignmentsForUnit(currentUnitId).find((q) => q.sdg === currentSdg);
        if (!activeQuestionId && first) selectQuestion(first);
      }
      renderMethod();
      if (
        !tourAutoShown &&
        tour &&
        !THETour.seen() &&
        findTourExampleUnit()
      ) {
        tourAutoShown = true;
        setTimeout(() => tour.show(), 350);
      }
    },
    (err) => showSubmitBanner("bad", `讀取單位失敗。${THELive.explain(err)}`)
  );


  function showSubmitBanner(kind, text) {
    const banner = $("#submitBanner");
    banner.hidden = false;
    banner.className = `submit-banner ${kind}`;
    banner.textContent = text;
  }

  function askFillerName() {
    const dialog = $("#fillerDialog");
    const form = $("#fillerForm");
    const input = $("#fillerName");
    dialog.hidden = false;
    input.value = "";
    input.focus();
    return new Promise((resolve) => {
      const finish = (name) => {
        dialog.hidden = true;
        form.removeEventListener("submit", onSubmit);
        $("#fillerCancel").removeEventListener("click", onCancel);
        resolve(name);
      };
      const onSubmit = (event) => {
        event.preventDefault();
        const name = input.value.trim().slice(0, 40);
        if (!name) return;
        finish(name);
      };
      const onCancel = () => finish("");
      form.addEventListener("submit", onSubmit);
      $("#fillerCancel").addEventListener("click", onCancel);
    });
  }

  $("#btnSubmit").addEventListener("click", async () => {
    const en = lang === "en";
    if (!currentUnitId) {
      showSubmitBanner("bad", en ? "Not submitted. Choose a unit first, then submit." : "還沒提交。請先選擇填寫單位，再按提交。");
      return;
    }
    const unit = units.find((u) => u.id === currentUnitId);
    const ids = Object.keys(drafts).filter(
      (id) => pendingFiles.has(id) || answerHasContent(getAnswer(id))
    );
    if (!ids.length) {
      showSubmitBanner(
        "warn",
        en
          ? `No new answers for “${unit.name}”. Only changed questions are sent; saved answers stay.`
          : `「${unit.name}」這次沒有新的填答。改過的題目才會送出，已在系統裡的答案會保留。`
      );
      return;
    }
    const filledBy = await askFillerName();
    if (!filledBy) return;
    const btn = $("#btnSubmit");
    const label = en ? "Submit" : "提交";
    btn.disabled = true;
    btn.textContent = en ? "Submitting…" : "提交中…";
    showSubmitBanner(
      "busy",
      en
        ? `Sending ${ids.length} question(s) for “${unit.name}”. Please keep this page open.`
        : `正在把「${unit.name}」的 ${ids.length} 題送到系統，請先不要關閉頁面。`
    );
    try {
      await THESubmit.submitChanged({
        unitId: currentUnitId,
        entries: ids.map((questionId) => ({ questionId, answer: { ...getAnswer(questionId), filledBy } })),
        files: pendingFiles,
        questions,
      });
      ids.forEach((id) => {
        delete drafts[id];
        pendingFiles.delete(id);
      });
      const when = new Date().toLocaleString(en ? "en-US" : "zh-TW", { hour12: false });
      showSubmitBanner(
        "ok",
        en
          ? `Submitted. “${unit.name}”: ${ids.length} question(s) updated. Filler: ${filledBy}. ${when}.`
          : `提交成功。「${unit.name}」的 ${ids.length} 題已更新，填寫人是${filledBy}。時間 ${when}。`
      );
      renderQuestions();
    } catch (err) {
      showSubmitBanner(
        "bad",
        en
          ? `Submit failed. Changes were not saved.${err && err.message ? " " + err.message : " Please try again."}`
          : `提交失敗，這次改的題目還沒送到系統。${err && err.message ? err.message : "請再試一次。"}`
      );
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  });

  syncChromeLang();
  emptyState.hidden = false;
  emptyState.textContent = "請先選擇填寫單位。";
  methodTitle.textContent = "方法論";
  methodBody.textContent = "選擇單位與 SDG 後顯示對應方法論。";
})();
