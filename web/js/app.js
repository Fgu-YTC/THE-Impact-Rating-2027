(async function () {
  const $ = (sel) => document.querySelector(sel);

  const [questionsData, methodologyZh, methodologyEn, unitsFile] = await Promise.all([
    fetch("data/questions.json").then((r) => r.json()),
    fetch("data/methodology-zh.json").then((r) => r.json()),
    fetch("data/methodology-en.json").then((r) => r.json()),
    fetch("data/units.json").then((r) => r.json()),
  ]);

  const units = (THEStorage.getUnitsOverride() || unitsFile).filter(
    (u) => !String(u.id || "").startsWith("unit-placeholder") && !String(u.name || "").includes("佔位")
  );
  if (THEStorage.getUnitsOverride()) THEStorage.setUnitsOverride(units);
  THEStorage.resetAssignmentsOnce("2026-10-14-reset");
  THEStorage.pruneAssignments(units.map((u) => u.id));
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

  const unitSelect = $("#unitSelect");
  const sdgTabs = $("#sdgTabs");
  const questionList = $("#questionList");
  const methodTitle = $("#methodTitle");
  const methodBody = $("#methodBody");
  const emptyState = $("#emptyState");

  THEUI.bindLangToggle($("#langToggle"), (next) => {
    lang = next;
    renderQuestions();
    renderMethod();
  });

  units.forEach((u) => {
    const opt = document.createElement("option");
    opt.value = u.id;
    opt.textContent = u.name;
    unitSelect.appendChild(opt);
  });

  function assignmentsForUnit(unitId) {
    const map = THEStorage.getAssignments();
    return questions.filter((q) => (map[q.id] || []).includes(unitId));
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
    if (!currentUnitId) {
      THEMethod.render(methodTitle, methodBody, {
        title: lang === "en" ? "Methodology" : "方法論",
        html: `<p class="method-p method-empty">${
          lang === "en" ? "Select a unit first." : "請先選擇填寫單位。"
        }</p>`,
      });
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
  }

  function getAnswer(qid) {
    return THEStorage.getUnitAnswers(currentUnitId)[qid] || {};
  }

  function saveAnswer(qid, patch) {
    const cur = getAnswer(qid);
    THEStorage.setUnitAnswer(currentUnitId, qid, { ...cur, ...patch });
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
      const altNote = lang === "en" ? (enNote && zhNote ? zhNote : "") : enNote && zhNote ? enNote : "";
      const clickable = Boolean(note);

      const block = document.createElement("div");
      block.className = "metric-block";
      const header = THEUI.renderMetricHeader(metric, lang, {
        note,
        altNote,
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
          if (e.target.closest("input, select, textarea, label, button")) return;
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
        card.appendChild(meta);
        card.appendChild(THEUI.renderQuestionCopy(q, lang, { showBoth: true }));

        const fields = document.createElement("div");
        fields.className = "fields";
        const pending = pendingFiles.get(q.id);
        THEUI.appendAnswerFields(fields, q, {
          lang,
          getAnswer: () => getAnswer(q.id),
          pendingName: pending ? pending.name : ans.evidenceFileName || "",
          onPatch: (partial) => saveAnswer(q.id, partial),
          onFile: (file) => {
            if (file) pendingFiles.set(q.id, file);
            else pendingFiles.delete(q.id);
          },
        });

        card.appendChild(fields);
        host.appendChild(card);
      });
    });
  }

  unitSelect.addEventListener("change", () => {
    currentUnitId = unitSelect.value;
    currentSdg = null;
    activeQuestionId = null;
    activeRef = null;
    activeMetricRef = null;
    renderTabs();
    renderQuestions();
    // 預設選第一題，右側顯示對應方法論
    const first = assignmentsForUnit(currentUnitId).find((q) => q.sdg === currentSdg);
    if (first) selectQuestion(first);
    else renderMethod();
  });

  $("#btnExport").addEventListener("click", async () => {
    if (!currentUnitId) {
      alert("請先選擇單位");
      return;
    }
    const unit = units.find((u) => u.id === currentUnitId);
    const status = $("#submitStatus");
    if (status) status.textContent = "正在匯出收集表…";
    try {
      await THEExport.exportOfficial({
        questions,
        answers: THEStorage.getUnitAnswers(currentUnitId),
        filename: `Impact 2027-data collection support v1_${unit.name}.xlsx`,
      });
      if (status) status.textContent = "已匯出收集表。";
    } catch (err) {
      if (status) status.textContent = "";
      alert("匯出失敗，請再試一次。");
    }
  });

  $("#btnSubmit").addEventListener("click", async () => {
    if (!currentUnitId) {
      alert("請先選擇單位");
      return;
    }
    const unit = units.find((u) => u.id === currentUnitId);
    const btn = $("#btnSubmit");
    const status = $("#submitStatus");
    btn.disabled = true;
    status.textContent = "提交中…";
    try {
      await THESubmit.submitUnit({
        unitId: currentUnitId,
        unitName: unit.name,
        answers: THEStorage.getUnitAnswers(currentUnitId),
        files: pendingFiles,
        onFileUploaded: (questionId, info) => {
          saveAnswer(questionId, info);
          pendingFiles.delete(questionId);
        },
      });
      status.textContent = "已提交到系統。";
    } catch (err) {
      status.textContent = "";
      alert(err && err.message ? err.message : "提交失敗，請再試一次。");
    } finally {
      btn.disabled = false;
    }
  });

  emptyState.hidden = false;
  emptyState.textContent = "請先選擇填寫單位。";
  methodTitle.textContent = "方法論";
  methodBody.textContent = "選擇單位與 SDG 後顯示對應方法論。";
})();
