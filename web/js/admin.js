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

    let units = (THEStorage.getUnitsOverride() || unitsFile).filter(
      (u) => !String(u.id || "").startsWith("unit-placeholder") && !String(u.name || "").includes("佔位")
    );
    if (THEStorage.getUnitsOverride()) THEStorage.setUnitsOverride(units);
    THEStorage.resetAssignmentsOnce("2026-10-14-reset");
    THEStorage.pruneAssignments(units.map((u) => u.id));
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
        if (unitFilter.size && !a.some((id) => unitFilter.has(id))) return false;
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
        const header = THEUI.renderMetricHeader(metric, lang, {
          note,
          altNote,
          clickable,
          selected: clickable && focusMetricRef === String(metric.ref || metricKey) && !focusQuestionId,
        });
        if (clickable) {
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
          body.appendChild(THEUI.renderAnswerPreview(q, lang));
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

    $("#btnClearUnitFilter").addEventListener("click", () => {
      unitFilter.clear();
      renderUnitFilter();
      renderQuestions();
    });

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

    $("#btnClearAssignments").addEventListener("click", () => {
      if (!window.confirm("要清除這個瀏覽器裡的全部分配嗎？各單位需重新分派。")) return;
      THEStorage.clearAssignments();
      selected.clear();
      refreshStats();
      renderTabs();
      renderQuestions();
      updateBottom();
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
          const packs = await THESubmit.listSubmissions();
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
          showExportBanner("bad", "匯出失敗，檔案還沒下載。請確認已用管理帳號登入，而且 Storage 允許讀取 submissions。");
        }
      });
    });

    $("#btnExportFiles").addEventListener("click", () => {
      runExport($("#btnExportFiles"), "正在打包全部證據檔，請先不要關閉頁面。", async () => {
        try {
          const packs = await THESubmit.listSubmissions();
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
