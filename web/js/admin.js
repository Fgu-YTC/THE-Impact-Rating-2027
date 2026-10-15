(async function () {
  const $ = (sel) => document.querySelector(sel);
  const gate = $("#authGate");
  const appRoot = $("#adminApp");
  const authError = $("#authError");
  const authHint = $("#authHint");

  // —— Auth gate ——
  if (!THEAuth.configReady()) {
    authHint.textContent =
      "請先在 js/firebase-config.js 填入 Firebase Web 設定，並於 Console 啟用 Google 登入。";
  }

  $("#btnGoogle").addEventListener("click", async () => {
    authError.hidden = true;
    try {
      await THEAuth.signInWithGoogle();
    } catch (e) {
      authError.hidden = false;
      if (e.message === "missing_config") {
        authError.textContent = "尚未設定 Firebase（js/firebase-config.js）。";
      } else if (e.message === "not_allowed") {
        authError.textContent = `此帳號無權限管理：${e.email || ""}`;
      } else {
        authError.textContent = e.message || "登入失敗";
      }
    }
  });

  THEAuth.onAuth((user, reason) => {
    if (user) {
      gate.hidden = true;
      appRoot.hidden = false;
      $("#userChip").textContent = user.email;
      bootAdmin();
    } else {
      appRoot.hidden = true;
      gate.hidden = false;
      if (reason === "not_allowed") {
        authError.hidden = false;
        authError.textContent = "此 Google 帳號不在管理白名單。";
      }
    }
  });

  $("#btnLogout").addEventListener("click", () => THEAuth.signOut());

  let booted = false;
  async function bootAdmin() {
    if (booted) {
      refreshStats();
      renderTabs();
      renderQuestions();
      renderMethod();
      return;
    }
    booted = true;

    const [questionsData, methodologyZh, methodologyEn, unitsFile, priorUnits] = await Promise.all([
      fetch("data/questions.json").then((r) => r.json()),
      fetch("data/methodology-zh.json").then((r) => r.json()),
      fetch("data/methodology-en.json").then((r) => r.json()),
      fetch("data/units.json").then((r) => r.json()),
      fetch("data/prior-units.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
    ]);

    let units = [];
    const localUnits = (THEStorage.getUnitsOverride() || unitsFile).filter(
      (u) => !String(u.id || "").startsWith("unit-placeholder") && !String(u.name || "").includes("佔位")
    );
    const questions = (questionsData.questions || []).filter((q) => q.fillable !== false);
    const metricsByRef = Object.fromEntries(
      (questionsData.metrics || []).map((m) => [String(m.ref), m])
    );
    const selected = new Set();
    let currentSdg = 1;
    let filter = "all"; // all | assigned | unassigned
    const unitFilter = new Set();
    let lang = THEUI.getLang();
    let focusRef = null;
    let focusMetricRef = null;
    let focusQuestionId = null;
    let submissions = [];
    let mode = "assign";

    const unitSelect = $("#assignUnit");
    const sdgTabs = $("#sdgTabs");
    const questionList = $("#questionList");
    const methodTitle = $("#methodTitle");
    const methodBody = $("#methodBody");
    const filterBar = $("#filterBar");
    const newUnitName = $("#newUnitName");

    THEUI.bindLangToggle($("#langToggle"), (next) => {
      lang = next;
      renderQuestions();
      renderMethod();
    });

    function focusQuestion(q) {
      focusQuestionId = q.id;
      focusRef = q.ref || null;
      focusMetricRef = q.metricRef || null;
      renderQuestions();
      renderMethod();
    }

    function fillUnitSelect() {
      const prev = unitSelect.value;
      unitSelect.innerHTML = "";
      const ph = document.createElement("option");
      ph.value = "";
      ph.textContent = "選擇單位…";
      unitSelect.appendChild(ph);
      units.forEach((u) => {
        const o = document.createElement("option");
        o.value = u.id;
        o.textContent = u.name;
        unitSelect.appendChild(o);
      });
      if ([...unitSelect.options].some((o) => o.value === prev)) unitSelect.value = prev;
      renderUnitFilter();
    }

    function renderUnitFilter() {
      const list = $("#unitFilterList");
      list.innerHTML = "";
      [...unitFilter].forEach((id) => {
        if (!units.some((u) => u.id === id)) unitFilter.delete(id);
      });
      if (!units.length) {
        const empty = document.createElement("span");
        empty.className = "unit-filter-label";
        empty.textContent = "尚無單位";
        list.appendChild(empty);
        return;
      }
      units.forEach((u) => {
        const lab = document.createElement("label");
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = unitFilter.has(u.id);
        cb.addEventListener("change", () => {
          if (cb.checked) unitFilter.add(u.id);
          else unitFilter.delete(u.id);
          renderQuestions();
        });
        lab.appendChild(cb);
        lab.appendChild(document.createTextNode(u.name));
        list.appendChild(lab);
      });
    }
    fillUnitSelect();

    function unitName(id) {
      return units.find((u) => u.id === id)?.name || id;
    }

    function assignees(qid) {
      return units.filter((unit) => (unit.questionIds || []).includes(qid)).map((unit) => unit.id);
    }

    function refreshStats() {
      const total = questions.length;
      let assigned = 0;
      questions.forEach((q) => {
        if (assignees(q.id).length) assigned += 1;
      });
      $("#statTotal").textContent = total;
      $("#statAssigned").textContent = assigned;
      $("#statUnassigned").textContent = total - assigned;

      // per-SDG counts on tabs via title attribute later
      window.__sdgCounts = {};
      for (let n = 1; n <= 17; n++) {
        const qs = questions.filter((q) => q.sdg === n);
        const a = qs.filter((q) => assignees(q.id).length).length;
        window.__sdgCounts[n] = { total: qs.length, assigned: a };
      }
    }

    function renderTabs() {
      sdgTabs.innerHTML = "";
      for (let n = 1; n <= 17; n++) {
        const btn = document.createElement("button");
        btn.type = "button";
        const c = window.__sdgCounts?.[n] || { total: 0, assigned: 0 };
        btn.textContent = `SDG${n}`;
        btn.title = `已分配 ${c.assigned}/${c.total}`;
        btn.className = n === currentSdg ? "active" : "";
        if (c.total) btn.classList.add("has-items");
        btn.addEventListener("click", () => {
          currentSdg = n;
          selected.clear();
          focusRef = null;
          focusMetricRef = null;
          focusQuestionId = null;
          renderTabs();
          renderQuestions();
          renderMethod();
          updateBottom();
        });
        sdgTabs.appendChild(btn);
      }
    }

    function renderMethod() {
      const resolved = THEMethod.resolve({
        lang,
        methodologyZh,
        methodologyEn,
        sdg: currentSdg,
        ref: focusRef,
        metricRef: focusMetricRef,
      });
      THEMethod.render(methodTitle, methodBody, resolved);
    }

    function visibleQuestions() {
      return questions.filter((q) => {
        if (q.sdg !== currentSdg) return false;
        const a = assignees(q.id);
        if (unitFilter.size && !a.some((id) => unitFilter.has(id))) return false;
        if (filter === "assigned") return a.length > 0;
        if (filter === "unassigned") return a.length === 0;
        const filled = submissionsFor(q.id).length > 0;
        if (filter === "filled") return filled;
        if (filter === "unfilled") return !filled;
        return true;
      });
    }

    function renderQuestions() {
      questionList.innerHTML = "";
      const list = visibleQuestions();
      if (!list.length) {
        const empty = document.createElement("div");
        empty.className = "empty";
        empty.textContent = "此篩選下沒有題目。";
        questionList.appendChild(empty);
        return;
      }

      const byMetric = new Map();
      list.forEach((q) => {
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
        const zhNote = THEMethod.metricBlurb((methodologyZh.byRef || {})[metricKey], metricKey);
        const enNote = THEMethod.metricBlurb((methodologyEn.byRef || {})[metricKey], metricKey);
        const note = lang === "en" ? enNote || zhNote : zhNote || enNote;
        const altNote =
          lang === "en" ? (enNote && zhNote ? zhNote : "") : enNote && zhNote ? enNote : "";
        const clickable = Boolean(note);

        const block = document.createElement("div");
        block.className = "metric-block";
        const reviewing = mode === "review";
        const header = THEUI.renderMetricHeader(metric, lang, {
          note: reviewing ? "" : note,
          altNote: reviewing ? "" : altNote,
          clickable: reviewing ? false : clickable,
          compact: reviewing,
          selected: !reviewing && clickable && focusMetricRef === String(metric.ref || metricKey) && !focusQuestionId,
        });
        if (!reviewing && clickable) {
          header.addEventListener("click", () => {
            focusMetricRef = String(metric.ref || metricKey);
            focusQuestionId = null;
            focusRef = metric.ref || metricKey;
            renderMethod();
            renderQuestions();
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
          card.className =
            "q-card" +
            (selected.has(q.id) ? " selected" : "") +
            (focusQuestionId === q.id ? " focused" : "");
          card.style.cursor = "pointer";
          card.addEventListener("click", (e) => {
            if (e.target.closest("input[type=checkbox]")) return;
            focusQuestion(q);
          });
          const who = assignees(q.id);
          const head = document.createElement("div");
          head.className = "q-head";

          const body = document.createElement("div");
          const meta = document.createElement("div");
          meta.className = "q-meta";
          const ref = document.createElement("span");
          ref.className = "q-ref ref-indicator";
          ref.textContent = q.ref || q.id;
          const badge = document.createElement("span");
          if (mode === "review") {
            const filled = submissionsFor(q.id).length > 0;
            badge.className = filled ? "badge ok" : "badge warn";
            badge.textContent = filled ? "已填寫" : "未填寫";
          } else if (who.length) {
            badge.className = "badge ok";
            badge.textContent = `已分配：${who.map(unitName).join("、")}`;
          } else {
            badge.className = "badge warn";
            badge.textContent = "未分配";
          }
          meta.appendChild(ref);
          meta.appendChild(badge);
          body.appendChild(meta);
          body.appendChild(
            THEUI.renderQuestionCopy(q, lang, {
              showBoth: mode !== "review",
              showAsk: mode !== "review",
              titleOnly: mode === "review",
            })
          );
          const priorUnit = THEUI.renderPriorUnit(priorUnits[q.ref]);
          if (priorUnit) body.appendChild(priorUnit);
          if (mode === "assign") body.appendChild(THEUI.renderAnswerPreview(q, lang));
          if (mode === "review" && submissionsFor(q.id).length) body.appendChild(renderSubmitted(q));
          if (mode === "assign") {
            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.checked = selected.has(q.id);
            cb.addEventListener("change", () => {
              if (cb.checked) selected.add(q.id);
              else selected.delete(q.id);
              card.classList.toggle("selected", cb.checked);
              focusQuestion(q);
              updateBottom();
            });
            head.appendChild(cb);
          }
          head.appendChild(body);
          card.appendChild(head);
          host.appendChild(card);
        });
      });
    }

    function submissionsFor(questionId) {
      return submissions
        .map((pack) => ({
          unitName: pack.unitName || unitName(pack.unitId),
          updatedAt: pack.updatedAt,
          answer: (pack.answers || {})[questionId],
        }))
        .filter((item) => item.answer && answerHasContent(item.answer));
    }

    function answerHasContent(answer) {
      if (!answer) return false;
      if (answer.yesNo || answer.public || answer.comment) return true;
      if (String(answer.evidence || "").trim() || answer.evidenceFileName || answer.evidenceFileUrl) return true;
      if (answer.options && answer.options.length) return true;
      return Object.values(answer.values || {}).some((value) => value != null && String(value) !== "");
    }

    function addAnswerRow(list, label, value) {
      if (value == null || value === "") return;
      const row = document.createElement("div");
      row.className = "submitted-row";
      const dt = document.createElement("dt");
      dt.textContent = label;
      const dd = document.createElement("dd");
      if (value instanceof Node) dd.appendChild(value);
      else dd.textContent = value;
      row.appendChild(dt);
      row.appendChild(dd);
      list.appendChild(row);
    }

    function linkNode(href, text) {
      const a = document.createElement("a");
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = text || href;
      return a;
    }

    function renderSubmitted(q) {
      const wrap = document.createElement("div");
      wrap.className = "submitted";
      wrap.addEventListener("click", (e) => e.stopPropagation());
      const items = submissionsFor(q.id);
      if (!items.length) {
        const empty = document.createElement("div");
        empty.className = "submitted-empty";
        empty.textContent = submissions.length ? "尚無提交" : "尚未讀到提交資料";
        wrap.appendChild(empty);
        return wrap;
      }
      items.forEach((item) => {
        const card = document.createElement("div");
        card.className = "submitted-card";
        const head = document.createElement("div");
        head.className = "submitted-head";
        const when = item.updatedAt ? new Date(item.updatedAt).toLocaleString("zh-TW", { hour12: false }) : "";
        head.textContent = when ? `${item.unitName}　${when}` : item.unitName;
        card.appendChild(head);
        const list = document.createElement("dl");
        const answer = item.answer;
        if (q.answerType !== "continuous" && answer.yesNo) {
          addAnswerRow(list, "Yes / No", String(answer.yesNo).toUpperCase());
        }
        if (q.answerType === "picklist" && answer.options && answer.options.length) {
          const labels = answer.options.map((key) => {
            const opt = (q.options || []).find((item) => item.en === key || item.zh === key);
            return opt ? opt.zh || opt.en : key;
          });
          addAnswerRow(list, "選項", labels.join("、"));
        }
        if (q.answerType === "continuous") {
          (q.options || []).forEach((opt, index) => {
            const raw = (answer.values || {})[`v${index}`];
            if (raw != null && String(raw) !== "") addAnswerRow(list, opt.zh || opt.en, String(raw));
          });
        }
        const pub = { public: "Public", private: "Private", undefined: "Undefined", yes: "Public", no: "Private" };
        if (answer.public) addAnswerRow(list, "Public", pub[answer.public] || answer.public);
        if (String(answer.evidence || "").trim()) addAnswerRow(list, "Evidence", linkNode(answer.evidence, answer.evidence));
        if (answer.evidenceFileUrl) {
          addAnswerRow(list, "檔案", linkNode(answer.evidenceFileUrl, answer.evidenceStoredName || answer.evidenceFileName || "開啟檔案"));
        } else if (answer.evidenceFileName) {
          addAnswerRow(list, "檔案", answer.evidenceFileName);
        }
        if (answer.comment) addAnswerRow(list, "Comments", answer.comment);
        card.appendChild(list);
        wrap.appendChild(card);
      });
      return wrap;
    }

    function applySubmissions(packs, err) {
      if (err) {
        showExportBanner("bad", `讀取填答失敗。${THELive.explain(err)}`);
        return;
      }
      submissions = packs || [];
      submissions.forEach((pack) => {
        pack.unitName = unitName(pack.unitId);
      });
      if (mode === "review") renderQuestions();
    }

    $("#btnReloadAnswers").addEventListener("click", () => {
      const count = submissions.length;
      if (!count) showExportBanner("warn", "目前還沒有單位提交。同一單位有人提交後，這一頁會自己更新。");
      else showExportBanner("ok", `已在看 ${count} 個單位的填答。有新的提交會自己出現，不用重新整理。`);
      renderQuestions();
    });

    function applyMode(next) {
      mode = next;
      if (mode === "assign" && (filter === "filled" || filter === "unfilled")) filter = "all";
      if (mode === "review" && (filter === "assigned" || filter === "unassigned")) filter = "all";
      appRoot.classList.toggle("mode-assign", mode === "assign");
      appRoot.classList.toggle("mode-review", mode === "review");
      document.querySelectorAll("#modeToggle button").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.mode === mode);
      });
      filterBar.querySelectorAll("button[data-filter]").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.filter === filter);
      });
      renderQuestions();
    }

    document.querySelectorAll("#modeToggle button").forEach((btn) => {
      btn.addEventListener("click", () => applyMode(btn.dataset.mode));
    });

    function updateBottom() {
      $("#selectedCount").textContent = String(selected.size);
      $("#btnAssign").disabled = !(selected.size && unitSelect.value);
      $("#btnUnassign").disabled = !(selected.size && unitSelect.value);
    }

    $("#btnClearUnitFilter").addEventListener("click", () => {
      unitFilter.clear();
      renderUnitFilter();
      renderQuestions();
    });

    filterBar.querySelectorAll("button[data-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        filter = btn.dataset.filter;
        filterBar.querySelectorAll("button[data-filter]").forEach((b) => b.classList.toggle("active", b === btn));
        renderQuestions();
      });
    });

    unitSelect.addEventListener("change", updateBottom);

    $("#btnAssign").addEventListener("click", async () => {
      const unitId = unitSelect.value;
      if (!unitId || !selected.size) return;
      const ids = [...selected];
      try {
        await THELive.assignQuestions(unitId, ids);
        selected.clear();
        updateBottom();
      } catch (err) {
        showExportBanner("bad", `分派沒有寫入。${THELive.explain(err)}`);
      }
    });

    $("#btnUnassign").addEventListener("click", async () => {
      const unitId = unitSelect.value;
      if (!unitId || !selected.size) return;
      const ids = [...selected];
      try {
        await THELive.unassignQuestions(unitId, ids);
        selected.clear();
        updateBottom();
      } catch (err) {
        showExportBanner("bad", `取消分派沒有寫入。${THELive.explain(err)}`);
      }
    });

    $("#btnClearAssignments").addEventListener("click", async () => {
      if (!window.confirm("要清除全部分派嗎？各單位的題目清單會清空。已經提交的答案會留下。")) return;
      try {
        await THELive.clearAssignments();
        selected.clear();
        updateBottom();
      } catch (err) {
        showExportBanner("bad", `清除分派失敗。${THELive.explain(err)}`);
      }
    });

    function showExportBanner(kind, text) {
      const banner = $("#exportBanner");
      banner.hidden = false;
      banner.className = `submit-banner ${kind}`;
      banner.textContent = text;
    }

    function whenNow() {
      return new Date().toLocaleString("zh-TW", { hour12: false });
    }

    async function runExport(button, busyText, work) {
      const buttons = [$("#btnExportForms"), $("#btnExportFiles")];
      const labels = buttons.map((el) => el.textContent);
      buttons.forEach((el) => {
        el.disabled = true;
      });
      button.textContent = "匯出中…";
      showExportBanner("busy", busyText);
      try {
        await work();
      } finally {
        buttons.forEach((el, i) => {
          el.disabled = false;
          el.textContent = labels[i];
        });
      }
    }

    $("#btnExportForms").addEventListener("click", () => {
      runExport($("#btnExportForms"), "正在匯出全部單位的題目與填答，請先不要關閉頁面。", async () => {
        try {
          const packs = submissions;
          if (!packs.length) {
            showExportBanner("warn", "還沒有匯出。目前沒有單位提交，請各單位在填報頁按提交後再匯出。");
            return;
          }
          const answers = THESubmit.mergeAnswers(packs);
          const questionCount = Object.keys(answers).length;
          await THEExport.exportOfficial({
            questions,
            answers,
            filename: "Impact 2027-data collection support v1.xlsx",
          });
          showExportBanner(
            "ok",
            `匯出完成。收集表已下載，包含 ${packs.length} 個單位、${questionCount} 題。請看瀏覽器的下載紀錄。時間 ${whenNow()}。`
          );
        } catch (e) {
          showExportBanner("bad", "匯出失敗，檔案還沒下載。請確認已用管理帳號登入，而且 Firestore 允許讀取答案。");
        }
      });
    });

    $("#btnExportFiles").addEventListener("click", () => {
      runExport($("#btnExportFiles"), "正在打包全部證據檔，請先不要關閉頁面。", async () => {
        try {
          const packs = submissions;
          if (!packs.length) {
            showExportBanner("warn", "還沒有匯出。目前沒有單位提交，請各單位在填報頁按提交後再匯出。");
            return;
          }
          const result = await THESubmit.exportEvidenceZip({
            packs,
            questions,
            onProgress: (progress) => {
              if (progress.phase === "zip") {
                showExportBanner("busy", `檔案已下載 ${progress.done} 個，正在打包壓縮檔。`);
                return;
              }
              showExportBanner("busy", `正在下載證據檔 ${progress.done}／${progress.total}，請先不要關閉頁面。`);
            },
          });
          const missed = result.failed && result.failed.length ? `有 ${result.failed.length} 個檔案沒放進去。` : "";
          showExportBanner(
            result.failed && result.failed.length ? "warn" : "ok",
            `匯出完成。證據壓縮檔已下載，共 ${result.count} 個檔案，已依 SDG 分成資料夾。${missed}請看瀏覽器的下載紀錄。時間 ${whenNow()}。`
          );
        } catch (e) {
          if (e && e.message === "no-files") {
            showExportBanner("warn", "還沒有下載壓縮檔。已提交的答案裡沒有上傳檔案，網址在「匯出題目與填答」的 Excel 裡。");
            return;
          }
          const code = e && (e.code || e.message || "");
          if (String(code).includes("retry-limit-exceeded")) {
            showExportBanner(
              "bad",
              "證據壓縮檔還沒下載。瀏覽器連 Storage 下載時被中斷。請重新整理后再匯出一次；若仍失敗，到 Cloud Storage 桶子的 CORS 允許 https://fgu-ytc.github.io 的 GET。"
            );
            return;
          }
          const detail = code ? ` ${code}` : "";
          showExportBanner("bad", `證據壓縮檔匯出失敗，檔案還沒下載。${detail}`);
        }
      });
    });

    $("#btnAddUnit").addEventListener("click", async () => {
      const name = (newUnitName.value || "").trim();
      if (!name) return;
      const id = "unit-" + Date.now();
      try {
        await THELive.addUnit(id, name);
        newUnitName.value = "";
      } catch (err) {
        showExportBanner("bad", `單位沒有新增。${THELive.explain(err)}`);
      }
    });

    $("#btnSelectUnassigned").addEventListener("click", () => {
      selected.clear();
      questions
        .filter((q) => q.sdg === currentSdg && assignees(q.id).length === 0)
        .forEach((q) => selected.add(q.id));
      renderQuestions();
      updateBottom();
    });

    refreshStats();
    renderTabs();
    renderQuestions();
    renderMethod();
    updateBottom();

    try {
      const seeded = await THELive.seedIfEmpty(localUnits, THEStorage.getAssignments());
      if (seeded) showExportBanner("ok", "已把這個瀏覽器裡的單位與分派寫進 Firestore。之後各台電腦看到的是同一份。");
    } catch (err) {
      showExportBanner("bad", `讀取 Firestore 失敗。${THELive.explain(err)}`);
    }

    let unsubAnswers = function () {};
    let answerUnits = "";

    function watchAnswers(list) {
      const ids = (list || []).map((unit) => unit.id).sort();
      const sig = ids.join("|");
      if (sig === answerUnits) return;
      answerUnits = sig;
      unsubAnswers();
      if (!ids.length) {
        applySubmissions([]);
        return;
      }
      const packs = {};
      const stops = ids.map((unitId) =>
        THELive.listenUnitAnswers(
          unitId,
          (map) => {
            let updatedAt = "";
            Object.values(map || {}).forEach((answer) => {
              const stamp = String((answer && answer.updatedAt) || "");
              if (stamp > updatedAt) updatedAt = stamp;
            });
            packs[unitId] = { unitId, updatedAt, answers: map || {} };
            applySubmissions(Object.values(packs));
          },
          (err) => showExportBanner("bad", `讀取填答失敗。${THELive.explain(err)}`)
        )
      );
      unsubAnswers = function () {
        stops.forEach((stop) => stop());
      };
    }

    THELive.listenUnits(
      (next) => {
        units = next || [];
        fillUnitSelect();
        refreshStats();
        renderTabs();
        renderQuestions();
        watchAnswers(units);
      },
      (err) => showExportBanner("bad", `讀取單位失敗。${THELive.explain(err)}`)
    );
  }
})();
