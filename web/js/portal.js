/** Portal-aligned fill page — separate from unit fill / admin assign */
(async function () {
  const $ = (sel) => document.querySelector(sel);
  const authGate = $("#authGate");
  const app = $("#portalApp");
  const authError = $("#authError");
  const fieldList = $("#fieldList");
  const sdgTabs = $("#sdgTabs");
  const saveBanner = $("#saveBanner");

  function showAuthError(msg) {
    authError.hidden = !msg;
    authError.textContent = msg || "";
  }

  function banner(kind, text) {
    saveBanner.hidden = false;
    saveBanner.className = "submit-banner " + (kind || "");
    saveBanner.textContent = text;
  }

  const [portalPack, priorYear] = await Promise.all([
    fetch("data/portal-questions.json").then((r) => r.json()),
    fetch("data/prior-year.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
  ]);
  const fields = portalPack.fields || [];
  let currentSdg = fields[0] ? fields[0].sdg : 1;
  const drafts = {};
  let remote = {};
  let saveTimer = null;
  let dbCtx = null;

  async function getDb() {
    if (dbCtx) return dbCtx;
    const { initializeApp, getApps } = await import(
      "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"
    );
    const { getFirestore, doc, getDoc, setDoc } = await import(
      "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js"
    );
    const appInstance = getApps().length ? getApps()[0] : initializeApp(window.FIREBASE_CONFIG);
    dbCtx = { store: getFirestore(appInstance), doc, getDoc, setDoc };
    return dbCtx;
  }

  function answerOf(ref) {
    return { ...(remote[ref] || {}), ...(drafts[ref] || {}) };
  }

  function patch(ref, part) {
    drafts[ref] = { ...(drafts[ref] || {}), ...part };
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveBanner.hidden = true;
    }, 800);
  }

  function priorSummary(ref) {
    const data = priorYear[ref];
    if (!data) return "";
    const bits = [];
    if (data.yesNo) bits.push(`是／否：${data.yesNo === "yes" ? "是" : data.yesNo === "no" ? "否" : data.yesNo}`);
    if (Array.isArray(data.values) && data.values.length) {
      bits.push(
        "數字：" +
          data.values
            .map((v) => `${(v.label || "").split("\n")[0] || "值"}=${v.value}`)
            .slice(0, 4)
            .join("；")
      );
    }
    if (Array.isArray(data.evidence) && data.evidence[0]) bits.push("證據網址有");
    if (Array.isArray(data.files) && data.files[0]) bits.push(`檔案：${data.files[0].name || "有"}`);
    if (data.note) bits.push("備註有");
    return bits.join(" · ");
  }

  function renderTabs() {
    const sdgs = [...new Set(fields.map((f) => f.sdg))].sort((a, b) => a - b);
    sdgTabs.innerHTML = "";
    sdgs.forEach((n) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = `SDG ${n}`;
      btn.classList.toggle("active", n === currentSdg);
      btn.addEventListener("click", () => {
        currentSdg = n;
        renderTabs();
        renderFields();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
      sdgTabs.appendChild(btn);
    });
  }

  function renderFields() {
    fieldList.innerHTML = "";
    const mine = fields.filter((f) => f.sdg === currentSdg);
    $("#portalMeta").textContent = `Impact 2027 · SDG ${currentSdg} · ${mine.length} 欄（對齊 ${mine.filter((f) => f.aligned).length}）`;
    mine.forEach((f) => {
      const ans = answerOf(f.ref);
      const card = document.createElement("article");
      card.className = "portal-card " + (f.aligned ? "aligned" : "unaligned");
      card.dataset.ref = f.ref;

      const head = document.createElement("div");
      head.className = "portal-card-head";
      const ref = document.createElement("span");
      ref.className = "portal-ref";
      ref.textContent = f.ref;
      head.appendChild(ref);
      const badge = document.createElement("span");
      badge.className = "portal-badge" + (f.aligned ? "" : " warn");
      badge.textContent = f.aligned ? "已對齊本站題目" : "Portal 多出／子欄";
      head.appendChild(badge);
      card.appendChild(head);

      const en = document.createElement("div");
      en.className = "portal-en";
      en.textContent = f.en || "";
      card.appendChild(en);
      if (f.zh && f.zh !== f.en) {
        const zh = document.createElement("div");
        zh.className = "portal-zh";
        zh.textContent = f.zh;
        card.appendChild(zh);
      }

      const prior = priorSummary(f.ref);
      if (prior) {
        const box = document.createElement("div");
        box.className = "portal-prior";
        box.innerHTML = "<strong>去年參考（本站 prior-year）</strong>" + prior;
        card.appendChild(box);
      }

      const grid = document.createElement("div");
      grid.className = "portal-grid";
      const portal = f.portal || {};

      if (portal.hasYesNo || f.answerType === "yesno" || f.answerType === "picklist") {
        const lab = document.createElement("label");
        lab.textContent = "Yes / No";
        const sel = document.createElement("select");
        sel.innerHTML =
          '<option value="">—</option><option value="yes">Yes</option><option value="no">No</option>';
        sel.value = ans.yesNo || "";
        sel.addEventListener("change", () => patch(f.ref, { yesNo: sel.value }));
        lab.appendChild(sel);
        grid.appendChild(lab);
      }

      if (f.answerType === "picklist" && (f.options || []).length) {
        const wrap = document.createElement("div");
        wrap.className = "portal-opts";
        const selected = new Set(ans.options || []);
        f.options.forEach((opt) => {
          const key = opt.en || opt.zh;
          const lab = document.createElement("label");
          const cb = document.createElement("input");
          cb.type = "checkbox";
          cb.checked = selected.has(opt.en) || selected.has(opt.zh);
          cb.addEventListener("change", () => {
            const next = new Set(answerOf(f.ref).options || []);
            if (cb.checked) next.add(key);
            else {
              next.delete(opt.en);
              next.delete(opt.zh);
              next.delete(key);
            }
            patch(f.ref, { options: [...next] });
          });
          lab.appendChild(cb);
          lab.appendChild(document.createTextNode(opt.zh || opt.en || key));
          wrap.appendChild(lab);
        });
        grid.appendChild(wrap);
      }

      if (f.answerType === "continuous") {
        const opts = (f.options || []).length
          ? f.options
          : [{ zh: "數值", en: "Value" }];
        opts.forEach((opt, i) => {
          const lab = document.createElement("label");
          lab.textContent = opt.zh || opt.en || `v${i}`;
          const input = document.createElement("input");
          input.type = "text";
          input.inputMode = "decimal";
          input.value = (ans.values && ans.values[`v${i}`]) || "";
          input.addEventListener("change", () => {
            const values = { ...(answerOf(f.ref).values || {}) };
            values[`v${i}`] = input.value;
            patch(f.ref, { values });
          });
          lab.appendChild(input);
          grid.appendChild(lab);
        });
      }

      if (portal.hasPolicyCreated) {
        const lab = document.createElement("label");
        lab.textContent = "Policy created (yyyy)";
        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "e.g. 2022";
        input.value = ans.policyCreated || "";
        input.addEventListener("change", () => patch(f.ref, { policyCreated: input.value }));
        lab.appendChild(input);
        grid.appendChild(lab);
      }
      if (portal.hasPolicyReviewed) {
        const lab = document.createElement("label");
        lab.textContent = "Policy reviewed (yyyy)";
        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "e.g. 2024";
        input.value = ans.policyReviewed || "";
        input.addEventListener("change", () => patch(f.ref, { policyReviewed: input.value }));
        lab.appendChild(input);
        grid.appendChild(lab);
      }

      if (portal.hasEvidence !== false) {
        const lab = document.createElement("label");
        lab.textContent = "Evidence URL";
        const input = document.createElement("input");
        input.type = "url";
        input.placeholder = "https://…";
        input.value = ans.evidence || "";
        input.addEventListener("change", () => patch(f.ref, { evidence: input.value }));
        lab.appendChild(input);
        grid.appendChild(lab);
      }

      if (portal.hasPublic) {
        const lab = document.createElement("label");
        lab.textContent = "Public / Private / Undefined";
        const sel = document.createElement("select");
        sel.innerHTML =
          '<option value="">—</option><option value="public">Public</option><option value="private">Private</option><option value="undefined">Undefined</option>';
        sel.value = ans.public || "";
        sel.addEventListener("change", () => patch(f.ref, { public: sel.value }));
        lab.appendChild(sel);
        grid.appendChild(lab);
      }

      if (
        portal.hasComment ||
        f.answerType === "yesno" ||
        f.answerType === "picklist" ||
        portal.hasPolicyCreated
      ) {
        const lab = document.createElement("label");
        lab.textContent = "Comments（最多 1000 字）";
        const ta = document.createElement("textarea");
        ta.maxLength = 1000;
        ta.value = ans.comment || "";
        ta.addEventListener("change", () => patch(f.ref, { comment: ta.value }));
        lab.appendChild(ta);
        grid.appendChild(lab);
      }

      card.appendChild(grid);
      fieldList.appendChild(card);
    });
  }

  async function loadRemote() {
    const { store, doc, getDoc } = await getDb();
    const snap = await getDoc(doc(store, "portalFill", "impact2027"));
    remote = snap.exists() ? snap.data().answers || {} : {};
  }

  async function saveAll() {
    const btn = $("#btnSave");
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = "儲存中…";
    try {
      const { store, doc, setDoc } = await getDb();
      const merged = { ...remote };
      Object.keys(drafts).forEach((ref) => {
        merged[ref] = { ...(merged[ref] || {}), ...drafts[ref] };
      });
      await setDoc(
        doc(store, "portalFill", "impact2027"),
        {
          answers: merged,
          updatedAt: new Date().toISOString(),
          updatedBy: (window.__portalUserEmail || "").slice(0, 80),
        },
        { merge: true }
      );
      remote = merged;
      Object.keys(drafts).forEach((k) => delete drafts[k]);
      banner("ok", "已儲存到 Portal 對齊資料（不影響單位填報）。");
    } catch (err) {
      banner("bad", `儲存失敗：${err && err.message ? err.message : err}`);
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  }

  $("#btnGoogle").addEventListener("click", async () => {
    showAuthError("");
    try {
      await THEAuth.signInWithGoogle();
    } catch (err) {
      if (err && err.message === "not_allowed") {
        showAuthError(`此帳號沒有權限：${err.email || ""}`);
      } else if (err && err.message === "missing_config") {
        showAuthError("尚未設定 Firebase。");
      } else {
        showAuthError("登入失敗，請再試一次。");
      }
    }
  });

  $("#btnSignOut").addEventListener("click", () => THEAuth.signOut());
  $("#btnSave").addEventListener("click", saveAll);

  THEAuth.onAuth(async (user, reason) => {
    if (!user) {
      app.hidden = true;
      authGate.hidden = false;
      if (reason === "not_allowed") showAuthError("此帳號不在白名單。");
      return;
    }
    showAuthError("");
    authGate.hidden = true;
    app.hidden = false;
    window.__portalUserEmail = user.email || "";
    $("#portalUser").textContent = user.email || "";
    try {
      await loadRemote();
    } catch (err) {
      banner("warn", `讀取雲端草稿失敗，仍可先填；儲存時再試。${err && err.message ? err.message : ""}`);
    }
    renderTabs();
    renderFields();
  });
})();
