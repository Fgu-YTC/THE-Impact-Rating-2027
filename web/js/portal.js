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
      title: "THE Impact 2027 · Portal 填報",
      brand: "Portal 填報",
      authHint: "請使用學校 Google 帳號登入。",
      btnGoogle: "使用 Google 登入",
      authLinks: '<a href="index.html">填報頁</a> · <a href="admin.html">管理頁</a>',
      note: "依題號逐題填寫。可先「帶入今年填報」帶入單位已填內容，再檢查與補齊。",
      importLive: "帶入今年填報",
      importLiveTitle: "把單位已填內容帶入空白題",
      importAll: "覆蓋帶入",
      importAllTitle: "用單位填報覆蓋本頁已填內容",
      importAllConfirm: "要用單位填報覆蓋本頁已填的內容嗎？",
      alsoHasFile: "此題另有檔案",
      downloadFileSide: (name) => (name ? `下載：${name}` : "下載檔案"),
      save: "儲存本頁",
      saving: "儲存中…",
      signOut: "登出",
      notAllowed: "此帳號不在白名單。",
      noPermission: (email) => `此帳號沒有權限：${email || ""}`,
      missingConfig: "系統尚未設定完成。",
      loginFail: "登入失敗，請再試一次。",
      loadDraftWarn: (msg) => `讀取草稿失敗，仍可先填。${msg || ""}`,
      loadUnitsWarn: (msg) => `讀取單位失敗。${msg || ""}`,
      loadAnswersWarn: (msg) => `讀取填報失敗。${msg || ""}`,
      saved: "已儲存。",
      saveFail: (msg) => `儲存失敗：${msg}`,
      imported: (n) => `已帶入 ${n} 題（記得按儲存）。`,
      importEmpty: "沒有可帶入的空白題（尚未填報，或本頁已有內容）。",
      importNone: "目前沒有可帶入的填報內容。",
      meta: (sdg, filled, total) => `SDG ${sdg} · 已填 ${filled}/${total}`,
      unaligned: "待確認",
      excelSub: (parent) => (parent ? `附屬數值（${parent}）` : "附屬數值"),
      yesNo: "是／否",
      evidenceWarn: "請填可公開開啟的網頁網址；檔案請用下方上傳／下載。",
      evidenceMax: "提供證據（網址與檔案可同時填）",
      evidenceTypeUrl: "網址",
      evidenceTypeFile: "檔案",
      evidenceClear: "清除全部證據",
      evidenceClearUrl: "清除網址",
      evidenceClearFile: "清除檔案",
      evidencePending: (name) => `待上傳：${name}`,
      evidenceUploading: "上傳證據中…",
      publicLabel: "公開／不公開／未定",
      comments: "備註（最多 1000 字）",
      policyCreated: "政策訂定年（yyyy）",
      policyReviewed: "政策檢討年（yyyy）",
      valueFallback: "數值",
      downloadFile: (name) => (name ? `下載檔案：${name}` : "下載檔案"),
    },
    en: {
      title: "THE Impact 2027 · Portal fill",
      brand: "Portal fill",
      authHint: "Sign in with your university Google account.",
      btnGoogle: "Sign in with Google",
      authLinks: '<a href="index.html">Fill page</a> · <a href="admin.html">Admin</a>',
      note: "Fill question by question. Use “Import this year” to pull unit answers, then review and complete.",
      importLive: "Import this year",
      importLiveTitle: "Import unit answers into empty questions",
      importAll: "Overwrite import",
      importAllTitle: "Overwrite this page with unit answers",
      importAllConfirm: "Overwrite filled answers on this page with unit fill?",
      alsoHasFile: "This question also has a file",
      downloadFileSide: (name) => (name ? `Download: ${name}` : "Download file"),
      save: "Save this page",
      saving: "Saving…",
      signOut: "Sign out",
      notAllowed: "This account is not on the allowlist.",
      noPermission: (email) => `This account is not allowed: ${email || ""}`,
      missingConfig: "Setup is incomplete.",
      loginFail: "Sign-in failed. Please try again.",
      loadDraftWarn: (msg) => `Could not load draft; you can still fill. ${msg || ""}`,
      loadUnitsWarn: (msg) => `Could not load units. ${msg || ""}`,
      loadAnswersWarn: (msg) => `Could not load answers. ${msg || ""}`,
      saved: "Saved.",
      saveFail: (msg) => `Save failed: ${msg}`,
      imported: (n) => `Imported ${n} questions (remember to save).`,
      importEmpty: "No empty questions to import (nothing filled yet, or this page already has content).",
      importNone: "No unit answers available to import.",
      meta: (sdg, filled, total) => `SDG ${sdg} · ${filled}/${total} filled`,
      unaligned: "Check needed",
      excelSub: (parent) => (parent ? `Related value (${parent})` : "Related value"),
      yesNo: "Yes / No",
      evidenceWarn: "Use a public webpage URL; upload or download files below.",
      evidenceMax: "Evidence (URL and file can both be kept)",
      evidenceTypeUrl: "URL",
      evidenceTypeFile: "File",
      evidenceClear: "Clear all evidence",
      evidenceClearUrl: "Clear URL",
      evidenceClearFile: "Clear file",
      evidencePending: (name) => `Pending upload: ${name}`,
      evidenceUploading: "Uploading evidence…",
      publicLabel: "Public / Private / Undefined",
      comments: "Comments (max 1000 characters)",
      policyCreated: "Policy created (yyyy)",
      policyReviewed: "Policy reviewed (yyyy)",
      valueFallback: "Value",
      downloadFile: (name) => (name ? `Download file: ${name}` : "Download file"),
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
    fetch("data/portal-questions.json?v=20261030a").then((r) => r.json()),
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

  function hasEvidenceFile(ans, ref) {
    if (ref && pendingFiles.has(ref)) return true;
    return !!(ans && (ans.evidenceFileName || ans.evidenceFileUrl || ans.evidenceFilePath));
  }

  function syncEvidenceKind(ans, ref) {
    const hasUrl = !!publicEvidenceUrl(ans && ans.evidence);
    const hasFile = hasEvidenceFile(ans, ref);
    if (hasUrl && hasFile) return "both";
    if (hasUrl) return "url";
    if (hasFile) return "file";
    return "";
  }

  function clearEvidenceFields(ref) {
    pendingFiles.delete(ref);
    patch(ref, {
      evidence: "",
      evidenceFileName: "",
      evidenceFileUrl: "",
      evidenceFilePath: "",
      evidenceStoredName: "",
      evidenceAlsoFile: false,
      evidenceKind: "",
    });
  }

  function clearEvidenceUrl(ref) {
    const cur = answerOf(ref);
    patch(ref, {
      evidence: "",
      evidenceAlsoFile: hasEvidenceFile(cur, ref),
      evidenceKind: hasEvidenceFile(cur, ref) ? "file" : "",
    });
  }

  function clearEvidenceFile(ref) {
    pendingFiles.delete(ref);
    const cur = answerOf(ref);
    const hasUrl = !!publicEvidenceUrl(cur.evidence);
    patch(ref, {
      evidenceFileName: "",
      evidenceFileUrl: "",
      evidenceFilePath: "",
      evidenceStoredName: "",
      evidenceAlsoFile: false,
      evidenceKind: hasUrl ? "url" : "",
    });
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
    renderTabs();
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
    const hasUrl = !!out.evidence;
    const hasFileMeta = !!(out.evidenceFileName || out.evidenceFileUrl || out.evidenceFilePath);
    out.evidenceAlsoFile = hasUrl && hasFileMeta;
    if (hasUrl && hasFileMeta) out.evidenceKind = "both";
    else if (hasUrl) out.evidenceKind = "url";
    else if (hasFileMeta) out.evidenceKind = "file";
    else out.evidenceKind = "";
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
      const prev = merged[refId] || {};
      merged[refId] = sanitizePortalAnswer({
        ...prev,
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
    // siteQuestionId may be parent indicator for Excel sub-fields
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

  function applyEvidenceUrl(ref, url, fileMeta) {
    const next = publicEvidenceUrl(url);
    if (!next) return false;
    const cur = answerOf(ref);
    const patchBody = {
      evidence: next,
    };
    if (fileMeta && (fileMeta.evidenceFileName || fileMeta.evidenceFileUrl)) {
      patchBody.evidenceFileName = fileMeta.evidenceFileName || "";
      patchBody.evidenceFileUrl = fileMeta.evidenceFileUrl || "";
      patchBody.evidenceFilePath = fileMeta.evidenceFilePath || "";
      patchBody.evidenceStoredName = fileMeta.evidenceStoredName || "";
    }
    const withFile = {
      ...cur,
      ...patchBody,
    };
    patchBody.evidenceKind = syncEvidenceKind(withFile, ref);
    patchBody.evidenceAlsoFile = patchBody.evidenceKind === "both";
    patch(ref, patchBody);
    return true;
  }

  function portalEmpty(ref) {
    const a = answerOf(ref);
    return !answerHasContent(a) && !a.policyCreated && !a.policyReviewed;
  }

  function priorValueForSub(field) {
    if (!field) return "";
    const data = priorYear[field.parentRef] || priorYear[field.ref];
    if (!data || !Array.isArray(data.values)) return "";
    const idx = Number(String(field.valueKey || "v0").replace(/\D/g, "")) || 0;
    const entry = data.values[idx];
    return entry && entry.value != null && String(entry.value) !== "" ? String(entry.value) : "";
  }

  function fromLiveAnswer(answer, field) {
    if (!answer) return null;
    // Excel 子欄：只帶入父題對應的那一個數值
    if (field && field.subField && field.valueKey) {
      const raw =
        answer.values && answer.values[field.valueKey] != null
          ? answer.values[field.valueKey]
          : priorValueForSub(field);
      if (raw == null || String(raw) === "") return null;
      return { values: { v0: String(raw) } };
    }
    const out = {};
    if (answer.yesNo) out.yesNo = answer.yesNo;
    if (answer.public) out.public = answer.public;
    if (String(answer.comment || "").trim()) out.comment = String(answer.comment).slice(0, 1000);
    const pub = publicEvidenceUrl(answer.evidence);
    const fileName = String(answer.evidenceFileName || "").trim();
    const fileUrl = String(
      answer.evidenceFileUrl || (isStorageUrl(answer.evidence) ? answer.evidence : "")
    ).trim();
    const hasFile = !!(fileName || fileUrl);
    // 只帶「有提交的」證據：網址優先；若同時有檔案，網址為主並保留檔案供旁側下載
    if (pub) {
      out.evidence = pub;
      out.evidenceKind = "url";
      if (hasFile) {
        out.evidenceFileName = fileName;
        out.evidenceFileUrl = fileUrl;
        out.evidenceFilePath = answer.evidenceFilePath || "";
        out.evidenceStoredName = answer.evidenceStoredName || "";
        out.evidenceAlsoFile = true;
      } else {
        out.evidenceFileName = "";
        out.evidenceFileUrl = "";
        out.evidenceFilePath = "";
        out.evidenceStoredName = "";
        out.evidenceAlsoFile = false;
      }
    } else if (hasFile) {
      out.evidence = "";
      out.evidenceKind = "file";
      out.evidenceFileName = fileName;
      out.evidenceFileUrl = fileUrl;
      out.evidenceFilePath = answer.evidenceFilePath || "";
      out.evidenceStoredName = answer.evidenceStoredName || "";
      out.evidenceAlsoFile = false;
    } else {
      const priorUrl = field ? priorPublicUrls(field.ref)[0] || priorPublicUrls(field.parentRef || "")[0] : "";
      if (priorUrl) {
        out.evidence = priorUrl;
        out.evidenceKind = "url";
        out.evidenceAlsoFile = false;
      }
    }
    if (answer.values && typeof answer.values === "object") out.values = { ...answer.values };
    if (Array.isArray(answer.options)) out.options = answer.options.slice();
    return out;
  }

  function importLive({ onlyEmpty }) {
    let n = 0;
    fields.forEach((f) => {
      if (!f.siteQuestionId && !(f.subField && f.parentRef)) return;
      if (onlyEmpty && !portalEmpty(f.ref)) return;
      let mapped = null;
      const pack = liveForRef(f.ref);
      if (pack) mapped = fromLiveAnswer(pack.preferred.answer, f);
      if ((!mapped || !Object.keys(mapped).length) && f.subField) {
        const priorVal = priorValueForSub(f);
        if (priorVal) mapped = { values: { v0: priorVal } };
      }
      if (!mapped || !Object.keys(mapped).length) return;
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
          } else if (k === "evidenceAlsoFile") {
            // keep with evidence import
          } else if (cur[k] != null && String(cur[k]) !== "") {
            delete next[k];
          }
        });
        // 證據：若已有網址或檔案就不覆蓋
        if (publicEvidenceUrl(cur.evidence) || cur.evidenceFileName || cur.evidenceFileUrl) {
          delete next.evidence;
          delete next.evidenceKind;
          delete next.evidenceFileName;
          delete next.evidenceFileUrl;
          delete next.evidenceFilePath;
          delete next.evidenceStoredName;
          delete next.evidenceAlsoFile;
        }
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

  /** 父題連續數值已涵蓋的 Excel 子欄，不再重複開一張卡 */
  function isRedundantSubField(f) {
    if (!f || !f.subField || !f.parentRef || !f.valueKey) return false;
    const parent = fields.find((p) => p.ref === f.parentRef && !p.subField);
    if (!parent || parent.answerType !== "continuous") return false;
    const idx = Number(String(f.valueKey).replace(/\D/g, ""));
    if (!Number.isFinite(idx)) return false;
    return Array.isArray(parent.options) && parent.options.length > idx;
  }

  function sdgProgress(sdg) {
    const mine = fields.filter((f) => f.sdg === sdg && !isRedundantSubField(f));
    const filled = mine.filter((f) => !portalEmpty(f.ref)).length;
    return { filled, total: mine.length };
  }

  function renderTabs() {
    if (!sdgTabs) return;
    const sdgs = [...new Set(fields.map((f) => f.sdg))].sort((a, b) => a - b);
    const keepFocus = document.activeElement && sdgTabs.contains(document.activeElement);
    const focusSdg = keepFocus ? Number(document.activeElement.dataset.sdg) : null;
    sdgTabs.innerHTML = "";
    sdgs.forEach((n) => {
      const { filled, total } = sdgProgress(n);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.sdg = String(n);
      btn.classList.toggle("active", n === currentSdg);
      if (total > 0 && filled === total) btn.classList.add("done");
      else if (filled > 0) btn.classList.add("partial");
      const name = document.createElement("span");
      name.className = "sdg-name";
      name.textContent = `SDG ${n}`;
      const prog = document.createElement("span");
      prog.className = "sdg-prog";
      prog.textContent = `${filled}/${total}`;
      prog.title = lang === "en" ? `${filled} of ${total} filled` : `已填 ${filled}／共 ${total}`;
      btn.appendChild(name);
      btn.appendChild(prog);
      btn.addEventListener("click", () => {
        currentSdg = n;
        renderTabs();
        renderFields();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
      sdgTabs.appendChild(btn);
      if (focusSdg === n) btn.focus();
    });
  }

  function renderFields() {
    fieldList.innerHTML = "";
    const mine = fields.filter((f) => f.sdg === currentSdg && !isRedundantSubField(f));
    const { filled, total } = sdgProgress(currentSdg);
    $("#portalMeta").textContent = t("meta", currentSdg, filled, total);
    renderTabs();
    mine.forEach((f) => {
      const ans = answerOf(f.ref);
      const card = document.createElement("article");
      card.className =
        "portal-card " +
        (f.subField ? "subfield " : "") +
        (f.aligned ? "aligned" : "unaligned");
      card.dataset.ref = f.ref;

      const head = document.createElement("div");
      head.className = "portal-card-head";
      const ref = document.createElement("span");
      ref.className = "portal-ref";
      ref.textContent = f.ref;
      head.appendChild(ref);
      if (f.subField) {
        const badge = document.createElement("span");
        badge.className = "portal-badge soft";
        badge.textContent = t("excelSub", f.parentRef || "");
        head.appendChild(badge);
      } else if (!f.aligned) {
        const badge = document.createElement("span");
        badge.className = "portal-badge warn";
        badge.textContent = t("unaligned");
        head.appendChild(badge);
      }
      card.appendChild(head);

      const primary = document.createElement("div");
      primary.className = "portal-title";
      primary.textContent = (lang === "en" ? f.en || f.zh : f.zh || f.en) || "";
      card.appendChild(primary);
      const secondaryText = lang === "en" ? f.zh : f.en;
      if (secondaryText && secondaryText !== primary.textContent) {
        const secondary = document.createElement("div");
        secondary.className = "portal-sub";
        secondary.textContent = secondaryText;
        card.appendChild(secondary);
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
        row.className = "portal-choice-row inline";
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
        row.className =
          "portal-choice-row portal-opts" + (single ? "" : " inline portal-opts-multi");
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

        const body = document.createElement("div");
        body.className = "portal-evidence-body";
        const hasUrl = !!publicEvidenceUrl(ans.evidence);
        const hasFile = hasEvidenceFile(ans, f.ref);

        const urlBlock = document.createElement("div");
        urlBlock.className = "portal-ev-block";
        const urlLab = document.createElement("div");
        urlLab.className = "portal-ev-mini";
        urlLab.textContent = t("evidenceTypeUrl");
        urlBlock.appendChild(urlLab);
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
          const cur = answerOf(f.ref);
          const nextAns = { ...cur, evidence: next || "" };
          patch(f.ref, {
            evidence: next || "",
            evidenceKind: syncEvidenceKind(nextAns, f.ref),
            evidenceAlsoFile: !!(next && hasEvidenceFile(cur, f.ref)),
          });
        });
        urlBlock.appendChild(input);
        if (hasUrl) {
          const clearUrl = document.createElement("button");
          clearUrl.type = "button";
          clearUrl.className = "portal-ev-action muted";
          clearUrl.textContent = t("evidenceClearUrl");
          clearUrl.addEventListener("click", () => {
            clearEvidenceUrl(f.ref);
            renderFields();
          });
          urlBlock.appendChild(clearUrl);
        }
        body.appendChild(urlBlock);

        const fileBlock = document.createElement("div");
        fileBlock.className = "portal-ev-block";
        const fileLab = document.createElement("div");
        fileLab.className = "portal-ev-mini";
        fileLab.textContent = t("evidenceTypeFile");
        fileBlock.appendChild(fileLab);
        const pending = pendingFiles.get(f.ref);
        const fileHref = fileDownloadHref(ans);
        if (pending) {
          const tip = document.createElement("div");
          tip.className = "portal-ev-pending";
          tip.textContent = t("evidencePending", pending.name);
          fileBlock.appendChild(tip);
        } else if (fileHref || ans.evidenceFileName) {
          const a = document.createElement("a");
          a.className = "portal-ev-link";
          a.target = "_blank";
          a.rel = "noopener";
          if (fileHref) a.href = fileHref;
          a.textContent = ans.evidenceFileName
            ? t("downloadFileSide", ans.evidenceFileName)
            : fileDownloadLabel(ans);
          if (ans.evidenceFileName) a.setAttribute("download", ans.evidenceFileName);
          fileBlock.appendChild(a);
        }
        const file = document.createElement("input");
        file.type = "file";
        file.addEventListener("change", () => {
          const chosen = file.files && file.files[0];
          if (!chosen) return;
          pendingFiles.set(f.ref, chosen);
          const cur = answerOf(f.ref);
          const nextAns = {
            ...cur,
            evidenceFileName: chosen.name,
            evidenceFileUrl: "",
            evidenceFilePath: "",
            evidenceStoredName: "",
          };
          patch(f.ref, {
            evidenceFileName: chosen.name,
            evidenceFileUrl: "",
            evidenceFilePath: "",
            evidenceStoredName: "",
            evidenceKind: syncEvidenceKind(nextAns, f.ref),
            evidenceAlsoFile: !!publicEvidenceUrl(cur.evidence),
          });
          renderFields();
        });
        fileBlock.appendChild(file);
        if (hasFile) {
          const clearFile = document.createElement("button");
          clearFile.type = "button";
          clearFile.className = "portal-ev-action muted";
          clearFile.textContent = t("evidenceClearFile");
          clearFile.addEventListener("click", () => {
            clearEvidenceFile(f.ref);
            renderFields();
          });
          fileBlock.appendChild(clearFile);
        }
        body.appendChild(fileBlock);

        if (hasUrl || hasFile) {
          const clearBtn = document.createElement("button");
          clearBtn.type = "button";
          clearBtn.className = "portal-ev-action muted";
          clearBtn.textContent = t("evidenceClear");
          clearBtn.addEventListener("click", () => {
            clearEvidenceFields(f.ref);
            renderFields();
          });
          body.appendChild(clearBtn);
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
        row.className = "portal-choice-row inline";
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
        ta.rows = 2;
        ta.value = ans.comment || "";
        const fitComment = () => {
          ta.style.height = "auto";
          const next = Math.min(Math.max(ta.scrollHeight, 56), 480);
          ta.style.height = `${next}px`;
        };
        ta.addEventListener("input", () => {
          patch(f.ref, { comment: ta.value });
          fitComment();
        });
        ta.addEventListener("change", () => patch(f.ref, { comment: ta.value }));
        lab.appendChild(ta);
        grid.appendChild(lab);
        requestAnimationFrame(fitComment);
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
