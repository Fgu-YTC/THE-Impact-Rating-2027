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

    const [questionsData, methodologyZh, methodologyEn, unitsFile, priorYear, priorUnits] = await Promise.all([
      fetch("data/questions.json?v=20261029n").then((r) => r.json()),
      fetch("data/methodology-zh.json").then((r) => r.json()),
      fetch("data/methodology-en.json").then((r) => r.json()),
      fetch("data/units.json").then((r) => r.json()),
      fetch("data/prior-year.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
      fetch("data/prior-units.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
    ]);

    let units = [];
    let unitGroups = THEUI.DEFAULT_UNIT_GROUPS.slice();
    let ensuredGroups = false;
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
    let assignBusy = false;
    const unitFilter = new Set();
    let lang = THEUI.getLang();
    let focusRef = null;
    let focusMetricRef = null;
    let focusQuestionId = null;
    let submissions = [];
    let officeByUnit = {};
    let mode = "assign";
    let fillDrafts = {};
    const fillFiles = new Map();
    let holdRender = false;
    let renderQueued = false;
    let returnsByUnit = {};

    const manageUnitSelect = $("#manageUnitSelect");
    const sdgTabs = $("#sdgTabs");
    const questionList = $("#questionList");
    const methodTitle = $("#methodTitle");
    const methodBody = $("#methodBody");
    const filterBar = $("#filterBar");
    const newUnitName = $("#newUnitName");
    const newUnitGroup = $("#newUnitGroup");
    const manageGroupSelect = $("#manageGroupSelect");
    const newGroupName = $("#newGroupName");
    const editUnitGroup = $("#editUnitGroup");
    const assignTargets = new Set();

    function syncChromeLang() {
      const note = $("#dataYearNote");
      if (note) {
        const full =
          lang === "en"
            ? "Use AY 113 for numbers; policies/measures must be in place by the end of that academic year. If a question’s methodology states otherwise, follow that question."
            : "數字題以 113 學年為準；政策／措施須於該學年度結束前已生效。若該題方法論另有註明，以該題為準。";
        note.title = full;
        note.innerHTML =
          lang === "en"
            ? "Data year: Impact 2027 · AY <strong>113</strong>"
            : "資料年度：Impact 2027 · <strong>113 學年度</strong>";
      }
      const askBtn = $("#methodAskBtn");
      if (askBtn) askBtn.textContent = lang === "en" ? "Ask Gemini" : "問 Gemini";
      const askHint = $("#methodAskHint");
      if (askHint) {
        askHint.textContent =
          lang === "en"
            ? "Not a premium model — please wait patiently."
            : "非高階模型，使用時請耐心等候。";
      }
    }

    THEUI.bindLangToggle($("#langToggle"), (next) => {
      lang = next;
      syncChromeLang();
      renderQuestions();
      renderMethod();
    });
    syncChromeLang();

    function focusQuestion(q) {
      const same = focusQuestionId === q.id;
      focusQuestionId = q.id;
      focusRef = q.ref || null;
      focusMetricRef = q.metricRef || null;
      if (same) {
        renderMethod();
        return;
      }
      renderQuestions();
      renderMethod();
    }

    function fillGroupSelects() {
      const opts = unitGroups.length ? unitGroups : THEUI.DEFAULT_UNIT_GROUPS;
      const fill = (sel, includeEmpty) => {
        if (!sel) return;
        const prev = sel.value;
        sel.innerHTML = "";
        if (includeEmpty) {
          const ph = document.createElement("option");
          ph.value = "";
          ph.textContent = "選擇分組…";
          sel.appendChild(ph);
        }
        opts.forEach((g) => {
          const o = document.createElement("option");
          o.value = g;
          o.textContent = g;
          sel.appendChild(o);
        });
        if (prev && [...sel.options].some((o) => o.value === prev)) sel.value = prev;
        else if (!includeEmpty && opts[0]) sel.value = opts[0];
      };
      fill(newUnitGroup, false);
      fill(manageGroupSelect, false);
      fill(editUnitGroup, false);
      const unit = units.find((u) => u.id === (manageUnitSelect && manageUnitSelect.value));
      if (unit && editUnitGroup) {
        const g = unit.group || THEUI.inferUnitGroup(unit.name);
        if ([...editUnitGroup.options].some((o) => o.value === g)) editUnitGroup.value = g;
      }
    }

    function fillUnitSelect() {
      if (manageUnitSelect) {
        const keep = manageUnitSelect.value;
        THEUI.fillGroupedUnitSelect(manageUnitSelect, units, {
          groupOrder: unitGroups,
          selectedId: keep,
          placeholder: "選擇單位…",
        });
      }
      [...assignTargets].forEach((id) => {
        if (!units.some((u) => u.id === id)) assignTargets.delete(id);
      });
      fillGroupSelects();
      renderUnitFilter();
      renderAssignUnitsList();
      const btnSet = $("#btnSetUnitGroup");
      if (btnSet) btnSet.disabled = !(manageUnitSelect && manageUnitSelect.value);
      updateBottom();
    }

    function updateAssignUnitsSummary() {
      const el = $("#assignUnitsSummary");
      if (!el) return;
      if (!assignTargets.size) {
        el.textContent = "選單位（可多選）";
        return;
      }
      const names = [...assignTargets].map((id) => unitName(id)).filter(Boolean);
      if (names.length <= 3) {
        el.textContent = names.join("、");
        return;
      }
      el.textContent = `${names.slice(0, 2).join("、")} 等 ${names.length} 個單位`;
    }

    function renderAssignUnitsList() {
      const list = $("#assignUnitsList");
      if (!list) return;
      list.innerHTML = "";
      if (!units.length) {
        const empty = document.createElement("div");
        empty.className = "assign-units-empty";
        empty.textContent = "尚無單位";
        list.appendChild(empty);
        updateAssignUnitsSummary();
        return;
      }
      const grouped = THEUI.groupUnits(units, unitGroups);
      grouped.forEach((row) => {
        if (!row.units.length) return;
        const head = document.createElement("div");
        head.className = "assign-units-group";
        head.textContent = row.group;
        list.appendChild(head);
        row.units.forEach((u) => {
          const lab = document.createElement("label");
          lab.className = "assign-units-item";
          const cb = document.createElement("input");
          cb.type = "checkbox";
          cb.checked = assignTargets.has(u.id);
          cb.addEventListener("change", () => {
            if (cb.checked) assignTargets.add(u.id);
            else assignTargets.delete(u.id);
            updateAssignUnitsSummary();
            updateBottom();
          });
          lab.appendChild(cb);
          lab.appendChild(document.createTextNode(u.name));
          list.appendChild(lab);
        });
      });
      updateAssignUnitsSummary();
    }

    function updateUnitFilterSummary() {
      const el = $("#unitFilterSummary");
      if (!el) return;
      if (!unitFilter.size) {
        el.textContent = "未篩選";
        el.classList.remove("has-filter");
        return;
      }
      const names = [...unitFilter].map((id) => unitName(id)).filter(Boolean);
      const preview = names.slice(0, 3).join("、");
      const more = names.length > 3 ? ` 等 ${names.length} 個` : "";
      el.textContent = `已選：${preview}${more}`;
      el.classList.add("has-filter");
    }

    function setUnitFilterOpen(open) {
      const panel = $("#unitFilter");
      const body = $("#unitFilterBody");
      const btn = $("#btnToggleUnitFilter");
      if (!panel || !body || !btn) return;
      body.hidden = !open;
      panel.classList.toggle("open", open);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.textContent = open ? "收合單位篩選" : "篩選單位";
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
        updateUnitFilterSummary();
        return;
      }
      const grouped = THEUI.groupUnits(units, unitGroups);
      grouped.forEach((row) => {
        if (!row.units.length) return;
        const head = document.createElement("div");
        head.className = "unit-filter-group-title";
        head.textContent = row.group;
        list.appendChild(head);
        row.units.forEach((u) => {
          const lab = document.createElement("label");
          const cb = document.createElement("input");
          cb.type = "checkbox";
          cb.checked = unitFilter.has(u.id);
          cb.addEventListener("change", () => {
            if (cb.checked) unitFilter.add(u.id);
            else unitFilter.delete(u.id);
            updateUnitFilterSummary();
            applyUnitFilterNavigation();
          });
          lab.appendChild(cb);
          const prog = unitFillProgress(u.id);
          const due = prog.due || (u.questionIds || []).length;
          const label =
            due > 0 ? `${u.name}（${prog.filled}/${due}）` : `${u.name}（0）`;
          lab.appendChild(document.createTextNode(label));
          lab.title =
            due > 0
              ? `${u.name}：已填 ${prog.filled}／分派 ${due}`
              : `${u.name}：尚未分派題目`;
          list.appendChild(lab);
        });
      });
      updateUnitFilterSummary();
    }
    fillUnitSelect();

    function unitName(id) {
      return units.find((u) => u.id === id)?.name || id;
    }

    function assignees(qid) {
      return units.filter((unit) => (unit.questionIds || []).includes(qid)).map((unit) => unit.id);
    }

    /** 目前單位篩選下，各單位被分派到的 SDG 列表；未篩選則回傳 null */
    function sdgsForUnitFilter() {
      if (!unitFilter.size) return null;
      const set = new Set();
      questions.forEach((q) => {
        const a = assignees(q.id);
        if (a.some((id) => unitFilter.has(id))) set.add(Number(q.sdg));
      });
      return [...set].sort((a, b) => a - b);
    }

    function applyUnitFilterNavigation() {
      const hits = sdgsForUnitFilter();
      if (hits && hits.length && !hits.includes(Number(currentSdg))) {
        currentSdg = hits[0];
        selected.clear();
        focusRef = null;
        focusMetricRef = null;
        focusQuestionId = null;
        renderMethod();
        updateBottom();
      }
      renderTabs();
      renderQuestions();
    }

    function questionIsFilled(questionId) {
      return fillMark(questionId).filled === true;
    }

    function unitFillProgress(unitId) {
      const ids = (units.find((u) => u.id === unitId) || {}).questionIds || [];
      let due = ids.length;
      let filled = 0;
      ids.forEach((qid) => {
        const pack = submissions.find((item) => item.unitId === unitId);
        const original = pack && pack.answers && pack.answers[qid];
        const office = officeOf(unitId, qid);
        if (answerHasContent(office || original)) filled += 1;
      });
      return { filled, due };
    }

    function refreshStats() {
      const total = questions.length;
      let assigned = 0;
      let filled = 0;
      questions.forEach((q) => {
        const who = assignees(q.id);
        if (!who.length) return;
        assigned += 1;
        if (questionIsFilled(q.id)) filled += 1;
      });
      const unfilled = Math.max(0, assigned - filled);
      $("#statTotal").textContent = total;
      $("#statAssigned").textContent = assigned;
      $("#statUnassigned").textContent = total - assigned;
      const filledEl = $("#statFilled");
      const dueEl = $("#statFillDue");
      const unfilledEl = $("#statUnfilled");
      if (filledEl) filledEl.textContent = filled;
      if (dueEl) dueEl.textContent = assigned;
      if (unfilledEl) unfilledEl.textContent = unfilled;
      const stats = $("#adminStats");
      if (stats) {
        stats.title =
          lang === "en"
            ? `Fill progress: ${filled} of ${assigned} assigned questions have answers`
            : `填寫進度：已分派 ${assigned} 題中，已有 ${filled} 題填了內容（未填 ${unfilled}）`;
      }

      // per-SDG counts on tabs via title attribute later
      window.__sdgCounts = {};
      for (let n = 1; n <= 17; n++) {
        const qs = questions.filter((q) => q.sdg === n);
        const aQs = qs.filter((q) => assignees(q.id).length);
        const a = aQs.length;
        const f = aQs.filter((q) => questionIsFilled(q.id)).length;
        window.__sdgCounts[n] = { total: qs.length, assigned: a, filled: f };
      }
    }

    function showSdgOverview(n) {
      currentSdg = n;
      selected.clear();
      focusRef = null;
      focusMetricRef = null;
      focusQuestionId = null;
      renderTabs();
      renderQuestions();
      renderMethod();
      updateBottom();
      const pane = document.querySelector(".pane-right");
      if (pane && typeof pane.scrollIntoView === "function") {
        pane.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }

    function renderTabs() {
      sdgTabs.innerHTML = "";
      const unitSdgs = sdgsForUnitFilter();
      for (let n = 1; n <= 17; n++) {
        const c = window.__sdgCounts?.[n] || { total: 0, assigned: 0 };
        const chip = document.createElement("div");
        chip.className = "sdg-chip" + (n === currentSdg ? " active" : "");
        if (c.total) chip.classList.add("has-items");
        if (unitSdgs) {
          if (unitSdgs.includes(n)) chip.classList.add("unit-hit");
          else chip.classList.add("unit-dim");
        }

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "sdg-tab";
        btn.textContent = c.assigned
          ? `SDG${n} ${c.filled}/${c.assigned}`
          : `SDG${n}`;
        if (unitSdgs && unitSdgs.includes(n)) {
          btn.title = `篩選單位有題可看 · 填寫 ${c.filled}/${c.assigned} · 題數 ${c.total}`;
        } else {
          btn.title = `填寫進度 ${c.filled || 0}/${c.assigned || 0}（本 SDG 共 ${c.total} 題）`;
        }
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
      const q = questions.find((item) => item.id === focusQuestionId);
      const label = (item) => (lang === "en" ? item.en : item.zh);
      window.THEAskQuestion = {
        ref: (q && q.ref) || focusRef || "",
        sdg: (q && q.sdg) || currentSdg || "",
        title: q ? label(q) : resolved.title || "",
        answerType: (q && q.answerType) || "",
        options: ((q && q.options) || []).map(label).filter(Boolean),
      };
      const askForm = $("#methodAsk");
      if (askForm) askForm.hidden = !(q || currentSdg);
    }

    function showQuestionMethodology(q) {
      focusQuestion(q);
      const pane = document.querySelector(".pane-right");
      if (pane && typeof pane.scrollIntoView === "function") {
        pane.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }

    function visibleQuestions() {
      return questions.filter((q) => {
        if (q.sdg !== currentSdg) return false;
        if (mode === "fill") return true;
        const a = assignees(q.id);
        const returned = returnsFor(q.id);
        if (filter === "returned") {
          if (!returned.length) return false;
          if (unitFilter.size) return returned.some((item) => unitFilter.has(item.unitId));
          return true;
        }
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
        const clickable = Boolean(note);

        const block = document.createElement("div");
        block.className = "metric-block";
        const reviewing = mode === "review";
        const header = THEUI.renderMetricHeader(metric, lang, {
          note: reviewing ? "" : note,
          clickable: reviewing ? false : clickable,
          compact: reviewing,
          selected: !reviewing && clickable && focusMetricRef === String(metric.ref || metricKey) && !focusQuestionId,
        });
        if (!reviewing && clickable) {
          header.addEventListener("click", (e) => {
            if (THEUI.isTextSelecting(e)) return;
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
            if (e.target.closest("input, select, textarea, label, button, a")) return;
            if (THEUI.isTextSelecting(e)) return;
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
          if (mode === "review" || mode === "fill") {
            const mark = fillMark(q.id);
            badge.className = mark.filled ? "badge ok" : mark.returned ? "badge return" : "badge warn";
            badge.textContent = mark.text;
          } else if (who.length) {
            badge.className = "badge ok";
            badge.textContent = `已分配：${who.map(unitName).join("、")}`;
          } else {
            badge.className = "badge warn";
            badge.textContent = "未分配";
          }
          meta.appendChild(ref);
          meta.appendChild(badge);
          if ((mode === "review" || mode === "fill") && who.length) {
            const unitsBadge = document.createElement("span");
            unitsBadge.className = "badge units-badge";
            unitsBadge.textContent =
              who.length > 1
                ? `分派 ${who.length} 單位：${who.map(unitName).join("、")}`
                : `分派：${unitName(who[0])}`;
            meta.appendChild(unitsBadge);
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
          body.appendChild(meta);
          body.appendChild(
            THEUI.renderQuestionCopy(q, lang, {
              showAsk: mode !== "review",
              titleOnly: mode === "review",
            })
          );
          if (mode === "assign") {
            const priorUnit = THEUI.renderPriorUnit(priorUnits[q.ref]);
            if (priorUnit) body.appendChild(priorUnit);
            const prior = THEUI.renderPriorYear(priorYear[q.ref], q);
            if (prior) body.appendChild(prior);
            returnsFor(q.id).forEach((item) => {
              const view = THEUI.renderReturnStatus(item.ret, lang, item.unitName);
              if (view) body.appendChild(view);
            });
            body.appendChild(THEUI.renderAnswerPreview(q, lang));
          }
          if (mode === "review") {
            returnsFor(q.id).forEach((item) => {
              const view = THEUI.renderReturnStatus(item.ret, lang, item.unitName);
              if (view) body.appendChild(view);
            });
            if (who.length || submissionsFor(q.id).length) {
              body.appendChild(renderMultiUnitPanel(q, { editable: false }));
            }
          }
          if (mode === "fill") {
            const work = document.createElement("div");
            work.className = "multi-unit-work";
            const multi = isMultiUnitQuestion(q);
            if (multi) {
              work.appendChild(renderMultiUnitPanel(q, { editable: true, originalOnly: true }));
            }
            returnsFor(q.id).forEach((item) => {
              const view = THEUI.renderReturnStatus(item.ret, lang, item.unitName);
              if (view) work.appendChild(view);
            });
            work.appendChild(
              THEUI.renderFillCompare({
                lang,
                priorUnit: THEUI.renderPriorUnit(priorUnits[q.ref]),
                prior: THEUI.renderPriorYear(priorYear[q.ref], q),
                fields: renderFillEditors(q),
              })
            );
            body.appendChild(work);
          }
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

    function isMultiUnitQuestion(q) {
      const who = assignees(q.id);
      if (who.length > 1) return true;
      return submissionsFor(q.id, { originalOnly: true }).length > 1;
    }

    function returnsFor(questionId) {
      const out = [];
      Object.keys(returnsByUnit || {}).forEach((unitId) => {
        const ret = (returnsByUnit[unitId] || {})[questionId];
        if (ret && String(ret.suggestion || "").trim()) {
          out.push({ unitId, unitName: unitName(unitId), ret });
        }
      });
      return out;
    }

    /** 永續辦／單位 office 裡有實際內容的最終稿 */
    function officeAnswerWithContent(unitId, questionId) {
      const ans = officeOf(unitId, questionId);
      return ans && answerHasContent(ans) ? ans : null;
    }

    function finalOfficeAnswer(questionId) {
      const office = officeUnit();
      if (office) {
        const ans = officeAnswerWithContent(office.id, questionId);
        if (ans) return { unitId: office.id, answer: ans, label: "最終填報" };
      }
      // 單一單位「永續辦改寫」也存在該單位的 office
      const who = assignees(questionId);
      for (let i = 0; i < who.length; i++) {
        const ans = officeAnswerWithContent(who[i], questionId);
        if (ans) {
          return {
            unitId: who[i],
            answer: ans,
            label: who.length > 1 ? "最終填報" : `永續辦改寫（${unitName(who[i])}）`,
          };
        }
      }
      return null;
    }

    function fillMark(questionId) {
      const who = assignees(questionId);
      const returned = returnsFor(questionId);
      const items = submissionsFor(questionId);
      const finalHit = finalOfficeAnswer(questionId);
      if (finalHit) {
        return {
          filled: true,
          text: who.length > 1 ? `最終填報已寫（${who.length} 單位）` : "最終填報已寫",
        };
      }
      if (items.some((item) => item.office)) {
        return {
          filled: true,
          text: who.length > 1 ? `最終填報已寫（${who.length} 單位）` : "最終填報已寫",
        };
      }
      if (items.length > 1) return { filled: true, text: `${items.length} 單位已填` };
      if (items.length) return { filled: true, text: "已填寫" };
      if (returned.length) {
        return {
          filled: false,
          returned: true,
          text: returned.length > 1 ? `${returned.length} 單位已退回` : "已退回",
        };
      }
      if (who.length > 1) return { filled: false, text: `未填（已派 ${who.length}）` };
      return { filled: false, text: "未填寫" };
    }

    /** 各單位答案對照（唯讀）；多單位時提示下方寫最終填報 */
    function renderMultiUnitPanel(q, { editable = false, originalOnly = false } = {}) {
      const wrap = document.createElement("div");
      wrap.className = "multi-unit-panel";
      wrap.addEventListener("click", (e) => e.stopPropagation());
      const who = assignees(q.id);
      const items = submissionsFor(q.id, { originalOnly });
      const multi = who.length > 1 || items.length > 1;

      if (multi) {
        const tip = document.createElement("p");
        tip.className = "multi-unit-tip";
        tip.textContent = editable
          ? "此題有兩個以上單位。請先對照各單位答案，再於下方「最終填報」合併寫出匯出用的那一份。"
          : "此題有兩個以上單位答案，可並排對照。合併請到「填寫」模式寫「最終填報」。";
        wrap.appendChild(tip);
      }

      if (who.length) {
        const line = document.createElement("div");
        line.className = "assignee-line";
        line.textContent = `分派單位：${who.map(unitName).join("、")}`;
        wrap.appendChild(line);
      }

      if (items.length || who.length) {
        const label = document.createElement("div");
        label.className = "multi-unit-label";
        label.textContent = multi ? "各單位答案" : "單位答案";
        wrap.appendChild(label);
      }
      wrap.appendChild(renderSubmitted(q, { originalOnly }));
      return wrap;
    }

    function submissionsFor(questionId, { originalOnly = false } = {}) {
      return submissions
        .map((pack) => {
          const original = (pack.answers || {})[questionId];
          const office = officeOf(pack.unitId, questionId);
          if (originalOnly) {
            return {
              unitId: pack.unitId,
              unitName: pack.unitName || unitName(pack.unitId),
              sourceUnitName: pack.unitName || unitName(pack.unitId),
              updatedAt: pack.updatedAt,
              answer: original,
              office: false,
            };
          }
          return {
            unitId: pack.unitId,
            unitName: pack.unitName || unitName(pack.unitId),
            sourceUnitName: (office && office.sourceUnitName) || pack.unitName || unitName(pack.unitId),
            updatedAt: (office && office.updatedAt) || pack.updatedAt,
            answer: office || original,
            office: !!office,
          };
        })
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

    function appendAnswerDetails(list, q, answer) {
      if (!answer) return;
      if (answer.filledBy) addAnswerRow(list, "填寫人", answer.filledBy);
      if (q.answerType !== "continuous" && answer.yesNo) {
        const yn =
          lang === "en"
            ? String(answer.yesNo).toUpperCase()
            : answer.yesNo === "yes"
              ? "是"
              : answer.yesNo === "no"
                ? "否"
                : String(answer.yesNo);
        addAnswerRow(list, lang === "en" ? "Yes / No" : "是／否", yn);
      }
      if (q.answerType === "picklist" && answer.options && answer.options.length) {
        const labels = answer.options.map((key) => {
          const opt = (q.options || []).find((row) => row.en === key || row.zh === key);
          return opt ? (lang === "en" ? opt.en || opt.zh : opt.zh || opt.en) : key;
        });
        addAnswerRow(list, lang === "en" ? "Options" : "選項", labels.join("、"));
      }
      if (q.answerType === "continuous") {
        (q.options || []).forEach((opt, index) => {
          const raw = (answer.values || {})[`v${index}`];
          if (raw != null && String(raw) !== "") {
            addAnswerRow(list, lang === "en" ? opt.en || opt.zh : opt.zh || opt.en, String(raw));
          }
        });
      }
      const pub =
        lang === "en"
          ? { public: "Public", private: "Private", undefined: "Undefined", yes: "Public", no: "Private" }
          : { public: "公開", private: "不公開", undefined: "未定", yes: "公開", no: "不公開" };
      if (answer.public) addAnswerRow(list, lang === "en" ? "Public" : "是否公開", pub[answer.public] || answer.public);
      if (String(answer.evidence || "").trim()) {
        addAnswerRow(list, lang === "en" ? "Evidence" : "證據", linkNode(answer.evidence, answer.evidence));
      }
      if (answer.evidenceFileUrl) {
        addAnswerRow(
          list,
          lang === "en" ? "File" : "檔案",
          linkNode(
            answer.evidenceFileUrl,
            answer.evidenceStoredName || answer.evidenceFileName || (lang === "en" ? "Open file" : "開啟檔案")
          )
        );
      } else if (answer.evidenceFileName) {
        addAnswerRow(list, lang === "en" ? "File" : "檔案", answer.evidenceFileName);
      }
      if (answer.comment) addAnswerRow(list, lang === "en" ? "Comments" : "備註", answer.comment);
    }

    function renderAnswerCard({ title, answer, q, when, tagText, tagClass, cardClass }) {
      const card = document.createElement("div");
      card.className = "submitted-card" + (cardClass ? ` ${cardClass}` : "");
      const head = document.createElement("div");
      head.className = "submitted-head";
      head.appendChild(document.createTextNode(title || "單位"));
      if (when) {
        const time = document.createElement("span");
        time.className = "submitted-time";
        time.textContent = when;
        head.appendChild(time);
      }
      if (tagText) {
        const tag = document.createElement("span");
        tag.className = tagClass || "badge warn";
        tag.textContent = tagText;
        head.appendChild(tag);
      }
      card.appendChild(head);
      if (answer) {
        const list = document.createElement("dl");
        appendAnswerDetails(list, q, answer);
        if (list.childNodes.length) card.appendChild(list);
      }
      return card;
    }

    function renderSubmitted(q, { originalOnly = false } = {}) {
      const wrap = document.createElement("div");
      wrap.className = "submitted";
      wrap.addEventListener("click", (e) => e.stopPropagation());
      const items = submissionsFor(q.id, { originalOnly });
      const who = assignees(q.id);
      const finalHit = originalOnly ? null : finalOfficeAnswer(q.id);
      // 單位「原提交」：有內容的才算；最終稿另外用卡片顯示，避免只看到尚未提交
      const pending = who.filter((unitId) => {
        const pack = submissions.find((item) => item.unitId === unitId);
        const original = pack && pack.answers && pack.answers[q.id];
        return !answerHasContent(original);
      });
      const shownOfficeIds = new Set();
      if (items.length + pending.length + (finalHit ? 1 : 0) > 1) wrap.classList.add("multi");

      if (!items.length && !pending.length && !finalHit) {
        const empty = document.createElement("div");
        empty.className = "submitted-empty";
        empty.textContent = submissions.length ? "尚無提交" : "尚未讀到提交資料";
        wrap.appendChild(empty);
        return wrap;
      }

      if (finalHit) {
        shownOfficeIds.add(finalHit.unitId);
        const when = finalHit.answer.updatedAt
          ? new Date(finalHit.answer.updatedAt).toLocaleString("zh-TW", { hour12: false })
          : "";
        wrap.appendChild(
          renderAnswerCard({
            title: finalHit.label,
            answer: finalHit.answer,
            q,
            when,
            tagText: "可匯出內容",
            tagClass: "badge ok",
            cardClass: "submitted-final",
          })
        );
      }

      items.forEach((item) => {
        // 最終稿已用上方卡片顯示時，略過同單位的 office 重複卡
        if (item.office && shownOfficeIds.has(item.unitId)) return;
        const when = item.updatedAt
          ? new Date(item.updatedAt).toLocaleString("zh-TW", { hour12: false })
          : "";
        wrap.appendChild(
          renderAnswerCard({
            title: item.sourceUnitName || item.unitName || "單位",
            answer: item.answer,
            q,
            when,
            tagText: item.office ? "永續辦已改" : "",
            tagClass: "badge warn",
          })
        );
      });

      pending.forEach((unitId) => {
        wrap.appendChild(
          renderAnswerCard({
            title: unitName(unitId),
            answer: null,
            q,
            tagText: finalHit ? "單位尚未提交（上方已有最終填報）" : "尚未提交",
            tagClass: "badge warn",
            cardClass: "pending",
          })
        );
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
      refreshStats();
      renderUnitFilter();
      renderTabs();
      if (mode === "review" || mode === "fill") requestFillRender();
      else renderQuestions();
    }

    $("#btnReloadAnswers").addEventListener("click", () => {
      const count = submissions.length;
      if (!count) showExportBanner("warn", "目前還沒有單位提交。同一單位有人提交後，這一頁會自己更新。");
      else showExportBanner("ok", `已在看 ${count} 個單位的填答。有新的提交會自己出現，不用重新整理。`);
      renderQuestions();
    });

    function fillKey(unitId, questionId) {
      return `${unitId}\0${questionId}`;
    }

    function storedAnswer(unitId, questionId) {
      const pack = submissions.find((item) => item.unitId === unitId);
      return (pack && pack.answers && pack.answers[questionId]) || {};
    }

    function officeOf(unitId, questionId) {
      const answer = (officeByUnit[unitId] || {})[questionId];
      return answer && answer.editor === "永續辦" ? answer : null;
    }

    function packsForExport() {
      return submissions.map((pack) => {
        const answers = { ...(pack.answers || {}) };
        Object.entries(officeByUnit[pack.unitId] || {}).forEach(([questionId, answer]) => {
          if (answer && answer.editor === "永續辦") answers[questionId] = answer;
        });
        return { ...pack, answers };
      });
    }

    function getFillAnswer(unitId, questionId) {
      const base = officeOf(unitId, questionId) || storedAnswer(unitId, questionId);
      return { ...base, ...(fillDrafts[fillKey(unitId, questionId)] || {}) };
    }

    function saveFillAnswer(unitId, questionId, patch) {
      const key = fillKey(unitId, questionId);
      fillDrafts[key] = { ...(fillDrafts[key] || {}), ...patch };
    }

    function officeUnit() {
      return (
        units.find((unit) => unit.name === "永續辦" || unit.name === "永續發展辦公室") || null
      );
    }

    function fillTargets(q) {
      const who = assignees(q.id);
      const originals = submissionsFor(q.id, { originalOnly: true });
      const multi = who.length > 1 || originals.length > 1;

      // 兩個以上單位：只開一份「最終填報」，存到永續辦
      if (multi) {
        const office = officeUnit();
        if (office) {
          return [{ unitId: office.id, unitName: "最終填報", kind: "final" }];
        }
        if (who[0]) {
          return [{ unitId: who[0], unitName: "最終填報", kind: "final" }];
        }
        return [];
      }

      // 單一原單位：改寫該單位答案
      if (who[0]) {
        return [{ unitId: who[0], unitName: unitName(who[0]), kind: "rewrite" }];
      }
      if (originals[0]) {
        return [
          {
            unitId: originals[0].unitId,
            unitName: originals[0].unitName,
            kind: "rewrite",
          },
        ];
      }
      const office = officeUnit();
      if (office) return [{ unitId: office.id, unitName: "最終填報", kind: "final" }];
      return [];
    }

    function renderFillEditors(q) {
      const wrap = document.createElement("div");
      wrap.className = "fill-editors";
      const targets = fillTargets(q);
      const multi = isMultiUnitQuestion(q);
      const head = document.createElement("div");
      head.className = "multi-unit-label";
      if (multi) {
        head.textContent = "最終填報（匯出用，同一題只會有這一份）";
      } else if (targets[0] && targets[0].kind === "rewrite") {
        head.textContent = `原本單位改寫：${targets[0].unitName}`;
      } else {
        head.textContent = "最終填報";
      }
      wrap.appendChild(head);
      if (!targets.length) {
        const empty = document.createElement("div");
        empty.className = "submitted-empty";
        empty.textContent = "尚無可寫入的單位（請先分派，或確認已有永續辦單位）";
        wrap.appendChild(empty);
        return wrap;
      }
      targets.forEach((target) => {
        const block = document.createElement("div");
        block.className = "fill-unit" + (target.kind === "final" ? " fill-unit-final" : "");
        const name = document.createElement("div");
        name.className = "fill-unit-name";
        if (target.kind === "final") {
          name.textContent = "最終填報";
        } else {
          name.textContent = `原本單位改寫：${target.unitName}`;
        }
        block.appendChild(name);
        const office = officeOf(target.unitId, q.id);
        if (office) {
          const tag = document.createElement("div");
          tag.className = "fill-office";
          tag.textContent = target.kind === "final" ? "已有最終填報稿" : "永續辦已改過此單位答案";
          block.appendChild(tag);
        }
        const filledBy = (getFillAnswer(target.unitId, q.id) || {}).filledBy;
        if (filledBy) {
          const by = document.createElement("div");
          by.className = "filled-by";
          by.textContent = `填寫人：${filledBy}`;
          block.appendChild(by);
        }
        const fields = document.createElement("div");
        fields.className = "fields";
        const key = fillKey(target.unitId, q.id);
        const pending = fillFiles.get(key);
        THEUI.appendAnswerFields(fields, q, {
          lang,
          idPrefix: `${target.unitId}-${q.id}`,
          getAnswer: () => getFillAnswer(target.unitId, q.id),
          pendingName: pending ? pending.name : "",
          resolveFileUrl: (answer) => (window.THESubmit && THESubmit.fileUrl ? THESubmit.fileUrl(answer) : Promise.resolve("")),
          onPatch: (partial) => saveFillAnswer(target.unitId, q.id, partial),
          onFile: (file) => {
            if (file) fillFiles.set(key, file);
            else fillFiles.delete(key);
          },
        });
        block.appendChild(fields);
        wrap.appendChild(block);
      });
      return wrap;
    }

    function requestFillRender() {
      if (mode !== "fill" && mode !== "review") return;
      if (mode === "review") {
        if (!holdRender) renderQuestions();
        return;
      }
      if (holdRender) renderQueued = true;
      else renderQuestions();
    }

    function applyMode(next) {
      mode = next;
      if (mode !== "review" && (filter === "filled" || filter === "unfilled")) filter = "all";
      if (mode !== "assign" && (filter === "assigned" || filter === "unassigned")) filter = "all";
      appRoot.classList.toggle("mode-assign", mode === "assign");
      appRoot.classList.toggle("mode-review", mode === "review");
      appRoot.classList.toggle("mode-fill", mode === "fill");
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
      const ready = selected.size && assignTargets.size;
      $("#btnAssign").disabled = assignBusy || !ready;
      $("#btnUnassign").disabled = assignBusy || !ready;
      const manageId = manageUnitSelect && manageUnitSelect.value;
      $("#btnRemoveUnit").disabled = !manageId;
      const btnSet = $("#btnSetUnitGroup");
      if (btnSet) btnSet.disabled = !manageId;
    }

    questionList.addEventListener("focusin", () => {
      if (mode === "fill") holdRender = true;
    });
    questionList.addEventListener("focusout", (e) => {
      if (questionList.contains(e.relatedTarget)) return;
      holdRender = false;
      if (renderQueued) {
        renderQueued = false;
        if (mode === "fill") renderQuestions();
      }
    });

    $("#btnAdminSubmit").addEventListener("click", async () => {
      const keys = [...new Set([...Object.keys(fillDrafts), ...fillFiles.keys()])];
      const byUnit = new Map();
      keys.forEach((key) => {
        const splitAt = key.indexOf("\0");
        if (splitAt < 0) return;
        const unitId = key.slice(0, splitAt);
        const questionId = key.slice(splitAt + 1);
        if (!byUnit.has(unitId)) byUnit.set(unitId, []);
        byUnit.get(unitId).push(questionId);
      });
      const jobs = [];
      byUnit.forEach((ids, unitId) => {
        const files = new Map();
        const questionIds = [...new Set(ids)].filter((questionId) => {
          const key = fillKey(unitId, questionId);
          if (fillFiles.has(key)) files.set(questionId, fillFiles.get(key));
          return fillFiles.has(key) || answerHasContent(getFillAnswer(unitId, questionId));
        });
        if (questionIds.length) jobs.push({ unitId, questionIds, files });
      });
      if (!jobs.length) {
        showExportBanner("warn", "這次沒有新的修改。改過的題目才會送出，各單位已在系統裡的答案會保留。");
        return;
      }
      const btn = $("#btnAdminSubmit");
      const label = btn.textContent;
      const count = jobs.reduce((sum, job) => sum + job.questionIds.length, 0);
      btn.disabled = true;
      btn.textContent = "儲存中…";
      showExportBanner("busy", `正在儲存 ${jobs.length} 個單位、${count} 題，請先不要關閉頁面。`);
      try {
        for (const job of jobs) {
          await THESubmit.submitChanged({
            unitId: job.unitId,
            entries: job.questionIds.map((questionId) => ({
              questionId,
              answer: getFillAnswer(job.unitId, questionId),
            })),
            files: job.files,
            questions,
            office: {
              unitName:
                unitName(job.unitId) === "永續辦" || unitName(job.unitId) === "永續發展辦公室"
                  ? "最終填報"
                  : unitName(job.unitId),
            },
          });
          job.questionIds.forEach((questionId) => {
            const key = fillKey(job.unitId, questionId);
            delete fillDrafts[key];
            fillFiles.delete(key);
          });
        }
        showExportBanner("ok", `已儲存 ${jobs.length} 個單位、${count} 題。時間 ${whenNow()}。`);
      } catch (e) {
        const detail = e && (e.code || e.message) ? ` ${e.code || e.message}` : "";
        showExportBanner("bad", `儲存失敗，這次的修改還沒全部寫入。${detail}`);
      } finally {
        btn.disabled = false;
        btn.textContent = label;
      }
    });

    const btnToggleUnitFilter = $("#btnToggleUnitFilter");
    if (btnToggleUnitFilter) {
      btnToggleUnitFilter.addEventListener("click", () => {
        const body = $("#unitFilterBody");
        setUnitFilterOpen(Boolean(body && body.hidden));
      });
      setUnitFilterOpen(false);
    }

    $("#btnClearUnitFilter").addEventListener("click", () => {
      unitFilter.clear();
      renderUnitFilter();
      applyUnitFilterNavigation();
    });

    filterBar.querySelectorAll("button[data-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        filter = btn.dataset.filter;
        filterBar.querySelectorAll("button[data-filter]").forEach((b) => b.classList.toggle("active", b === btn));
        renderQuestions();
      });
    });

    if (manageUnitSelect) {
      manageUnitSelect.addEventListener("change", () => {
        updateBottom();
        fillGroupSelects();
      });
    }

    function pickAssignUnits(predicate) {
      units.forEach((u) => {
        if (predicate(u)) assignTargets.add(u.id);
      });
      renderAssignUnitsList();
      updateBottom();
    }

    const btnAssignPickAll = $("#btnAssignPickAll");
    if (btnAssignPickAll) {
      btnAssignPickAll.addEventListener("click", (e) => {
        e.preventDefault();
        pickAssignUnits(() => true);
      });
    }
    const btnAssignPickAdmin = $("#btnAssignPickAdmin");
    if (btnAssignPickAdmin) {
      btnAssignPickAdmin.addEventListener("click", (e) => {
        e.preventDefault();
        pickAssignUnits((u) => (u.group || THEUI.inferUnitGroup(u.name)) === "行政單位");
      });
    }
    const btnAssignPickClear = $("#btnAssignPickClear");
    if (btnAssignPickClear) {
      btnAssignPickClear.addEventListener("click", (e) => {
        e.preventDefault();
        assignTargets.clear();
        renderAssignUnitsList();
        updateBottom();
      });
    }

    $("#btnAssign").addEventListener("click", async () => {
      const unitIds = [...assignTargets];
      if (!unitIds.length || !selected.size || assignBusy) return;
      const ids = [...selected];
      const unitLabels = unitIds.map((id) => unitName(id) || id);
      const btn = $("#btnAssign");
      const label = btn.textContent;
      assignBusy = true;
      updateBottom();
      let ok = 0;
      let added = 0;
      const failed = [];
      try {
        for (let i = 0; i < unitIds.length; i += 1) {
          const unitId = unitIds[i];
          btn.textContent = `分派中… ${i + 1}/${unitIds.length}`;
          try {
            const result = await THELive.assignQuestions(unitId, ids);
            ok += 1;
            added += result.added || 0;
          } catch (err) {
            failed.push(`${unitName(unitId) || unitId}：${THELive.explain(err)}`);
          }
        }
        try {
          await THELive.clearReturnsForQuestions(ids);
        } catch (_) {
          /* ignore */
        }
        selected.clear();
        updateBottom();
        if (failed.length && !ok) {
          showExportBanner("bad", `分派沒有寫入。${failed[0]}`);
        } else if (failed.length) {
          showExportBanner(
            "warn",
            `已分派 ${ok}/${unitIds.length} 個單位（題目 ${ids.length}、新增約 ${added} 筆）；失敗：${failed.join("；")}`
          );
        } else {
          showExportBanner(
            "ok",
            `已把 ${ids.length} 題分派給 ${ok} 個單位（${unitLabels.join("、")}）；合計新增約 ${added} 筆。`
          );
        }
      } finally {
        assignBusy = false;
        btn.textContent = label;
        updateBottom();
      }
    });

    $("#btnUnassign").addEventListener("click", async () => {
      const unitIds = [...assignTargets];
      if (!unitIds.length || !selected.size || assignBusy) return;
      const ids = [...selected];
      const unitLabels = unitIds.map((id) => unitName(id) || id);
      const btn = $("#btnUnassign");
      const label = btn.textContent;
      assignBusy = true;
      updateBottom();
      let ok = 0;
      let removed = 0;
      const failed = [];
      try {
        for (let i = 0; i < unitIds.length; i += 1) {
          const unitId = unitIds[i];
          btn.textContent = `取消中… ${i + 1}/${unitIds.length}`;
          try {
            const result = await THELive.unassignQuestions(unitId, ids);
            ok += 1;
            removed += result.removed || 0;
          } catch (err) {
            failed.push(`${unitName(unitId) || unitId}：${THELive.explain(err)}`);
          }
        }
        selected.clear();
        updateBottom();
        if (failed.length && !ok) {
          showExportBanner("bad", `取消分派沒有寫入。${failed[0]}`);
        } else if (failed.length) {
          showExportBanner(
            "warn",
            `已取消 ${ok}/${unitIds.length} 個單位；失敗：${failed.join("；")}`
          );
        } else {
          showExportBanner(
            "ok",
            `已取消 ${ok} 個單位（${unitLabels.join("、")}）對 ${ids.length} 題的分派；移除約 ${removed} 筆。`
          );
        }
      } finally {
        assignBusy = false;
        btn.textContent = label;
        updateBottom();
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
          const packs = packsForExport();
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
            `匯出完成。收集表已下載（同一題只會有一份答案），含 ${packs.length} 個單位來源、${questionCount} 題。請看瀏覽器的下載紀錄。時間 ${whenNow()}。`
          );
        } catch (e) {
          showExportBanner("bad", "匯出失敗，檔案還沒下載。請確認已用管理帳號登入，而且 Firestore 允許讀取答案。");
        }
      });
    });

    $("#btnExportFiles").addEventListener("click", () => {
      runExport($("#btnExportFiles"), "正在打包全部證據檔，請先不要關閉頁面。", async () => {
        try {
          const packs = packsForExport();
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
      const group =
        (newUnitGroup && newUnitGroup.value) ||
        THEUI.inferUnitGroup(name);
      try {
        await THELive.addUnit(id, name, group);
        newUnitName.value = "";
        showExportBanner("ok", `已新增單位「${name}」（${group}）。`);
      } catch (err) {
        showExportBanner("bad", `單位沒有新增。${THELive.explain(err)}`);
      }
    });

    $("#btnRemoveUnit").addEventListener("click", async () => {
      const unitId = manageUnitSelect && manageUnitSelect.value;
      if (!unitId) return;
      const unit = units.find((item) => item.id === unitId);
      const label = unit ? unit.name : unitId;
      const assigned = ((unit && unit.questionIds) || []).length;
      const warn = assigned
        ? `要刪除「${label}」嗎？已分派的 ${assigned} 題與這個單位的填答都會一起刪掉。`
        : `要刪除「${label}」嗎？`;
      if (!window.confirm(warn)) return;
      try {
        await THELive.removeUnit(unitId);
        assignTargets.delete(unitId);
        if (manageUnitSelect) manageUnitSelect.value = "";
        updateBottom();
        showExportBanner("ok", `已刪除單位「${label}」。`);
      } catch (err) {
        showExportBanner("bad", `單位沒有刪除。${THELive.explain(err)}`);
      }
    });

    $("#btnAddGroup").addEventListener("click", async () => {
      const name = (newGroupName && newGroupName.value || "").trim();
      if (!name) {
        showExportBanner("warn", "請先輸入新分組名稱。");
        return;
      }
      if (unitGroups.includes(name)) {
        showExportBanner("warn", `分組「${name}」已經存在。`);
        return;
      }
      try {
        const next = await THELive.saveUnitGroups(unitGroups.concat(name));
        unitGroups = next;
        if (newGroupName) newGroupName.value = "";
        fillGroupSelects();
        fillUnitSelect();
        showExportBanner("ok", `已新增分組「${name}」。`);
      } catch (err) {
        showExportBanner("bad", `分組沒有新增。${THELive.explain(err)}`);
      }
    });

    $("#btnRemoveGroup").addEventListener("click", async () => {
      const name = manageGroupSelect && manageGroupSelect.value;
      if (!name) return;
      const still = units.filter(
        (u) => (u.group || THEUI.inferUnitGroup(u.name)) === name
      );
      if (still.length) {
        showExportBanner(
          "warn",
          `還有 ${still.length} 個單位在「${name}」，請先改分組再刪。`
        );
        return;
      }
      if (unitGroups.length <= 1) {
        showExportBanner("warn", "至少要保留一個分組。");
        return;
      }
      if (!window.confirm(`要刪除分組「${name}」嗎？`)) return;
      try {
        const next = await THELive.saveUnitGroups(
          unitGroups.filter((g) => g !== name)
        );
        unitGroups = next;
        fillGroupSelects();
        fillUnitSelect();
        showExportBanner("ok", `已刪除分組「${name}」。`);
      } catch (err) {
        showExportBanner("bad", `分組沒有刪除。${THELive.explain(err)}`);
      }
    });

    $("#btnSetUnitGroup").addEventListener("click", async () => {
      const unitId = manageUnitSelect && manageUnitSelect.value;
      const group = editUnitGroup && editUnitGroup.value;
      if (!unitId || !group) return;
      const unit = units.find((u) => u.id === unitId);
      const label = unit ? unit.name : unitId;
      try {
        await THELive.setUnitGroup(unitId, group);
        showExportBanner("ok", `「${label}」已改到「${group}」。`);
      } catch (err) {
        showExportBanner("bad", `分組沒有更新。${THELive.explain(err)}`);
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
      officeByUnit = {};
      returnsByUnit = {};
      if (!ids.length) {
        applySubmissions([]);
        return;
      }
      const packs = {};
      const stops = [];
      ids.forEach((unitId) => {
        stops.push(
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
        stops.push(
          THELive.listenUnitOffice(
            unitId,
            (map) => {
              officeByUnit = { ...officeByUnit, [unitId]: map || {} };
              refreshStats();
              renderUnitFilter();
              renderTabs();
              if (mode === "fill" || mode === "review") requestFillRender();
              else renderQuestions();
            },
            (err) => showExportBanner("bad", `讀取永續辦修改失敗。${THELive.explain(err)}`)
          )
        );
        stops.push(
          THELive.listenUnitReturns(
            unitId,
            (map) => {
              returnsByUnit = { ...returnsByUnit, [unitId]: map || {} };
              refreshStats();
              renderUnitFilter();
              renderTabs();
              renderQuestions();
            },
            (err) => showExportBanner("bad", `讀取退回失敗。${THELive.explain(err)}`)
          )
        );
      });
      unsubAnswers = function () {
        stops.forEach((stop) => stop());
      };
    }

    THELive.listenUnitGroups(
      (groups) => {
        unitGroups = groups && groups.length ? groups : THEUI.DEFAULT_UNIT_GROUPS.slice();
        fillUnitSelect();
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
              fillUnitSelect();
            })
            .catch((err) =>
              showExportBanner("warn", `單位分組尚未同步。${THELive.explain(err)}`)
            );
        }
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
