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

    const [questionsData, methodologyZh, methodologyEn, unitsFile] = await Promise.all([
      fetch("data/questions.json").then((r) => r.json()),
      fetch("data/methodology-zh.json").then((r) => r.json()),
      fetch("data/methodology-en.json").then((r) => r.json()),
      fetch("data/units.json").then((r) => r.json()),
    ]);

    let units = THEStorage.getUnitsOverride() || unitsFile;
    const questions = (questionsData.questions || []).filter((q) => q.fillable !== false);
    const metricsByRef = Object.fromEntries(
      (questionsData.metrics || []).map((m) => [String(m.ref), m])
    );
    const selected = new Set();
    let currentSdg = 1;
    let filter = "all"; // all | assigned | unassigned
    let lang = THEUI.getLang();
    let focusRef = null;
    let focusMetricRef = null;
    let focusQuestionId = null;

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
    }
    fillUnitSelect();

    function unitName(id) {
      return units.find((u) => u.id === id)?.name || id;
    }

    function assignees(qid) {
      return THEStorage.getAssignments()[qid] || [];
    }

    function refreshStats() {
      const map = THEStorage.getAssignments();
      const total = questions.length;
      let assigned = 0;
      questions.forEach((q) => {
        if ((map[q.id] || []).length) assigned += 1;
      });
      $("#statTotal").textContent = total;
      $("#statAssigned").textContent = assigned;
      $("#statUnassigned").textContent = total - assigned;

      // per-SDG counts on tabs via title attribute later
      window.__sdgCounts = {};
      for (let n = 1; n <= 17; n++) {
        const qs = questions.filter((q) => q.sdg === n);
        const a = qs.filter((q) => (map[q.id] || []).length).length;
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
        if (filter === "assigned") return a.length > 0;
        if (filter === "unassigned") return a.length === 0;
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
        const key = String(q.metricRef || "_");
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

        let host = questionList;
        if (note) {
          const block = document.createElement("div");
          block.className = "metric-block";
          const header = document.createElement("div");
          header.className =
            "metric-header" +
            (focusMetricRef === String(metric.ref || metricKey) && !focusQuestionId ? " selected" : "");
          header.style.cursor = "pointer";
          header.addEventListener("click", () => {
            focusMetricRef = String(metric.ref || metricKey);
            focusQuestionId = null;
            focusRef = metric.ref || metricKey;
            renderMethod();
            renderQuestions();
          });
          const mMeta = document.createElement("div");
          mMeta.className = "q-meta";
          const mLabel = document.createElement("span");
          mLabel.className = "ref-label";
          mLabel.textContent = lang === "en" ? "Metric" : "大標題";
          const mRef = document.createElement("span");
          mRef.className = "q-ref ref-metric";
          mRef.textContent = metric.ref || metricKey;
          mMeta.appendChild(mLabel);
          mMeta.appendChild(mRef);
          header.appendChild(mMeta);
          header.appendChild(
            THEUI.renderQuestionCopy({ en: metric.en || "", zh: metric.zh || "" }, lang, { showBoth: true })
          );
          const noteEl = document.createElement("div");
          noteEl.className = "metric-note";
          noteEl.textContent = note;
          header.appendChild(noteEl);
          if (altNote) {
            const alt = document.createElement("div");
            alt.className = "q-alt";
            const tag = document.createElement("span");
            tag.className = "q-alt-lang";
            tag.textContent = lang === "en" ? "中文" : "EN";
            const text = document.createElement("div");
            text.className = "q-alt-text";
            text.textContent = altNote;
            alt.appendChild(tag);
            alt.appendChild(text);
            header.appendChild(alt);
          }
          block.appendChild(header);
          const listWrap = document.createElement("div");
          listWrap.className = "metric-indicators";
          block.appendChild(listWrap);
          questionList.appendChild(block);
          host = listWrap;
        }

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

          const body = document.createElement("div");
          const meta = document.createElement("div");
          meta.className = "q-meta";
          const ref = document.createElement("span");
          ref.className = "q-ref ref-indicator";
          ref.textContent = q.ref || q.id;
          const badge = document.createElement("span");
          if (who.length) {
            badge.className = "badge ok";
            badge.textContent = `已分配：${who.map(unitName).join("、")}`;
          } else {
            badge.className = "badge warn";
            badge.textContent = "未分配";
          }
          meta.appendChild(ref);
          meta.appendChild(badge);
          body.appendChild(meta);
          body.appendChild(THEUI.renderQuestionCopy(q, lang, { showBoth: true, showAsk: true }));
          head.appendChild(cb);
          head.appendChild(body);
          card.appendChild(head);
          host.appendChild(card);
        });
      });
    }

    function updateBottom() {
      $("#selectedCount").textContent = String(selected.size);
      $("#btnAssign").disabled = !(selected.size && unitSelect.value);
      $("#btnUnassign").disabled = !(selected.size && unitSelect.value);
    }

    filterBar.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        filter = btn.dataset.filter;
        filterBar.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b === btn));
        renderQuestions();
      });
    });

    unitSelect.addEventListener("change", updateBottom);

    $("#btnAssign").addEventListener("click", () => {
      const unitId = unitSelect.value;
      if (!unitId || !selected.size) return;
      THEStorage.assignQuestionsToUnit([...selected], unitId);
      selected.clear();
      refreshStats();
      renderTabs();
      renderQuestions();
      updateBottom();
    });

    $("#btnUnassign").addEventListener("click", () => {
      const unitId = unitSelect.value;
      if (!unitId || !selected.size) return;
      THEStorage.unassignQuestionsFromUnit([...selected], unitId);
      selected.clear();
      refreshStats();
      renderTabs();
      renderQuestions();
      updateBottom();
    });

    $("#btnAddUnit").addEventListener("click", () => {
      const name = (newUnitName.value || "").trim();
      if (!name) return;
      const id = "unit-" + Date.now();
      units = [...units, { id, name }];
      THEStorage.setUnitsOverride(units);
      newUnitName.value = "";
      fillUnitSelect();
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
  }
})();
