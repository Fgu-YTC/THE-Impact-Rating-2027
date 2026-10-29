/** Portal-aligned fill page — reads unit fill for reference/import; writes only portalFill */
(async function () {
  const $ = (sel) => document.querySelector(sel);
  const authGate = $("#authGate");
  const app = $("#portalApp");
  const authError = $("#authError");
  const fieldList = $("#fieldList");
  const sdgTabs = $("#sdgTabs");
  const saveBanner = $("#saveBanner");
  let lang = window.THEUI ? THEUI.getLang() : "zh";

  const I18N = {
    zh: {
      title: "THE Impact 2027 · Portal 對齊填報",
      brand: "Portal 對齊填報",
      authHint:
        "使用學校 Google 帳號登入。此頁依 WUR Portal 欄位排列，並對齊本站題目、今年單位填報與去年參考；與一般填報頁、管理分派分開儲存。",
      btnGoogle: "使用 Google 登入",
      authLinks: '<a href="index.html">填報頁</a> · <a href="admin.html">管理頁</a>',
      note:
        "依 <strong>WUR Portal</strong> 題列填寫；會顯示本站今年單位填報／最終稿與去年參考。「帶入今年填報」只填空欄；資料存在 <code>portalFill</code>，不改單位填報。",
      importLive: "帶入今年填報",
      importLiveTitle: "只填 Portal 尚空的欄位",
      importAll: "覆蓋帶入",
      importAllTitle: "用今年填報覆蓋 Portal 欄位",
      importAllConfirm: "要用目前填報覆蓋 Portal 已填欄位嗎？（仍不會改到單位填報頁）",
      save: "儲存本頁",
      saving: "儲存中…",
      signOut: "登出",
      notAllowed: "此帳號不在白名單。",
      noPermission: (email) => `此帳號沒有權限：${email || ""}`,
      missingConfig: "尚未設定 Firebase。",
      loginFail: "登入失敗，請再試一次。",
      loadDraftWarn: (msg) => `讀取雲端草稿失敗，仍可先填；儲存時再試。${msg || ""}`,
      loadUnitsWarn: (msg) => `讀取單位失敗。${msg || ""}`,
      loadAnswersWarn: (msg) => `讀取填報失敗。${msg || ""}`,
      saved: "已儲存到 Portal 對齊資料（不影響單位填報）。",
      saveFail: (msg) => `儲存失敗：${msg}`,
      imported: (n) => `已帶入 ${n} 題目前填報內容到 Portal 欄位（尚未按儲存）。`,
      importEmpty: "沒有可帶入的空欄（可能尚未填報，或 Portal 已有內容）。",
      importNone: "目前沒有可對齊的填報內容。",
      meta: (sdg, total, aligned, live) =>
        `Impact 2027 · SDG ${sdg} · ${total} 欄（對齊 ${aligned}｜今年填報有內容 ${live}）`,
      aligned: "已對齊本站題目",
      unaligned: "Portal 多出／子欄",
      liveBadge: "今年填報有內容",
      liveTitle: "今年填報（本站單位／最終稿）",
      priorTitle: "去年參考（prior-year）",
      officeTag: "永續辦／最終",
      unitTag: "單位",
      hasContent: "有內容",
      numbers: "數字",
      checked: (n) => `勾選 ${n} 項`,
      publicBit: "公開",
      privateBit: "不公開",
      hasComment: "有備註",
      publicUrl: "公開網址",
      downloadFile: (name) => (name ? `下載檔案：${name}` : "下載已上傳檔案"),
      fileOnly: (name) => `檔案：${name}`,
      liveFile: (name) => (name ? `今年填報檔案：${name}` : "下載今年填報檔案"),
      priorYesNo: (v) => `是／否：${v === "yes" ? "是" : v === "no" ? "否" : v}`,
      priorNumbers: "數字：",
      priorValue: "值",
      priorEvidence: "證據網址有",
      priorFile: (name) => `檔案：${name || "有"}`,
      priorNote: "備註有",
      yesNo: "是／否",
      evidenceUrl: "證據網址（公開網頁；勿貼 Storage 下載網址）",
      evidenceWarn: "請填公開網頁網址；已上傳檔案請用下方下載連結，不要貼 Firebase Storage 網址。",
      publicLabel: "公開／不公開／未定",
      comments: "備註（最多 1000 字）",
      policyCreated: "政策訂定年（yyyy）",
      policyReviewed: "政策檢討年（yyyy）",
      valueFallback: "數值",
    },
    en: {
      title: "THE Impact 2027 · Portal-aligned fill",
      brand: "Portal-aligned fill",
      authHint:
        "Sign in with your university Google account. This page follows WUR Portal fields and aligns site questions, this year’s unit fill, and last-year reference. It is stored separately from the fill and admin pages.",
      btnGoogle: "Sign in with Google",
      authLinks: '<a href="index.html">Fill page</a> · <a href="admin.html">Admin</a>',
      note:
        "Fill by <strong>WUR Portal</strong> rows. This year’s unit/final answers and last-year reference are shown. “Import this year” only fills empty fields. Data is stored in <code>portalFill</code> and does not change unit fill.",
      importLive: "Import this year",
      importLiveTitle: "Fill empty Portal fields only",
      importAll: "Overwrite import",
      importAllTitle: "Overwrite Portal fields with this year’s fill",
      importAllConfirm:
        "Overwrite filled Portal fields with this year’s answers? (Unit fill page is not changed.)",
      save: "Save this page",
      saving: "Saving…",
      signOut: "Sign out",
      notAllowed: "This account is not on the allowlist.",
      noPermission: (email) => `This account is not allowed: ${email || ""}`,
      missingConfig: "Firebase is not configured.",
      loginFail: "Sign-in failed. Please try again.",
      loadDraftWarn: (msg) => `Could not load cloud draft; you can still fill and retry save. ${msg || ""}`,
      loadUnitsWarn: (msg) => `Could not load units. ${msg || ""}`,
      loadAnswersWarn: (msg) => `Could not load answers. ${msg || ""}`,
      saved: "Saved to Portal-aligned data (unit fill unchanged).",
      saveFail: (msg) => `Save failed: ${msg}`,
      imported: (n) => `Imported ${n} questions into Portal fields (not saved yet).`,
      importEmpty: "No empty fields to import (nothing filled yet, or Portal already has content).",
      importNone: "No aligned fill content to import.",
      meta: (sdg, total, aligned, live) =>
        `Impact 2027 · SDG ${sdg} · ${total} fields (aligned ${aligned} · this year ${live})`,
      aligned: "Aligned to site question",
      unaligned: "Portal-only / sub-field",
      liveBadge: "This year has content",
      liveTitle: "This year (unit / final)",
      priorTitle: "Last year (prior-year)",
      officeTag: "Office / final",
      unitTag: "Unit",
      hasContent: "has content",
      numbers: "Numbers",
      checked: (n) => `${n} selected`,
      publicBit: "Public",
      privateBit: "Private",
      hasComment: "has comments",
      publicUrl: "Public URL",
      downloadFile: (name) => (name ? `Download file: ${name}` : "Download uploaded file"),
      fileOnly: (name) => `File: ${name}`,
      liveFile: (name) => (name ? `This year’s file: ${name}` : "Download this year’s file"),
      priorYesNo: (v) => `Yes/No: ${v === "yes" ? "Yes" : v === "no" ? "No" : v}`,
      priorNumbers: "Numbers: ",
      priorValue: "Value",
      priorEvidence: "Evidence URL",
      priorFile: (name) => `File: ${name || "yes"}`,
      priorNote: "has comments",
      yesNo: "Yes / No",
      evidenceUrl: "Evidence URL (public page; do not paste Storage download URLs)",
      evidenceWarn:
        "Use a public webpage URL. For uploaded files, use the download link below — do not paste Firebase Storage URLs.",
      publicLabel: "Public / Private / Undefined",
      comments: "Comments (max 1000 characters)",
      policyCreated: "Policy created (yyyy)",
      policyReviewed: "Policy reviewed (yyyy)",
      valueFallback: "Value",
    },
  };

  function t(key, ...args) {
    const pack = I18N[lang] || I18N.zh;
    const v = pack[key];
    return typeof v === "function" ? v(...args) : v;
  }

  function showAuthError(msg) {
    authError.hidden = !msg;
    authError.textContent = msg || "";
  }

  function banner(kind, text) {
    saveBanner.hidden = false;
    saveBanner.className = "submit-banner " + (kind || "");
    saveBanner.textContent = text;
  }

  function applyChrome() {
    document.documentElement.lang = lang === "en" ? "en" : "zh-Hant";
    document.title = t("title");
    const setText = (sel, key) => {
      const el = $(sel);
      if (el) el.textContent = t(key);
    };
    const setHtml = (sel, key) => {
      const el = $(sel);
      if (el) el.innerHTML = t(key);
    };
    setText("#authTitle", "brand");
    setText("#authHint", "authHint");
    setText("#btnGoogle", "btnGoogle");
    setHtml("#authLinks", "authLinks");
    setText("#portalBrand", "brand");
    setHtml("#portalNote", "note");
    const btnImport = $("#btnImportLive");
    if (btnImport) {
      btnImport.textContent = t("importLive");
      btnImport.title = t("importLiveTitle");
    }
    const btnImportAll = $("#btnImportLiveAll");
    if (btnImportAll) {
      btnImportAll.textContent = t("importAll");
      btnImportAll.title = t("importAllTitle");
    }
    setText("#btnSave", "save");
    setText("#btnSignOut", "signOut");
  }

  const [portalPack, priorYear] = await Promise.all([
    fetch("data/portal-questions.json").then((r) => r.json()),
    fetch("data/prior-year.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
  ]);
  const fields = portalPack.fields || [];
  let currentSdg = fields[0] ? fields[0].sdg : 1;
  const drafts = {};
  let remote = {};
  let units = [];
  let answersByUnit = {};
  let officeByUnit = {};
  const officeStops = [];
  let liveReady = false;
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
    return sanitizePortalAnswer({ ...(remote[ref] || {}), ...(drafts[ref] || {}) });
  }

  function patch(ref, part) {
    drafts[ref] = { ...(drafts[ref] || {}), ...part };
  }

  function isStorageUrl(href) {
    const s = String(href || "").trim().toLowerCase();
    if (!s) return false;
    return (
      s.includes("firebasestorage.googleapis.com") ||
      s.includes(".firebasestorage.app/") ||
      s.includes("storage.googleapis.com/")
    );
  }

  /** Portal Evidence URL：只放公開網頁；Storage 下載網址不當成網址欄 */
  function publicEvidenceUrl(href) {
    const s = String(href || "").trim();
    if (!s || isStorageUrl(s)) return "";
    return s;
  }

  function fileDownloadLabel(answer) {
    const name = String((answer && answer.evidenceFileName) || "").trim();
    return t("downloadFile", name);
  }

  function optLabel(opt) {
    if (!opt) return "";
    return lang === "en" ? opt.en || opt.zh || "" : opt.zh || opt.en || "";
  }

  function fileDownloadHref(answer) {
    if (!answer) return "";
    const direct = String(answer.evidenceFileUrl || "").trim();
    if (direct) return direct;
    if (isStorageUrl(answer.evidence)) return String(answer.evidence).trim();
    return "";
  }

  function sanitizePortalAnswer(a) {
    if (!a) return a;
    const out = { ...a };
    const raw = String(out.evidence || "").trim();
    if (isStorageUrl(raw)) {
      if (!out.evidenceFileUrl) out.evidenceFileUrl = raw;
      out.evidence = "";
    } else {
      out.evidence = publicEvidenceUrl(raw);
    }
    return out;
  }

  function answerHasContent(a) {
    if (!a) return false;
    if (a.yesNo || a.public) return true;
    if (String(a.comment || "").trim()) return true;
    if (publicEvidenceUrl(a.evidence)) return true;
    if (a.evidenceFileUrl || a.evidenceFileName || isStorageUrl(a.evidence)) return true;
    if (Array.isArray(a.options) && a.options.length) return true;
    const values = a.values || {};
    return Object.values(values).some((v) => v != null && String(v) !== "");
  }

  function liveForRef(ref) {
    const field = fields.find((f) => f.ref === ref);
    const qid = field && field.siteQuestionId;
    if (!qid) return null;
    const hits = [];
    units.forEach((u) => {
      const office = (officeByUnit[u.id] || {})[qid];
      const ans = (answersByUnit[u.id] || {})[qid];
      if (office && answerHasContent(office)) {
        hits.push({ unitId: u.id, unitName: u.name, answer: office, kind: "office" });
      } else if (ans && answerHasContent(ans)) {
        hits.push({ unitId: u.id, unitName: u.name, answer: ans, kind: "unit" });
      }
    });
    if (!hits.length) return null;
    const preferred =
      hits.find((h) => h.kind === "office" && /永續/.test(h.unitName)) ||
      hits.find((h) => h.kind === "office") ||
      hits[0];
    return { preferred, all: hits };
  }

  function summarizeAnswerBits(answer) {
    if (!answer) return [];
    const bits = [];
    if (answer.yesNo === "yes") bits.push("Yes");
    if (answer.yesNo === "no") bits.push("No");
    if (answer.values) {
      const vals = Object.keys(answer.values)
        .sort()
        .map((k) => answer.values[k])
        .filter((v) => v != null && String(v) !== "");
      if (vals.length) bits.push(t("numbers") + " " + vals.slice(0, 4).join("／"));
    }
    if (answer.options && answer.options.length) bits.push(t("checked", answer.options.length));
    if (answer.public === "public") bits.push(t("publicBit"));
    if (answer.public === "private") bits.push(t("privateBit"));
    if (String(answer.comment || "").trim()) bits.push(t("hasComment"));
    return bits;
  }

  function appendEvidenceLinks(parent, answer) {
    const url = publicEvidenceUrl(answer && answer.evidence);
    const fileHref = fileDownloadHref(answer);
    const fileName = String((answer && answer.evidenceFileName) || "").trim();
    if (url) {
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener";
      a.className = "portal-ev-link";
      try {
        a.textContent = t("publicUrl") + "：" + new URL(url).hostname;
      } catch (_) {
        a.textContent = t("publicUrl");
      }
      parent.appendChild(a);
    }
    if (fileHref || fileName) {
      if (fileHref) {
        const a = document.createElement("a");
        a.href = fileHref;
        a.target = "_blank";
        a.rel = "noopener";
        a.className = "portal-ev-link";
        a.textContent = fileDownloadLabel(answer);
        if (fileName) a.setAttribute("download", fileName);
        parent.appendChild(a);
      } else {
        const span = document.createElement("span");
        span.textContent = t("fileOnly", fileName);
        parent.appendChild(span);
      }
    }
  }

  function priorSummary(ref) {
    const data = priorYear[ref];
    if (!data) return "";
    const bits = [];
    if (data.yesNo) bits.push(t("priorYesNo", data.yesNo));
    if (Array.isArray(data.values) && data.values.length) {
      bits.push(
        t("priorNumbers") +
          data.values
            .map((v) => `${(v.label || "").split("\n")[0] || t("priorValue")}=${v.value}`)
            .slice(0, 4)
            .join(lang === "en" ? "; " : "；")
      );
    }
    if (Array.isArray(data.evidence) && data.evidence[0]) bits.push(t("priorEvidence"));
    if (Array.isArray(data.files) && data.files[0]) bits.push(t("priorFile", data.files[0].name));
    if (data.note) bits.push(t("priorNote"));
    return bits.join(" · ");
  }

  function appendLiveBox(card, ref) {
    const pack = liveForRef(ref);
    if (!pack) return;
    const box = document.createElement("div");
    box.className = "portal-prior portal-live";
    const title = document.createElement("strong");
    title.textContent = t("liveTitle");
    box.appendChild(title);
    pack.all.forEach((h) => {
      const line = document.createElement("div");
      line.className = "portal-live-line";
      const tag = h.kind === "office" ? t("officeTag") : t("unitTag");
      const bits = summarizeAnswerBits(h.answer);
      const head = document.createElement("span");
      head.textContent =
        `${h.unitName}（${tag}）` + (bits.length ? `：${bits.join(" · ")}` : `：${t("hasContent")}`);
      line.appendChild(head);
      const links = document.createElement("div");
      links.className = "portal-live-links";
      appendEvidenceLinks(links, h.answer);
      if (links.childNodes.length) line.appendChild(links);
      box.appendChild(line);
    });
    card.appendChild(box);
  }

  function portalEmpty(ref) {
    const a = answerOf(ref);
    return !answerHasContent(a) && !a.policyCreated && !a.policyReviewed;
  }

  function fromLiveAnswer(answer) {
    if (!answer) return null;
    const out = {};
    if (answer.yesNo) out.yesNo = answer.yesNo;
    if (answer.public) out.public = answer.public;
    if (String(answer.comment || "").trim()) out.comment = String(answer.comment).slice(0, 1000);
    const pub = publicEvidenceUrl(answer.evidence);
    if (pub) out.evidence = pub;
    else out.evidence = "";
    if (answer.evidenceFileName) out.evidenceFileName = String(answer.evidenceFileName);
    if (answer.evidenceFileUrl) out.evidenceFileUrl = String(answer.evidenceFileUrl);
    else if (isStorageUrl(answer.evidence)) out.evidenceFileUrl = String(answer.evidence).trim();
    if (answer.values && typeof answer.values === "object") out.values = { ...answer.values };
    if (Array.isArray(answer.options)) out.options = answer.options.slice();
    return out;
  }

  function importLive({ onlyEmpty }) {
    let n = 0;
    fields.forEach((f) => {
      if (!f.siteQuestionId) return;
      if (onlyEmpty && !portalEmpty(f.ref)) return;
      const pack = liveForRef(f.ref);
      if (!pack) return;
      const mapped = fromLiveAnswer(pack.preferred.answer);
      if (!mapped || !Object.keys(mapped).length) return;
      if (onlyEmpty) {
        const cur = answerOf(f.ref);
        const next = { ...mapped };
        Object.keys(next).forEach((k) => {
          if (k === "values") {
            const merged = { ...(cur.values || {}) };
            let added = false;
            Object.keys(next.values || {}).forEach((vk) => {
              if (merged[vk] == null || String(merged[vk]) === "") {
                merged[vk] = next.values[vk];
                added = true;
              }
            });
            if (added) next.values = merged;
            else delete next.values;
          } else if (cur[k] != null && String(cur[k]) !== "") {
            delete next[k];
          }
        });
        if (!Object.keys(next).length) return;
        patch(f.ref, next);
      } else {
        patch(f.ref, mapped);
      }
      n += 1;
    });
    renderFields();
    banner(n ? "ok" : "warn", n ? t("imported", n) : onlyEmpty ? t("importEmpty") : t("importNone"));
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
    const liveCount = mine.filter((f) => liveForRef(f.ref)).length;
    $("#portalMeta").textContent = t(
      "meta",
      currentSdg,
      mine.length,
      mine.filter((f) => f.aligned).length,
      liveCount
    );
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
      badge.textContent = f.aligned ? t("aligned") : t("unaligned");
      head.appendChild(badge);
      if (liveForRef(f.ref)) {
        const liveBadge = document.createElement("span");
        liveBadge.className = "portal-badge live";
        liveBadge.textContent = t("liveBadge");
        head.appendChild(liveBadge);
      }
      card.appendChild(head);

      const primary = document.createElement("div");
      primary.className = "portal-en";
      primary.textContent = (lang === "en" ? f.en || f.zh : f.zh || f.en) || "";
      card.appendChild(primary);
      const secondaryText = lang === "en" ? f.zh : f.en;
      if (secondaryText && secondaryText !== primary.textContent) {
        const secondary = document.createElement("div");
        secondary.className = "portal-zh";
        secondary.textContent = secondaryText;
        card.appendChild(secondary);
      }

      appendLiveBox(card, f.ref);

      const prior = priorSummary(f.ref);
      if (prior) {
        const box = document.createElement("div");
        box.className = "portal-prior";
        const strong = document.createElement("strong");
        strong.textContent = t("priorTitle");
        box.appendChild(strong);
        box.appendChild(document.createTextNode(prior));
        card.appendChild(box);
      }

      const grid = document.createElement("div");
      grid.className = "portal-grid";
      const portal = f.portal || {};

      if (portal.hasYesNo || f.answerType === "yesno" || f.answerType === "picklist") {
        const lab = document.createElement("label");
        lab.textContent = t("yesNo");
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
          lab.appendChild(document.createTextNode(optLabel(opt) || key));
          wrap.appendChild(lab);
        });
        grid.appendChild(wrap);
      }

      if (f.answerType === "continuous") {
        const opts = (f.options || []).length
          ? f.options
          : [{ zh: I18N.zh.valueFallback, en: I18N.en.valueFallback }];
        opts.forEach((opt, i) => {
          const lab = document.createElement("label");
          lab.textContent = optLabel(opt) || `v${i}`;
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
        lab.textContent = t("policyCreated");
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
        lab.textContent = t("policyReviewed");
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
        lab.textContent = t("evidenceUrl");
        const input = document.createElement("input");
        input.type = "url";
        input.placeholder = "https://…";
        input.value = publicEvidenceUrl(ans.evidence) || "";
        input.addEventListener("change", () => {
          const next = publicEvidenceUrl(input.value);
          if (input.value.trim() && !next) {
            banner("warn", t("evidenceWarn"));
            input.value = "";
          }
          patch(f.ref, { evidence: next });
        });
        lab.appendChild(input);
        const fileHref = fileDownloadHref(ans);
        const livePack = liveForRef(f.ref);
        const liveFileHref = livePack ? fileDownloadHref(livePack.preferred.answer) : "";
        const liveFileName = livePack
          ? String(livePack.preferred.answer.evidenceFileName || "").trim()
          : "";
        if (fileHref || ans.evidenceFileName) {
          const a = document.createElement("a");
          a.className = "portal-ev-link";
          a.target = "_blank";
          a.rel = "noopener";
          a.href = fileHref || "#";
          if (!fileHref) a.removeAttribute("href");
          a.textContent = fileDownloadLabel(ans);
          if (ans.evidenceFileName) a.setAttribute("download", ans.evidenceFileName);
          lab.appendChild(a);
        } else if (liveFileHref || liveFileName) {
          const a = document.createElement("a");
          a.className = "portal-ev-link";
          a.target = "_blank";
          a.rel = "noopener";
          if (liveFileHref) a.href = liveFileHref;
          a.textContent = t("liveFile", liveFileName);
          if (liveFileName) a.setAttribute("download", liveFileName);
          lab.appendChild(a);
        }
        grid.appendChild(lab);
      }

      if (portal.hasPublic) {
        const lab = document.createElement("label");
        lab.textContent = t("publicLabel");
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
        lab.textContent = t("comments");
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

  function watchLive() {
    if (!window.THELive || liveReady) return;
    liveReady = true;
    THELive.listenUnits(
      (next) => {
        units = next || [];
        while (officeStops.length) {
          const stop = officeStops.pop();
          try {
            stop();
          } catch (_) {}
        }
        units.forEach((u) => {
          officeStops.push(
            THELive.listenUnitOffice(
              u.id,
              (map) => {
                officeByUnit = { ...officeByUnit, [u.id]: map || {} };
                if (!app.hidden) renderFields();
              },
              () => {}
            )
          );
        });
        if (!app.hidden) renderFields();
      },
      (err) => banner("warn", t("loadUnitsWarn", THELive.explain(err)))
    );
    THELive.listenAllAnswers(
      (packs) => {
        const next = {};
        (packs || []).forEach((p) => {
          next[p.unitId] = p.answers || {};
        });
        answersByUnit = next;
        if (!app.hidden) renderFields();
      },
      (err) => banner("warn", t("loadAnswersWarn", THELive.explain(err)))
    );
  }

  async function loadRemote() {
    const { store, doc, getDoc } = await getDb();
    const snap = await getDoc(doc(store, "portalFill", "impact2027"));
    const raw = snap.exists() ? snap.data().answers || {} : {};
    remote = {};
    Object.keys(raw).forEach((ref) => {
      remote[ref] = sanitizePortalAnswer(raw[ref] || {});
    });
  }

  async function saveAll() {
    const btn = $("#btnSave");
    btn.disabled = true;
    btn.textContent = t("saving");
    try {
      const { store, doc, setDoc } = await getDb();
      const merged = { ...remote };
      Object.keys(drafts).forEach((ref) => {
        merged[ref] = sanitizePortalAnswer({ ...(merged[ref] || {}), ...drafts[ref] });
      });
      Object.keys(merged).forEach((ref) => {
        merged[ref] = sanitizePortalAnswer(merged[ref] || {});
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
      banner("ok", t("saved"));
    } catch (err) {
      banner("bad", t("saveFail", err && err.message ? err.message : err));
    } finally {
      btn.disabled = false;
      btn.textContent = t("save");
    }
  }

  function syncLangToggles() {
    document.querySelectorAll(".lang-toggle [data-lang]").forEach((b) => {
      b.classList.toggle("active", b.dataset.lang === lang);
    });
  }

  function onLangChange(next) {
    lang = next;
    syncLangToggles();
    applyChrome();
    if (!app.hidden) {
      renderTabs();
      renderFields();
    }
  }

  if (window.THEUI) {
    THEUI.bindLangToggle($("#langToggle"), onLangChange);
    THEUI.bindLangToggle($("#langToggleGate"), onLangChange);
  }
  syncLangToggles();
  applyChrome();

  $("#btnGoogle").addEventListener("click", async () => {
    showAuthError("");
    try {
      await THEAuth.signInWithGoogle();
    } catch (err) {
      if (err && err.message === "not_allowed") {
        showAuthError(t("noPermission", err.email || ""));
      } else if (err && err.message === "missing_config") {
        showAuthError(t("missingConfig"));
      } else {
        showAuthError(t("loginFail"));
      }
    }
  });

  $("#btnSignOut").addEventListener("click", () => THEAuth.signOut());
  $("#btnSave").addEventListener("click", saveAll);
  const btnImport = $("#btnImportLive");
  if (btnImport) {
    btnImport.addEventListener("click", () => importLive({ onlyEmpty: true }));
  }
  const btnImportAll = $("#btnImportLiveAll");
  if (btnImportAll) {
    btnImportAll.addEventListener("click", () => {
      if (!window.confirm(t("importAllConfirm"))) return;
      importLive({ onlyEmpty: false });
    });
  }

  THEAuth.onAuth(async (user, reason) => {
    if (!user) {
      app.hidden = true;
      authGate.hidden = false;
      applyChrome();
      if (reason === "not_allowed") showAuthError(t("notAllowed"));
      return;
    }
    showAuthError("");
    authGate.hidden = true;
    app.hidden = false;
    window.__portalUserEmail = user.email || "";
    $("#portalUser").textContent = user.email || "";
    applyChrome();
    try {
      await loadRemote();
    } catch (err) {
      banner("warn", t("loadDraftWarn", err && err.message ? err.message : ""));
    }
    watchLive();
    renderTabs();
    renderFields();
  });
})();
