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
      fetch("data/questions.json").then((r) => r.json()),
      fetch("data/methodology-zh.json").then((r) => r.json()),
      fetch("data/methodology-en.json").then((r) => r.json()),
      fetch("data/units.json").then((r) => r.json()),
      fetch("data/prior-year.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
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
    let officeByUnit = {};
    let mode = "assign";
    let fillDrafts = {};
    const fillFiles = new Map();
    let holdRender = false;
    let renderQueued = false;

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
      const q = questions.find((item) => item.id === focusQuestionId);
      const label = (item) => (lang === "en" ? item.en : item.zh);
      window.THEAskQuestion = {
        ref: (q && q.ref) || focusRef || "",
        sdg: (q && q.sdg) || "",
        title: q ? label(q) : resolved.title || "",
        answerType: (q && q.answerType) || "",
        options: ((q && q.options) || []).map(label).filter(Boolean),
      };
      const askForm = $("#methodAsk");
      if (askForm) askForm.hidden = !q;
    }

    function visibleQuestions() {
      return questions.filter((q) => {
        if (q.sdg !== currentSdg) return false;
        if (mode === "fill") return true;
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
            if (e.target.closest("input, select, textarea, label, button, a")) return;
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
            badge.className = mark.filled ? "badge ok" : "badge warn";
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
          body.appendChild(meta);
          body.appendChild(
            THEUI.renderQuestionCopy(q, lang, {
              showAsk: mode !== "review",
              titleOnly: mode === "review",
            })
          );
          const priorUnit = THEUI.renderPriorUnit(priorUnits[q.ref]);
          if (priorUnit) body.appendChild(priorUnit);
          const prior = THEUI.renderPriorYear(priorYear[q.ref]);
          if (prior) body.appendChild(prior);
          if (mode === "assign") body.appendChild(THEUI.renderAnswerPreview(q, lang));
          if (mode === "review" && submissionsFor(q.id).length) body.appendChild(renderSubmitted(q));
          if (mode === "fill") body.appendChild(renderFillEditors(q));
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

    function fillMark(questionId) {
      const items = submissionsFor(questionId);
      if (items.some((item) => item.office)) return { filled: true, text: "永續辦已填寫" };
      if (items.length) return { filled: true, text: "已填寫" };
      return { filled: false, text: "未填寫" };
    }

    function submissionsFor(questionId) {
      return submissions
        .map((pack) => {
          const original = (pack.answers || {})[questionId];
          const office = officeOf(pack.unitId, questionId);
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
        head.appendChild(document.createTextNode(`原填寫單位：${item.sourceUnitName || item.unitName}`));
        if (when) head.appendChild(document.createTextNode(`　${when}`));
        if (item.office) {
          const tag = document.createElement("span");
          tag.className = "badge warn";
          tag.textContent = "永續辦已填寫";
          head.appendChild(tag);
        }
        card.appendChild(head);
        const list = document.createElement("dl");
        const answer = item.answer;
        if (answer.filledBy) addAnswerRow(list, "填寫人", answer.filledBy);
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
      if (mode === "review" || mode === "fill") requestFillRender();
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
        units.find((unit) => unit.name === "永續發展辦公室" || unit.name === "永續辦") || null
      );
    }

    function fillTargets(q) {
      const seen = new Set();
      const list = [];
      assignees(q.id).forEach((unitId) => {
        if (seen.has(unitId)) return;
        seen.add(unitId);
        list.push({ unitId, unitName: unitName(unitId) });
      });
      submissions.forEach((pack) => {
        if (!pack.unitId || seen.has(pack.unitId)) return;
        const answer = (pack.answers || {})[q.id];
        if (!answer || !answerHasContent(answer)) return;
        seen.add(pack.unitId);
        list.push({ unitId: pack.unitId, unitName: pack.unitName || unitName(pack.unitId) });
      });
      Object.entries(officeByUnit).forEach(([unitId, map]) => {
        if (seen.has(unitId)) return;
        const answer = map && map[q.id];
        if (!answer || answer.editor !== "永續辦") return;
        seen.add(unitId);
        const savedName = answer.sourceUnitName || unitName(unitId);
        list.push({
          unitId,
          unitName: savedName === "永續發展辦公室" || savedName === "永續辦" ? "永續辦" : savedName,
          officeOnly: savedName === "永續發展辦公室" || savedName === "永續辦",
        });
      });
      if (!list.length) {
        const office = officeUnit();
        if (office) list.push({ unitId: office.id, unitName: "永續辦", officeOnly: true });
      }
      return list;
    }

    function renderFillEditors(q) {
      const wrap = document.createElement("div");
      const targets = fillTargets(q);
      if (!targets.length) {
        const empty = document.createElement("div");
        empty.className = "submitted-empty";
        empty.textContent = "尚無單位填寫";
        wrap.appendChild(empty);
        return wrap;
      }
      targets.forEach((target) => {
        const block = document.createElement("div");
        block.className = "fill-unit";
        const name = document.createElement("div");
        name.className = "fill-unit-name";
        name.textContent = target.officeOnly ? "永續辦" : `原填寫單位：${target.unitName}`;
        block.appendChild(name);
        const office = officeOf(target.unitId, q.id);
        if (office) {
          const tag = document.createElement("div");
          tag.className = "fill-office";
          tag.textContent = "永續辦已填寫";
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
      $("#btnAssign").disabled = !(selected.size && unitSelect.value);
      $("#btnUnassign").disabled = !(selected.size && unitSelect.value);
      $("#btnRemoveUnit").disabled = !unitSelect.value;
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
            office: { unitName: unitName(job.unitId) },
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
      try {
        await THELive.addUnit(id, name);
        newUnitName.value = "";
      } catch (err) {
        showExportBanner("bad", `單位沒有新增。${THELive.explain(err)}`);
      }
    });

    $("#btnRemoveUnit").addEventListener("click", async () => {
      const unitId = unitSelect.value;
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
        unitSelect.value = "";
        updateBottom();
        showExportBanner("ok", `已刪除單位「${label}」。`);
      } catch (err) {
        showExportBanner("bad", `單位沒有刪除。${THELive.explain(err)}`);
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
              if (mode === "fill" || mode === "review") requestFillRender();
            },
            (err) => showExportBanner("bad", `讀取永續辦修改失敗。${THELive.explain(err)}`)
          )
        );
      });
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
