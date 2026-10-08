(async function () {
  const $ = (sel) => document.querySelector(sel);

  const [questionsData, methodologyZh, methodologyEn, unitsFile] = await Promise.all([
    fetch("data/questions.json").then((r) => r.json()),
    fetch("data/methodology-zh.json").then((r) => r.json()),
    fetch("data/methodology-en.json").then((r) => r.json()),
    fetch("data/units.json").then((r) => r.json()),
  ]);

  const units = THEStorage.getUnitsOverride() || unitsFile;
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

        if (q.answerType === "picklist" && q.options?.length) {
          const wrap = document.createElement("div");
          wrap.className = "option-list";
          const selected = new Set(ans.options || []);
          q.options.forEach((opt, i) => {
            const id = `${q.id}-opt-${i}`;
            const lab = document.createElement("label");
            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.id = id;
            cb.checked = selected.has(opt.en);
            cb.addEventListener("change", () => {
              const next = new Set(ans.options || []);
              if (cb.checked) next.add(opt.en);
              else next.delete(opt.en);
              saveAnswer(q.id, { options: [...next], yesNo: next.size ? "yes" : "" });
            });
            lab.appendChild(cb);
            lab.appendChild(document.createTextNode(`${opt.zh || opt.en}`));
            wrap.appendChild(lab);
          });
          fields.appendChild(wrap);
        } else if (q.answerType === "continuous") {
          (q.options?.length ? q.options : [{ en: "Value", zh: "數值", kind: "value" }]).forEach((opt, i) => {
            const row = document.createElement("div");
            row.className = "row";
            const lab = document.createElement("label");
            lab.textContent = opt.zh || opt.en;
            const inp = document.createElement("input");
            inp.type = "number";
            const key = `v${i}`;
            const values = ans.values || {};
            inp.value = values[key] ?? ans.value ?? "";
            inp.addEventListener("change", () => {
              const values = { ...(getAnswer(q.id).values || {}) };
              values[key] = inp.value;
              saveAnswer(q.id, { values, value: Object.values(values).filter(Boolean).join("; ") });
            });
            row.appendChild(lab);
            row.appendChild(inp);
            fields.appendChild(row);
          });
        } else {
          const row = document.createElement("div");
          row.className = "row";
          const lab = document.createElement("label");
          lab.textContent = "Yes / No";
          const sel = document.createElement("select");
          ["", "yes", "no"].forEach((v) => {
            const o = document.createElement("option");
            o.value = v;
            o.textContent = v === "" ? "—" : v.toUpperCase();
            sel.appendChild(o);
          });
          sel.value = ans.yesNo || "";
          sel.addEventListener("change", () => saveAnswer(q.id, { yesNo: sel.value }));
          row.appendChild(lab);
          row.appendChild(sel);
          fields.appendChild(row);
        }

        // 連續數值題（如 5.2.1）依原始 Excel：只填 Value，不要 Yes/No、Evidence、Public
        if (q.answerType !== "continuous") {
          const evRow = document.createElement("div");
          evRow.className = "row";
          evRow.innerHTML = `<label>Evidence</label>`;
          const ev = document.createElement("input");
          ev.type = "url";
          ev.placeholder = "https://…";
          ev.value = ans.evidence || "";
          ev.addEventListener("change", () => saveAnswer(q.id, { evidence: ev.value }));
          evRow.appendChild(ev);

          const pubRow = document.createElement("div");
          pubRow.className = "row";
          pubRow.innerHTML = `<label>Public</label>`;
          const pub = document.createElement("select");
          ["", "yes", "no"].forEach((v) => {
            const o = document.createElement("option");
            o.value = v;
            o.textContent = v === "" ? "—" : v.toUpperCase();
            pub.appendChild(o);
          });
          pub.value = ans.public || "";
          pub.addEventListener("change", () => saveAnswer(q.id, { public: pub.value }));
          pubRow.appendChild(pub);

          fields.appendChild(evRow);
          fields.appendChild(pubRow);
        }

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
    const qs = assignmentsForUnit(currentUnitId);
    await THEExport.exportUnitAnswers({
      unit,
      questions: qs,
      answers: THEStorage.getUnitAnswers(currentUnitId),
      sdgs,
    });
  });

  emptyState.hidden = false;
  emptyState.textContent = "請先選擇填寫單位。";
  methodTitle.textContent = "方法論";
  methodBody.textContent = "選擇單位與 SDG 後顯示對應方法論。";
})();
