(async function () {
  const $ = (sel) => document.querySelector(sel);

  const [questionsData, methodologyZh, methodologyEn, priorYear] = await Promise.all([
    fetch("data/questions.json").then((r) => r.json()),
    fetch("data/methodology-zh.json").then((r) => r.json()),
    fetch("data/methodology-en.json").then((r) => r.json()),
    fetch("data/prior-year.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
  ]);

  let units = [];
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
      ? "When finished, use Submit on the right. You will be asked for the filler’s name."
      : "改完後按右邊送出。送出前會詢問填寫人。";
    $("#btnSubmit").textContent = en ? "Submit" : "提交";
    $("#fillerTitle").textContent = en ? "Who filled this?" : "這次是誰填的？";
    $("#fillerNote").textContent = en
      ? "After submit, this unit and the admin page will see the name. For confirmation only."
      : "送出後，這個單位和管理頁都會看到填寫人。僅作確認使用。";
    $("#fillerName").placeholder = en ? "Filler name" : "填寫人姓名";
    $("#fillerCancel").textContent = en ? "Cancel" : "取消";
    $("#fillerSend").textContent = en ? "Send" : "送出";
    const askBtn = $("#methodAskBtn");
    if (askBtn) askBtn.textContent = en ? "Ask Gemini" : "問 Gemini";
    const askHint = $("#methodAskHint");
    if (askHint) {
      askHint.textContent = en
        ? "Not a premium model — please wait patiently."
        : "非高階模型，使用時請耐心等候。";
    }
  }

  THEUI.bindLangToggle($("#langToggle"), (next) => {
    lang = next;
    syncChromeLang();
    renderUnitOptions();
    renderQuestions();
    renderMethod();
  });

  function renderUnitOptions() {
    const prev = currentUnitId;
    unitSelect.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = lang === "en" ? "Select a unit…" : "選擇單位…";
    unitSelect.appendChild(placeholder);
    units.forEach((u) => {
      const opt = document.createElement("option");
      opt.value = u.id;
      opt.textContent = u.name;
      unitSelect.appendChild(opt);
    });
    if (prev && units.some((u) => u.id === prev)) unitSelect.value = prev;
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

  function renderTabs() {
    sdgTabs.innerHTML = "";
    if (!currentUnitId) return;
    const list = sdgsForUnit(currentUnitId);
    if (!list.length) {
      currentSdg = null;
      return;
    }
    if (!currentSdg || !list.includes(currentSdg)) currentSdg = list[0];
    list.forEach((n) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = `SDG${n}`;
      btn.className = n === currentSdg ? "active has-items" : "has-items";
      btn.addEventListener("click", () => {
        currentSdg = n;
        activeQuestionId = null;
        activeRef = null;
        activeMetricRef = null;
        renderTabs();
        renderQuestions();
        const first = assignmentsForUnit(currentUnitId).find((q) => q.sdg === currentSdg);
        if (first) selectQuestion(first);
        else renderMethod();
      });
      sdgTabs.appendChild(btn);
    });
  }

  function selectQuestion(q) {
    activeQuestionId = q.id;
    activeRef = q.ref || null;
    activeMetricRef = q.metricRef || null;
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
  }

  function answerHasContent(answer) {
    if (!answer) return false;
    if (answer.yesNo || answer.public || answer.comment) return true;
    if (String(answer.evidence || "").trim() || answer.evidenceFileName || answer.evidenceFileUrl) return true;
    if (answer.options && answer.options.length) return true;
    return Object.values(answer.values || {}).some((value) => value != null && String(value) !== "");
  }

  function requestRender() {
    if (holdRender) renderQueued = true;
    else renderQuestions();
  }

  function renderQuestions() {
    questionList.innerHTML = "";
    if (!currentUnitId) {
      emptyState.hidden = false;
      emptyState.textContent = "請先選擇填寫單位。";
      return;
    }
    const mine = assignmentsForUnit(currentUnitId).filter((q) => q.sdg === currentSdg);
    if (!mine.length) {
      emptyState.hidden = false;
      emptyState.textContent = "此單位尚未被分派此 SDG 題目。";
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
      if (clickable) header.addEventListener("click", () => selectMetric(metric));
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
          selectQuestion(q);
        });
        // 點進輸入欄也同步右側方法論
        card.addEventListener("focusin", () => {
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
        card.appendChild(meta);
        card.appendChild(THEUI.renderQuestionCopy(q, lang));

        const fields = document.createElement("div");
        fields.className = "fields";
        const pending = pendingFiles.get(q.id);
        THEUI.appendAnswerFields(fields, q, {
          lang,
          getAnswer: () => getAnswer(q.id),
          pendingName: pending ? pending.name : "",
          resolveFileUrl: (answer) => (window.THESubmit && THESubmit.fileUrl ? THESubmit.fileUrl(answer) : Promise.resolve("")),
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
    drafts = {};
    pendingFiles.clear();
    if (!unitId) return;
    unsubAnswers = THELive.listenUnitAnswers(
      unitId,
      (map) => {
        if (unitId !== currentUnitId) return;
        remoteAnswers = map || {};
        requestRender();
      },
      (err) => showSubmitBanner("bad", `讀取填答失敗。${THELive.explain(err)}`)
    );
  }

  unitSelect.addEventListener("change", () => {
    currentUnitId = unitSelect.value;
    currentSdg = null;
    activeQuestionId = null;
    activeRef = null;
    activeMetricRef = null;
    watchUnit(currentUnitId);
    renderTabs();
    renderQuestions();
    const first = assignmentsForUnit(currentUnitId).find((q) => q.sdg === currentSdg);
    if (first) selectQuestion(first);
    else renderMethod();
  });

  THELive.listenUnits(
    (next) => {
      units = next || [];
      renderUnitOptions();
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
