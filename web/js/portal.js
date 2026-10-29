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
      importUrls: "帶入網址",
      importUrlsTitle: "把今年填報／去年參考的公開網址填進尚空的證據欄",
      importedUrls: (n) => `已帶入 ${n} 題公開網址到證據欄（尚未按儲存）。`,
      importedWithUrls: (n, urlN) =>
        `已帶入 ${n} 題目前填報內容到 Portal 欄位（另帶入 ${urlN} 題網址；尚未按儲存）。`,
      importUrlsEmpty: "沒有可帶入的公開網址（或證據欄已有內容）。",
      useThisUrl: "帶入此網址",
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
      evidenceMax: "提供證據（每題最多 1 項；網址或檔案擇一）",
      evidenceChoose: "選擇證據類型",
      evidenceTypeUrl: "網址：連到公開網頁／文件",
      evidenceTypeFile: "檔案：上傳一份證據檔（機密請於備註註明）",
      evidenceClear: "清除證據",
      evidencePending: (name) => `待上傳：${name}`,
      evidenceUploading: "上傳證據中…",
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
      importUrls: "Import URLs",
      importUrlsTitle: "Fill empty evidence fields with public URLs from this year / last year",
      importedUrls: (n) => `Imported ${n} public evidence URLs (not saved yet).`,
      importedWithUrls: (n, urlN) =>
        `Imported ${n} questions into Portal fields (plus ${urlN} evidence URLs; not saved yet).`,
      importUrlsEmpty: "No public URLs to import (or evidence fields already filled).",
      useThisUrl: "Use this URL",
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
      evidenceMax: "Provide Evidence (Maximum 1; URL or file)",
      evidenceChoose: "Choose Evidence Type",
      evidenceTypeUrl: "Url: Link to online evidence / document",
      evidenceTypeFile: "File: Upload one evidence file (mark confidential in comments)",
      evidenceClear: "Clear evidence",
      evidencePending: (name) => `Pending upload: ${name}`,
      evidenceUploading: "Uploading evidence…",
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
    const btnImportUrls = $("#btnImportUrls");
    if (btnImportUrls) {
      btnImportUrls.textContent = t("importUrls");
      btnImportUrls.title = t("importUrlsTitle");
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
  const pendingFiles = new Map();
  let remote = {};
  let units = [];
  let answersByUnit = {};
  let officeByUnit = {};
  const officeStops = [];
  let liveReady = false;
  let dbCtx = null;
  let storageCtx = null;

  function evidenceKindOf(ans, ref) {
    if (!ans) return "";
    if (ans.evidenceKind === "url" || ans.evidenceKind === "file") return ans.evidenceKind;
    if (publicEvidenceUrl(ans.evidence)) return "url";
    if (pendingFiles.has(ref) || ans.evidenceFileName || ans.evidenceFileUrl) return "file";
    return "";
  }

  function clearEvidenceFields(ref, keepKind) {
    pendingFiles.delete(ref);
    const next = {
      evidence: "",
      evidenceFileName: "",
      evidenceFileUrl: "",
      evidenceFilePath: "",
      evidenceStoredName: "",
    };
    if (keepKind) next.evidenceKind = keepKind;
    else next.evidenceKind = "";
    patch(ref, next);
  }

  function appendChoiceRow(parent, { name, type, value, checked, label, onChange }) {
    const lab = document.createElement("label");
    lab.className = "portal-choice";
    const input = document.createElement("input");
    input.type = type;
    input.name = name;
    input.value = value;
    input.checked = !!checked;
    input.addEventListener("change", onChange);
    lab.appendChild(input);
    lab.appendChild(document.createTextNode(label));
    parent.appendChild(lab);
    return lab;
  }

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
      if (!out.evidenceKind) out.evidenceKind = "file";
    } else {
      out.evidence = publicEvidenceUrl(raw);
    }
    if (out.evidenceKind === "url") {
      out.evidenceFileName = "";
      out.evidenceFileUrl = "";
      out.evidenceFilePath = "";
      out.evidenceStoredName = "";
    } else if (out.evidenceKind === "file") {
      out.evidence = "";
    } else if (out.evidence) {
      out.evidenceKind = "url";
    } else if (out.evidenceFileName || out.evidenceFileUrl) {
      out.evidenceKind = "file";
    }
    return out;
  }

  async function getStorage() {
    if (storageCtx) return storageCtx;
    const { initializeApp, getApps } = await import(
      "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"
    );
    const { getStorage, ref, uploadBytes, getDownloadURL } = await import(
      "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js"
    );
    const appInstance = getApps().length ? getApps()[0] : initializeApp(window.FIREBASE_CONFIG);
    storageCtx = { bucket: getStorage(appInstance), ref, uploadBytes, getDownloadURL };
    return storageCtx;
  }

  function safeFileName(name) {
    return String(name || "file").replace(/[\\/:*?"<>|#]/g, "_").trim() || "file";
  }

  async function uploadPendingEvidence(merged) {
    if (!pendingFiles.size) return;
    const { bucket, ref, uploadBytes, getDownloadURL } = await getStorage();
    for (const [refId, file] of pendingFiles.entries()) {
      if (!file) continue;
      const stored = `${Date.now()}_${safeFileName(file.name)}`;
      const path = `evidence/portal/${refId}/${stored}`;
      await uploadBytes(ref(bucket, path), file, {
        contentType: file.type || "application/octet-stream",
      });
      let url = "";
      try {
        url = await getDownloadURL(ref(bucket, path));
      } catch (_) {
        url = "";
      }
      merged[refId] = sanitizePortalAnswer({
        ...(merged[refId] || {}),
        evidenceKind: "file",
        evidence: "",
        evidenceFileName: file.name,
        evidenceStoredName: stored,
        evidenceFilePath: path,
        evidenceFileUrl: url,
      });
    }
    pendingFiles.clear();
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

  function priorPublicUrls(ref) {
    const data = priorYear[ref];
    if (!data) return [];
    const out = [];
    const push = (href) => {
      const u = publicEvidenceUrl(href);
      if (u && !out.includes(u)) out.push(u);
    };
    (Array.isArray(data.evidence) ? data.evidence : []).forEach(push);
    (Array.isArray(data.lines) ? data.lines : []).forEach((line) => {
      (Array.isArray(line.evidence) ? line.evidence : []).forEach(push);
    });
    return out;
  }

  function bestEvidenceUrl(ref) {
    const pack = liveForRef(ref);
    if (pack) {
      const live = publicEvidenceUrl(pack.preferred.answer && pack.preferred.answer.evidence);
      if (live) return live;
    }
    return priorPublicUrls(ref)[0] || "";
  }

  function applyEvidenceUrl(ref, url) {
    const next = publicEvidenceUrl(url);
    if (!next) return false;
    pendingFiles.delete(ref);
    patch(ref, {
      evidence: next,
      evidenceKind: "url",
      evidenceFileName: "",
      evidenceFileUrl: "",
      evidenceFilePath: "",
      evidenceStoredName: "",
    });
    return true;
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
    const urls = priorPublicUrls(ref);
    if (urls.length) {
      try {
        bits.push(t("priorEvidence") + "：" + new URL(urls[0]).hostname);
      } catch (_) {
        bits.push(t("priorEvidence"));
      }
    }
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
    if (pub) {
      out.evidence = pub;
      out.evidenceKind = "url";
      out.evidenceFileName = "";
      out.evidenceFileUrl = "";
      out.evidenceFilePath = "";
      out.evidenceStoredName = "";
    } else {
      out.evidence = "";
      if (answer.evidenceFileName) out.evidenceFileName = String(answer.evidenceFileName);
      if (answer.evidenceFileUrl) out.evidenceFileUrl = String(answer.evidenceFileUrl);
      else if (isStorageUrl(answer.evidence)) out.evidenceFileUrl = String(answer.evidence).trim();
      if (out.evidenceFileName || out.evidenceFileUrl) out.evidenceKind = "file";
      else out.evidenceKind = "";
    }
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
      if (!publicEvidenceUrl(mapped.evidence)) {
        const priorUrl = priorPublicUrls(f.ref)[0];
        if (priorUrl) {
          mapped.evidence = priorUrl;
          mapped.evidenceKind = "url";
          mapped.evidenceFileName = "";
          mapped.evidenceFileUrl = "";
          mapped.evidenceFilePath = "";
          mapped.evidenceStoredName = "";
        }
      }
      if (
        f.answerType === "picklist" &&
        (f.portal || {}).optionSelect === "single" &&
        Array.isArray(mapped.options) &&
        mapped.options.length > 1
      ) {
        mapped.options = mapped.options.slice(0, 1);
      }
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
    // 即使其他欄已有內容，仍把尚空的公開網址帶進證據欄
    const urlN = importEvidenceUrls({ onlyEmpty: true, silent: true });
    renderFields();
    banner(
      n || urlN ? "ok" : "warn",
      n && urlN
        ? t("importedWithUrls", n, urlN)
        : n
          ? t("imported", n)
          : urlN
            ? t("importedUrls", urlN)
            : onlyEmpty
              ? t("importEmpty")
              : t("importNone")
    );
  }

  function importEvidenceUrls({ onlyEmpty = true, silent = false } = {}) {
    let n = 0;
    fields.forEach((f) => {
      if ((f.portal || {}).hasEvidence === false) return;
      const cur = answerOf(f.ref);
      if (onlyEmpty) {
        if (publicEvidenceUrl(cur.evidence)) return;
        if (cur.evidenceKind === "file" && (cur.evidenceFileName || cur.evidenceFileUrl || pendingFiles.has(f.ref))) {
          return;
        }
      }
      const url = bestEvidenceUrl(f.ref);
      if (!url) return;
      if (applyEvidenceUrl(f.ref, url)) n += 1;
    });
    if (!silent) {
      renderFields();
      banner(n ? "ok" : "warn", n ? t("importedUrls", n) : t("importUrlsEmpty"));
    }
    return n;
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
        const wrap = document.createElement("div");
        wrap.className = "portal-choice-group";
        const caption = document.createElement("div");
        caption.className = "portal-field-label";
        caption.textContent = t("yesNo");
        wrap.appendChild(caption);
        const row = document.createElement("div");
        row.className = "portal-choice-row";
        ["yes", "no"].forEach((val) => {
          appendChoiceRow(row, {
            name: `yn-${f.ref}`,
            type: "radio",
            value: val,
            checked: ans.yesNo === val,
            label: val === "yes" ? "Yes" : "No",
            onChange: () => patch(f.ref, { yesNo: val }),
          });
        });
        wrap.appendChild(row);
        grid.appendChild(wrap);
      }

      if (f.answerType === "picklist" && (f.options || []).length) {
        const wrap = document.createElement("div");
        wrap.className = "portal-choice-group";
        const row = document.createElement("div");
        const selected = new Set(ans.options || []);
        const single = (portal.optionSelect || "multi") === "single";
        row.className = "portal-choice-row portal-opts" + (single ? "" : " portal-opts-multi");
        f.options.forEach((opt) => {
          const key = opt.en || opt.zh;
          const checked =
            selected.has(opt.en) || selected.has(opt.zh) || selected.has(key);
          appendChoiceRow(row, {
            name: `opt-${f.ref}`,
            type: single ? "radio" : "checkbox",
            value: key,
            checked,
            label: optLabel(opt) || key,
            onChange: (ev) => {
              if (single) {
                patch(f.ref, { options: ev.target.checked ? [key] : [] });
                return;
              }
              const next = new Set(answerOf(f.ref).options || []);
              if (ev.target.checked) next.add(key);
              else {
                next.delete(opt.en);
                next.delete(opt.zh);
                next.delete(key);
              }
              patch(f.ref, { options: [...next] });
            },
          });
        });
        wrap.appendChild(row);
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

      if (portal.hasEvidence) {
        const wrap = document.createElement("div");
        wrap.className = "portal-evidence";
        const caption = document.createElement("div");
        caption.className = "portal-field-label";
        caption.textContent = t("evidenceMax");
        wrap.appendChild(caption);

        const kind = evidenceKindOf(ans, f.ref);
        const typeRow = document.createElement("div");
        typeRow.className = "portal-choice-row";
        appendChoiceRow(typeRow, {
          name: `evkind-${f.ref}`,
          type: "radio",
          value: "url",
          checked: kind === "url",
          label: t("evidenceTypeUrl"),
          onChange: () => {
            clearEvidenceFields(f.ref, "url");
            const suggest = bestEvidenceUrl(f.ref);
            if (suggest) applyEvidenceUrl(f.ref, suggest);
            renderFields();
          },
        });
        appendChoiceRow(typeRow, {
          name: `evkind-${f.ref}`,
          type: "radio",
          value: "file",
          checked: kind === "file",
          label: t("evidenceTypeFile"),
          onChange: () => {
            clearEvidenceFields(f.ref, "file");
            renderFields();
          },
        });
        wrap.appendChild(typeRow);

        const body = document.createElement("div");
        body.className = "portal-evidence-body";
        if (kind === "url") {
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
            patch(f.ref, { evidence: next, evidenceKind: "url" });
          });
          body.appendChild(input);
          if (!publicEvidenceUrl(ans.evidence)) {
            const suggest = bestEvidenceUrl(f.ref);
            if (suggest) {
              const btn = document.createElement("button");
              btn.type = "button";
              btn.className = "secondary portal-ev-clear";
              try {
                btn.textContent = `${t("useThisUrl")}（${new URL(suggest).hostname}）`;
              } catch (_) {
                btn.textContent = t("useThisUrl");
              }
              btn.addEventListener("click", () => {
                applyEvidenceUrl(f.ref, suggest);
                renderFields();
              });
              body.appendChild(btn);
            }
          }
        } else if (kind === "file") {
          const pending = pendingFiles.get(f.ref);
          const fileHref = fileDownloadHref(ans);
          if (pending) {
            const tip = document.createElement("div");
            tip.className = "portal-ev-pending";
            tip.textContent = t("evidencePending", pending.name);
            body.appendChild(tip);
          } else if (fileHref || ans.evidenceFileName) {
            const a = document.createElement("a");
            a.className = "portal-ev-link";
            a.target = "_blank";
            a.rel = "noopener";
            if (fileHref) a.href = fileHref;
            a.textContent = fileDownloadLabel(ans);
            if (ans.evidenceFileName) a.setAttribute("download", ans.evidenceFileName);
            body.appendChild(a);
          } else {
            const livePack = liveForRef(f.ref);
            const liveFileHref = livePack ? fileDownloadHref(livePack.preferred.answer) : "";
            const liveFileName = livePack
              ? String(livePack.preferred.answer.evidenceFileName || "").trim()
              : "";
            if (liveFileHref || liveFileName) {
              const a = document.createElement("a");
              a.className = "portal-ev-link";
              a.target = "_blank";
              a.rel = "noopener";
              if (liveFileHref) a.href = liveFileHref;
              a.textContent = t("liveFile", liveFileName);
              if (liveFileName) a.setAttribute("download", liveFileName);
              body.appendChild(a);
            }
          }
          const file = document.createElement("input");
          file.type = "file";
          file.addEventListener("change", () => {
            const chosen = file.files && file.files[0];
            if (!chosen) return;
            pendingFiles.set(f.ref, chosen);
            patch(f.ref, {
              evidenceKind: "file",
              evidence: "",
              evidenceFileName: chosen.name,
              evidenceFileUrl: "",
              evidenceFilePath: "",
              evidenceStoredName: "",
            });
            renderFields();
          });
          body.appendChild(file);
        }
        if (kind) {
          const clearBtn = document.createElement("button");
          clearBtn.type = "button";
          clearBtn.className = "secondary portal-ev-clear";
          clearBtn.textContent = t("evidenceClear");
          clearBtn.addEventListener("click", () => {
            clearEvidenceFields(f.ref, "");
            renderFields();
          });
          body.appendChild(clearBtn);
        } else {
          const suggest = bestEvidenceUrl(f.ref);
          if (suggest) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "secondary portal-ev-clear";
            try {
              btn.textContent = `${t("useThisUrl")}（${new URL(suggest).hostname}）`;
            } catch (_) {
              btn.textContent = t("useThisUrl");
            }
            btn.addEventListener("click", () => {
              applyEvidenceUrl(f.ref, suggest);
              renderFields();
            });
            body.appendChild(btn);
          }
        }
        wrap.appendChild(body);
        grid.appendChild(wrap);
      }

      if (portal.hasPublic) {
        const wrap = document.createElement("div");
        wrap.className = "portal-choice-group";
        const caption = document.createElement("div");
        caption.className = "portal-field-label";
        caption.textContent = t("publicLabel");
        wrap.appendChild(caption);
        const row = document.createElement("div");
        row.className = "portal-choice-row";
        [
          { value: "public", label: "Public" },
          { value: "private", label: "Private" },
          { value: "undefined", label: "Undefined" },
        ].forEach((item) => {
          appendChoiceRow(row, {
            name: `pub-${f.ref}`,
            type: "radio",
            value: item.value,
            checked: ans.public === item.value,
            label: item.label,
            onChange: () => patch(f.ref, { public: item.value }),
          });
        });
        wrap.appendChild(row);
        grid.appendChild(wrap);
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
    btn.textContent = pendingFiles.size ? t("evidenceUploading") : t("saving");
    try {
      const { store, doc, setDoc } = await getDb();
      const merged = { ...remote };
      Object.keys(drafts).forEach((ref) => {
        merged[ref] = sanitizePortalAnswer({ ...(merged[ref] || {}), ...drafts[ref] });
      });
      Object.keys(merged).forEach((ref) => {
        merged[ref] = sanitizePortalAnswer(merged[ref] || {});
      });
      if (pendingFiles.size) {
        btn.textContent = t("evidenceUploading");
        await uploadPendingEvidence(merged);
      }
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
      renderFields();
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
  const btnImportUrls = $("#btnImportUrls");
  if (btnImportUrls) {
    btnImportUrls.addEventListener("click", () => importEvidenceUrls({ onlyEmpty: true }));
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
