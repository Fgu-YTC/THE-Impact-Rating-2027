/** Portal-aligned fill page — reads unit fill for reference/import; writes only portalFill */
(async function () {
  const $ = (sel) => document.querySelector(sel);
  const authGate = $("#authGate");
  const app = $("#portalApp");
  const authError = $("#authError");
  const fieldList = $("#fieldList");
  const sdgTabs = $("#sdgTabs");
  const workTabs = $("#workTabs");
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
      priorLink: "THE 2026 影響力評級（佛大）",
      priorOverall: (rank) => `總榜 ${rank}`,
      priorSdg: (sdg, rank) => `SDG ${sdg}：${rank}`,
      priorSdgNone: (sdg) => `SDG ${sdg}：無公開名次`,
      importLive: "帶入今年填報",
      importLiveTitle: "把單位已填內容帶入空白題",
      importAll: "覆蓋帶入",
      importAllTitle: "用單位填報覆蓋本頁已填內容",
      importAllConfirm: "要用單位填報覆蓋本頁已填的內容嗎？",
      alsoHasFile: "此題另有檔案",
      openUrl: "開啟網址",
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
      queueReady: "可填",
      queueProof: "待校稿",
      queueReadyMeta: (n) => `可填 · ${n} 題`,
      queueProofMeta: (n) => `待校稿 · ${n} 題`,
      queueEmptyNote: "尚未填 42 題，周一再做",
      collapseChrome: "收合",
      expandChrome: "展開",
      unaligned: "待確認",
      needsMerge: "待整合",
      goAdminFill: "去管理頁改寫／最終填報",
      excelSub: (parent) => (parent ? `附屬數值（${parent}）` : "附屬數值"),
      fromUnits: (names) => (names && names.length ? `來源：${names.join("、")}` : ""),
      fromUnitsNone: "尚無單位填報",
      yesNo: "是／否",
      evidenceWarn: "請填可公開開啟的網頁網址；檔案請用下方上傳／下載。",
      publicNeedsUrl: "選 Public 必須有可開啟的 https:// 公開網址（公開 PDF 的網址也可）。只有上傳檔、沒有公開網址時請選 Private。",
      publicNeedsUrlSave: (list) =>
        `尚未儲存。以下題目選了 Public 但沒有可開啟網址：${list}。請補網址，或改選 Private／Undefined。`,
      publicAutoPrivate: (list) =>
        `以下題目只有檔案、沒有公開網址，已自動改為 Private 後儲存：${list}。若檔案其實已公開，請補上公開網址再改回 Public。`,
      evidenceMax: "提供證據（網址與檔案可同時填）",
      evidenceTypeUrl: "網址",
      evidenceTypeFile: "檔案",
      evidenceClear: "清除全部證據",
      evidenceClearUrl: "清除網址",
      evidenceClearFile: "清除檔案",
      evidencePending: (name) => `待上傳：${name}`,
      evidenceUploading: "上傳證據中…",
      evidenceNaNote: "已選 No，無需填證據／公開／備註。",
      sharedDenom: (refs) => (refs ? `正式 Portal 共用分母（同值：${refs}）` : "正式 Portal 共用分母"),
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
      priorLink: "THE 2026 Impact Ratings (FGU)",
      priorOverall: (rank) => `Overall ${rank}`,
      priorSdg: (sdg, rank) => `SDG ${sdg}: ${rank}`,
      priorSdgNone: (sdg) => `SDG ${sdg}: no published band`,
      importLive: "Import this year",
      importLiveTitle: "Import unit answers into empty questions",
      importAll: "Overwrite import",
      importAllTitle: "Overwrite this page with unit answers",
      importAllConfirm: "Overwrite filled answers on this page with unit fill?",
      alsoHasFile: "This question also has a file",
      openUrl: "Open URL",
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
      queueReady: "Ready to fill",
      queueProof: "Needs review",
      queueReadyMeta: (n) => `Ready to fill · ${n}`,
      queueProofMeta: (n) => `Needs review · ${n}`,
      queueEmptyNote: "42 questions not started; leave for Monday",
      collapseChrome: "Collapse",
      expandChrome: "Expand",
      unaligned: "Check needed",
      needsMerge: "Needs merge",
      goAdminFill: "Open admin rewrite / final fill",
      excelSub: (parent) => (parent ? `Related value (${parent})` : "Related value"),
      fromUnits: (names) => (names && names.length ? `From: ${names.join(", ")}` : ""),
      fromUnitsNone: "No unit fill yet",
      yesNo: "Yes / No",
      evidenceWarn: "Use a public webpage URL; upload or download files below.",
      publicNeedsUrl: "Public needs an openable https:// public URL (a public PDF link is fine). File-only uploads should be Private.",
      publicNeedsUrlSave: (list) =>
        `Not saved. Public without an openable URL: ${list}. Add a URL, or choose Private / Undefined.`,
      publicAutoPrivate: (list) =>
        `Saved as Private (file only, no public URL): ${list}. If the file is already public, add its public URL and set Public again.`,
      evidenceMax: "Evidence (URL and file can both be kept)",
      evidenceTypeUrl: "URL",
      evidenceTypeFile: "File",
      evidenceClear: "Clear all evidence",
      evidenceClearUrl: "Clear URL",
      evidenceClearFile: "Clear file",
      evidencePending: (name) => `Pending upload: ${name}`,
      evidenceUploading: "Uploading evidence…",
      evidenceNaNote: "No selected — evidence / public / comments not required.",
      sharedDenom: (refs) =>
        refs ? `Official portal shared value (same as ${refs})` : "Official portal shared value",
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

  /** Fo Guang University · Sustainability Impact Ratings 2026（THE 校頁公開名次） */
  const PRIOR_IMPACT_2026 = {
    year: 2026,
    profileUrl: "https://www.timeshighereducation.com/world-university-rankings/fo-guang-university",
    overall: "1001–1500th",
    sdg: {
      1: "401–600th",
      2: "601+",
      3: "801–1000th",
      4: "1001+",
      5: "801–1000th",
      6: "601+",
      7: "801+",
      8: "601–800th",
      9: "601–800th",
      10: "601–800th",
      11: "601–800th",
      12: "601+",
      13: "601–800th",
      14: "401+",
      15: "401–600th",
      16: "401–600th",
      17: "1001–1500th",
    },
  };

  function renderPriorRankBar() {
    const bar = $("#priorRankBar");
    if (!bar) return;
    const link = $("#priorRankLink");
    const overall = $("#priorRankOverall");
    const sdgEl = $("#priorRankSdg");
    if (link) {
      link.href = PRIOR_IMPACT_2026.profileUrl;
      link.textContent = t("priorLink");
    }
    if (overall) overall.textContent = t("priorOverall", PRIOR_IMPACT_2026.overall);
    const band = PRIOR_IMPACT_2026.sdg[currentSdg];
    if (sdgEl) {
      sdgEl.textContent = band ? t("priorSdg", currentSdg, band) : t("priorSdgNone", currentSdg);
    }
    bar.hidden = false;
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
    fetch("data/portal-questions.json?v=20261104a").then((r) => r.json()),
    fetch("data/prior-year.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
  ]);
  const fields = portalPack.fields || [];
  let currentSdg = fields[0] ? fields[0].sdg : 1;
  /** "" | "ready" | "proof"。可填＝SDG 1–17 已看過、最終填報可直接貼上。待校稿＝看過但證據還不能貼。沒進最終填報的不進這兩標。 */
  let workFilter = "";
  const CATERING = "https://general.fgu.edu.tw/zh_tw/News/校園餐飲場所7-1起-不-提供免洗餐具及吸管-9026402";
  const REPORT_EN = "https://sdgs.fgu.edu.tw/uploads/asset/data/695b7c8c434adee0d8b53794/佛光大學2024永續報告書_英三校final_1222.pdf";
  const READY_PASTE = {
      "11.4.1": "Yes｜Public Yes。證據：https://website.fgu.edu.tw/zh_tw/announcement/宜蘭共築淨零願景-環保局聯手佛光大學培育碳管理先鋒-29074579 備註：Fo Guang University has set a target to replace its diesel campus buses with electric buses in stages and to install charging points for them.",
      "11.4.3": "No。公開、證據、備註留空。",
      "11.4.4": "Yes｜只勾直接提供住房｜Public Yes。證據：https://general.fgu.edu.tw/zh_tw/News/-教職員宿舍公告-114學年教職員宿舍申請公告-2711402 備註：Fo Guang University provides on-campus housing for faculty and staff at Hsiang-yun Residence and Linmei Dormitory. Single rooms and family rooms are let at set monthly rents.",
      "11.4.5": "Yes｜勾評估可負擔性、直接提供住房｜Public Yes。證據：https://wpsite.fgu.edu.tw/wordpress/fguinfo/index.php/type3/type3-1/type3-1-4/ 備註：Fo Guang University publishes a comparison of on-campus dormitory charges and off-campus rents, and provides student rooms in its own dormitories at the lower on-campus rate.",
      "11.4.6": "Yes｜Public Yes。證據：https://general.fgu.edu.tw/xhr/archive/download?file=645b59410e588f3e9e307499 備註：Fo Guang University requires vehicles to slow down and yield to pedestrians at buildings, sports grounds and junctions. Pedestrians use the brick footpaths on campus.",
      "11.4.7": "No。公開、證據、備註留空。",
      "11.4.8": "No。公開、證據、備註留空。",
      "11.4.9": "No。公開、證據、備註留空。",
      "12.2.3": "Yes｜Public Yes｜Created 2020｜Reviewed 留空。證據：https://general.fgu.edu.tw/uploads/asset/data/6620677c019aa140ceaa758b/HS-C-04-01_佛光大學運作化學品管理辦法.docx 備註：Fo Guang University’s chemical-management rules require hazardous waste to be classified, collected, stored and declared, and then stored and transported under the Waste Disposal Act. Incompatible hazardous wastes are kept separate in labelled containers.",
      "12.2.4": "Yes｜Public Yes｜政策年留空。證據：" + REPORT_EN + " 備註：Fo Guang University records campus waste by treatment route. Recycled waste and waste sent for incineration are reported separately in metric tonnes. General waste is collected for incineration rather than landfill.",
      "12.2.5": "Yes｜Public Yes｜Created 2019｜Reviewed 留空。證據：" + CATERING + " 備註：Fo Guang University requires campus food outlets to stop providing disposable tableware and drinking straws. Staff and students bring their own reusable utensils.",
      "12.2.6": "Yes｜Public Yes｜Created 2019｜Reviewed 留空。證據：" + CATERING + " 備註：Fo Guang University requires campus food outlets to stop providing single-use tableware. Staff and students bring their own reusable utensils.",
      "12.2.7": "Yes｜Public Yes。證據：" + CATERING + " 備註：Fo Guang University applies its single-use tableware rule to contracted campus food outlets. Those outlets do not provide disposable tableware or drinking straws.",
      "12.3.1": "Yes｜勾全校｜Public Yes。證據：" + REPORT_EN + " 備註：Fo Guang University measures the total waste generated and the amount recycled for the whole university, and reports both in metric tonnes.",
      "12.4.1": "Yes｜勾每年｜Public Yes。證據：https://sdgs.fgu.edu.tw/uploads/archive_file_multiple/file/69809b8b434ade6bd6f05bd8/佛光大學2024永續報告書_英三校final_1222.pdf 備註：Fo Guang University publishes a standalone sustainability report every year. The public English report discloses the university’s environmental, social and governance performance.",
  };
  const BLOCK_NOTES = {
    "2.5.3": "已看過。備註是學生快充食力站，題目要的是開放設施給在地農民與食品生產者，先不要照這則貼。",
    "3.3.2": "已看過。證據是校內系統網址，外人打不開，貼之前要換成公開頁。",
    "15.3.3": "已看過。備註是保育類動物新聞，題目要的是規劃發展納入地方生物多樣性，先不要照這則貼。",
  };

  function finalOfficeAnswer(ref) {
    const pack = liveForRef(ref);
    if (!pack || !pack.preferred) return null;
    if (pack.preferred.kind === "office" && /永續/.test(String(pack.preferred.unitName || ""))) {
      return pack.preferred.answer;
    }
    return null;
  }

  function pasteNoteFromOffice(field, answer) {
    const yn = String((answer && answer.yesNo) || "").toLowerCase();
    if (yn === "no") return "No。公開、證據、備註留空。";
    const bits = [];
    if (yn === "yes") bits.push("Yes");
    const selected = Array.isArray(answer.options) ? answer.options.filter(Boolean) : [];
    if (selected.length && field.options) {
      const labels = selected.map((key) => {
        const opt = field.options.find((item) => item.en === key || item.zh === key);
        return opt ? opt.zh || opt.en : key;
      });
      bits.push("勾" + labels.join("、"));
    }
    if (answer.public === "public") bits.push("Public Yes");
    else if (answer.public === "private") bits.push("Private");
    if (answer.policyCreated) bits.push("Created " + answer.policyCreated);
    if (answer.policyReviewed) bits.push("Reviewed " + answer.policyReviewed);
    const values = answer.values || {};
    Object.keys(values).forEach((key) => {
      if (values[key] == null || String(values[key]).trim() === "") return;
      const idx = Number(String(key).replace(/\D/g, ""));
      const opt = field.options && Number.isFinite(idx) ? field.options[idx] : null;
      const label = opt ? opt.zh || opt.en : key;
      bits.push(label + " " + values[key]);
    });
    const ev = publicEvidenceUrl(answer.evidence);
    const fileName = String(answer.evidenceFileName || "").trim();
    let text = bits.filter(Boolean).join("｜");
    if (ev) text += (text ? "。" : "") + "證據：" + ev;
    else if (fileName) text += (text ? "。" : "") + "證據檔：" + fileName;
    const comment = String(answer.comment || "").trim();
    if (comment) text += (text ? " " : "") + "備註：" + comment;
    return text || "已有最終填報，可依畫面內容貼上。";
  }

  function blockNote(ref) {
    if (READY_PASTE[ref]) return "";
    if (BLOCK_NOTES[ref]) return BLOCK_NOTES[ref];
    const field = fields.find((item) => item.ref === ref);
    const answer = finalOfficeAnswer(ref);
    if (!field || !answer) return "";
    const yn = String(answer.yesNo || "").toLowerCase();
    const ev = String(answer.evidence || "");
    const hasFile = !!(answer.evidenceFileUrl || answer.evidenceFileName || isStorageUrl(ev));
    if (yn === "yes" && answer.public === "public" && !publicEvidenceUrl(ev) && !hasFile) {
      return "已看過。公開是 Yes，但還沒有可貼的網址或檔案。";
    }
    if (ev.includes("…") || (ev.match(/https?:\/\//g) || []).length > 1) {
      return "已看過。證據欄不是單一網址，貼之前要先改成一條。";
    }
    return "";
  }

  function queueOf(ref) {
    const field = fields.find((item) => item.ref === ref);
    if (field && isRedundantSubField(field)) return "";
    if (READY_PASTE[ref]) return "ready";
    if (blockNote(ref)) return "proof";
    const answer = finalOfficeAnswer(ref);
    if (answer && field && answerHasRelevantContent(answer, field)) return "ready";
    return "";
  }

  function queueNoteText(ref) {
    if (queueOf(ref) === "ready" && READY_PASTE[ref]) return READY_PASTE[ref];
    const blocked = blockNote(ref);
    if (queueOf(ref) === "proof" && blocked) return blocked;
    const field = fields.find((item) => item.ref === ref);
    const answer = finalOfficeAnswer(ref);
    if (field && answer) return pasteNoteFromOffice(field, answer);
    return "";
  }

  function queueSize(kind) {
    return fields.filter((item) => queueOf(item.ref) === kind).length;
  }

  function updatePortalChromeSummary() {
    const el = $("#portalChromeSummary");
    if (!el) return;
    if (workFilter === "ready") el.textContent = t("queueReadyMeta", queueSize("ready"));
    else if (workFilter === "proof") el.textContent = t("queueProofMeta", queueSize("proof"));
    else el.textContent = `SDG ${currentSdg}`;
  }

  function setPortalChromeCollapsed(collapsed) {
    const chrome = $("#portalChrome");
    if (!chrome) return;
    chrome.classList.toggle("collapsed", !!collapsed);
    const btn = $("#btnTogglePortalChrome");
    if (btn) {
      btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
      btn.textContent = collapsed ? t("expandChrome") : t("collapseChrome");
      btn.title = collapsed ? t("expandChrome") : t("collapseChrome");
    }
    updatePortalChromeSummary();
    try {
      localStorage.setItem("portal-chrome-collapsed", collapsed ? "1" : "0");
    } catch (_) {
      /* ignore quota */
    }
  }

  function compareRef(a, b) {
    const pa = String(a).split(".").map((n) => Number(n));
    const pb = String(b).split(".").map((n) => Number(n));
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i += 1) {
      const d = (pa[i] || 0) - (pb[i] || 0);
      if (d) return d;
    }
    return 0;
  }
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

  function isNoAnswer(ans) {
    return String((ans && ans.yesNo) || "").toLowerCase() === "no";
  }

  function clearEvidenceForNo(ref) {
    pendingFiles.delete(ref);
    patch(ref, {
      evidence: "",
      evidenceFileName: "",
      evidenceFileUrl: "",
      evidenceFilePath: "",
      evidenceStoredName: "",
      evidenceAlsoFile: false,
      evidenceKind: "",
      public: "",
      comment: "",
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
    if (String(out.yesNo || "").toLowerCase() === "no") {
      out.evidence = "";
      out.evidenceFileName = "";
      out.evidenceFileUrl = "";
      out.evidenceFilePath = "";
      out.evidenceStoredName = "";
      out.evidenceAlsoFile = false;
      out.evidenceKind = "";
      out.public = "";
      out.comment = "";
      return out;
    }
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
      if (isNoAnswer(merged[refId])) continue;
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

  /** 子欄只看對應 valueKey（如 5.4.4 只要員工人數）；避免會計只填支出卻被當成待整合 */
  function answerHasRelevantContent(answer, field) {
    if (!answer) return false;
    if (field && field.subField && field.valueKey) {
      const raw = answer.values && answer.values[field.valueKey];
      return raw != null && String(raw).trim() !== "";
    }
    return answerHasContent(answer);
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
      if (office && answerHasRelevantContent(office, field)) {
        hits.push({ unitId: u.id, unitName: u.name, answer: office, kind: "office" });
      } else if (ans && answerHasRelevantContent(ans, field)) {
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

  /** 兩個以上單位有內容，且尚無永續辦最終稿 → 待整合 */
  function needsMerge(pack) {
    if (!pack || !pack.all || pack.all.length < 2) return false;
    const unitIds = [...new Set(pack.all.map((h) => h.unitId).filter(Boolean))];
    if (unitIds.length < 2) return false;
    return !pack.all.some((h) => h.kind === "office" && /永續/.test(String(h.unitName || "")));
  }

  function adminFillUrl(ref) {
    const q = new URLSearchParams();
    q.set("mode", "fill");
    if (ref) q.set("ref", String(ref));
    return `admin.html?${q.toString()}`;
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

  function normalizePriorLabel(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[\u4e00-\u9fff／/：:\s]+/g, " ")
      .replace(/[^a-z0-9& ]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /** 去年欄位順序常與今年不同，優先用英文標籤對；對不到才退回 index */
  function priorValueForSub(field) {
    if (!field) return "";
    const data = priorYear[field.parentRef] || priorYear[field.ref];
    if (!data || !Array.isArray(data.values)) return "";
    const want = normalizePriorLabel(
      field.excelSubLabel || field.en || ((field.options || [])[0] && field.options[0].en) || ""
    );
    if (want) {
      const hit = data.values.find((entry) => {
        const lab = normalizePriorLabel(entry && entry.label);
        return lab === want || lab.includes(want) || want.includes(lab);
      });
      if (hit && hit.value != null && String(hit.value) !== "") return String(hit.value);
    }
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
    }
    // Public 需有可開啟公開網址；單位若勾 Public 卻只有檔案，帶入時改 Private，避免卡儲存
    if (answer.public === "public" && pub) out.public = "public";
    else if (answer.public === "public") out.public = "private";
    else if (answer.public) out.public = answer.public;
    // 帶入今年填報：單位沒交證據就不補去年網址，避免 Portal 出現「來源單位」與舊連結錯配
    if (answer.values && typeof answer.values === "object") out.values = { ...answer.values };
    if (Array.isArray(answer.options)) out.options = answer.options.slice();
    return out;
  }

  function importLive({ onlyEmpty }) {
    let n = 0;
    fields.forEach((f) => {
      // 父題已涵蓋的 Excel 子欄（如 5.4.3／5.4.4）不帶入、不另存
      if (isRedundantSubField(f)) return;
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

  /** 同 SDG 內、父題連續數值已涵蓋的子欄才隱藏；跨 SDG 共用分母（如 5.4.4／8.3.1）仍顯示以便對正式 Portal 提交 */
  function isRedundantSubField(f) {
    if (!f || !f.subField || !f.parentRef || !f.valueKey) return false;
    const parent = fields.find((p) => p.ref === f.parentRef && !p.subField);
    if (!parent || parent.answerType !== "continuous") return false;
    if (Number(parent.sdg) !== Number(f.sdg)) return false;
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
      btn.classList.toggle("active", !workFilter && n === currentSdg);
      if (total > 0 && filled === total) btn.classList.add("done");
      else if (filled > 0) btn.classList.add("partial");
      const name = document.createElement("span");
      name.className = "sdg-name";
      name.textContent = `SDG ${n}`;
      const prog = document.createElement("span");
      prog.className = "sdg-prog";
      prog.textContent = `${filled}/${total}`;
      const band = PRIOR_IMPACT_2026.sdg[n];
      prog.title = [
        lang === "en" ? `${filled} of ${total} filled` : `已填 ${filled}／共 ${total}`,
        band ? (lang === "en" ? `2026: ${band}` : `2026 名次：${band}`) : "",
      ]
        .filter(Boolean)
        .join(" · ");
      btn.appendChild(name);
      btn.appendChild(prog);
      if (band) {
        const rank = document.createElement("span");
        rank.className = "sdg-prior-rank";
        rank.textContent = band.replace(/th$/i, "");
        rank.title = lang === "en" ? `2026 Impact: ${band}` : `2026 影響力評級：${band}`;
        btn.appendChild(rank);
      }
      btn.addEventListener("click", () => {
        workFilter = "";
        currentSdg = n;
        renderTabs();
        renderFields();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
      sdgTabs.appendChild(btn);
      if (focusSdg === n) btn.focus();
    });
  }

  function renderWorkTabs() {
    if (!workTabs) return;
    workTabs.innerHTML = "";
    [
      ["ready", "queueReady", "ready"],
      ["proof", "queueProof", "proof"],
    ].forEach(([key, labelKey, cls]) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cls + (workFilter === key ? " active" : "");
      const name = document.createElement("span");
      name.textContent = t(labelKey);
      const count = document.createElement("span");
      count.className = "work-count";
      count.textContent = String(queueSize(key));
      btn.appendChild(name);
      btn.appendChild(count);
      btn.addEventListener("click", () => {
        workFilter = workFilter === key ? "" : key;
        renderFields();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
      workTabs.appendChild(btn);
    });
    const aside = document.createElement("span");
    aside.className = "work-aside";
    aside.textContent = t("queueEmptyNote");
    workTabs.appendChild(aside);
  }

  function renderFields() {
    fieldList.innerHTML = "";
    const mine = workFilter
      ? fields
          .filter((f) => queueOf(f.ref) === workFilter && !isRedundantSubField(f))
          .sort((a, b) => compareRef(a.ref, b.ref))
      : fields.filter((f) => f.sdg === currentSdg && !isRedundantSubField(f));
    const { filled, total } = sdgProgress(currentSdg);
    $("#portalMeta").textContent = workFilter
      ? t(workFilter === "ready" ? "queueReadyMeta" : "queueProofMeta", mine.length)
      : t("meta", currentSdg, filled, total);
    renderPriorRankBar();
    renderWorkTabs();
    renderTabs();
    updatePortalChromeSummary();
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
      const livePack = liveForRef(f.ref);
      const sourceNames = livePack
        ? [...new Set(livePack.all.map((h) => h.unitName).filter(Boolean))]
        : [];
      const source = document.createElement("span");
      source.className = "portal-source" + (sourceNames.length ? "" : " empty");
      source.textContent = sourceNames.length ? t("fromUnits", sourceNames) : t("fromUnitsNone");
      if (sourceNames.length) source.title = sourceNames.join(lang === "en" ? ", " : "、");
      head.appendChild(source);
      const queue = queueOf(f.ref);
      if (queue) {
        const badge = document.createElement("span");
        badge.className = "portal-badge " + queue;
        badge.textContent = t(queue === "ready" ? "queueReady" : "queueProof");
        head.appendChild(badge);
      }
      if (needsMerge(livePack)) {
        const merge = document.createElement("span");
        merge.className = "portal-badge merge";
        merge.textContent = t("needsMerge");
        merge.title =
          lang === "en"
            ? "Two or more unit answers; no sustainability office final yet"
            : "兩個以上單位有填報，且尚未有永續辦最終稿";
        head.appendChild(merge);
        const jump = document.createElement("a");
        jump.className = "portal-admin-jump";
        jump.href = adminFillUrl(f.ref);
        jump.target = "_blank";
        jump.rel = "noopener noreferrer";
        jump.textContent = t("goAdminFill");
        head.appendChild(jump);
      }
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
      if (f.sharedDenom) {
        const peers = fields
          .filter((x) => x.sharedDenom === f.sharedDenom && x.ref !== f.ref)
          .map((x) => x.ref);
        const badge = document.createElement("span");
        badge.className = "portal-badge soft";
        badge.textContent = t("sharedDenom", peers.join("、"));
        badge.title = f.excelNote || badge.textContent;
        head.appendChild(badge);
      }
      card.appendChild(head);

      const primary = document.createElement("div");
      primary.className = "portal-title";
      primary.textContent = (lang === "en" ? f.en || f.zh : f.zh || f.en) || "";
      card.appendChild(primary);
      const queueNote = queueNoteText(f.ref);
      if (queueNote) {
        const note = document.createElement("div");
        note.className = "portal-queue-note";
        note.textContent = queueNote;
        card.appendChild(note);
      }
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
            onChange: () => {
              patch(f.ref, { yesNo: val });
              if (val === "no") clearEvidenceForNo(f.ref);
              renderFields();
            },
          });
        });
        wrap.appendChild(row);
        grid.appendChild(wrap);
      }

      const lockedByNo = isNoAnswer(ans);

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
        wrap.className = "portal-evidence" + (lockedByNo ? " is-na" : "");
        const caption = document.createElement("div");
        caption.className = "portal-field-label";
        caption.textContent = t("evidenceMax");
        wrap.appendChild(caption);
        if (lockedByNo) {
          const note = document.createElement("div");
          note.className = "portal-na-note";
          note.textContent = t("evidenceNaNote");
          wrap.appendChild(note);
        }

        const body = document.createElement("div");
        body.className = "portal-evidence-body";
        const hasUrl = !lockedByNo && !!publicEvidenceUrl(ans.evidence);
        const hasFile = !lockedByNo && hasEvidenceFile(ans, f.ref);

        const urlBlock = document.createElement("div");
        urlBlock.className = "portal-ev-block";
        const urlLab = document.createElement("div");
        urlLab.className = "portal-ev-mini";
        urlLab.textContent = t("evidenceTypeUrl");
        urlBlock.appendChild(urlLab);
        const currentUrl = lockedByNo ? "" : publicEvidenceUrl(ans.evidence) || "";
        if (currentUrl) {
          const a = document.createElement("a");
          a.className = "portal-ev-link portal-ev-url";
          a.href = currentUrl;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.textContent = currentUrl;
          a.title = t("openUrl");
          urlBlock.appendChild(a);
        }
        const input = document.createElement("input");
        input.type = "url";
        input.placeholder = "https://…";
        input.value = currentUrl;
        input.disabled = lockedByNo;
        if (!lockedByNo) {
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
            renderFields();
          });
        }
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
        const pending = lockedByNo ? null : pendingFiles.get(f.ref);
        const fileHref = lockedByNo ? "" : fileDownloadHref(ans);
        if (pending) {
          const tip = document.createElement("div");
          tip.className = "portal-ev-pending";
          tip.textContent = t("evidencePending", pending.name);
          fileBlock.appendChild(tip);
        } else if (fileHref || (!lockedByNo && ans.evidenceFileName)) {
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
        file.disabled = lockedByNo;
        if (!lockedByNo) {
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
        }
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
        wrap.className = "portal-choice-group" + (lockedByNo ? " is-na" : "");
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
          const lab = appendChoiceRow(row, {
            name: `pub-${f.ref}`,
            type: "radio",
            value: item.value,
            checked: !lockedByNo && ans.public === item.value,
            label: item.label,
            onChange: () => {
              if (lockedByNo) return;
              patch(f.ref, { public: item.value });
              renderFields();
            },
          });
          const input = lab.querySelector("input");
          if (input) input.disabled = lockedByNo;
        });
        wrap.appendChild(row);
        if (!lockedByNo && ans.public === "public" && !publicEvidenceUrl(ans.evidence)) {
          const warn = document.createElement("div");
          warn.className = "field-warn";
          warn.textContent = t("publicNeedsUrl");
          wrap.appendChild(warn);
        }
        grid.appendChild(wrap);
      }

      if (
        portal.hasComment ||
        f.answerType === "yesno" ||
        f.answerType === "picklist" ||
        portal.hasPolicyCreated
      ) {
        const lab = document.createElement("label");
        lab.className = lockedByNo ? "is-na" : "";
        lab.textContent = t("comments");
        const ta = document.createElement("textarea");
        ta.maxLength = 1000;
        ta.rows = 2;
        ta.value = lockedByNo ? "" : ans.comment || "";
        ta.disabled = lockedByNo;
        const fitComment = () => {
          ta.style.height = "auto";
          const next = Math.min(Math.max(ta.scrollHeight, 56), 480);
          ta.style.height = `${next}px`;
        };
        if (!lockedByNo) {
          ta.addEventListener("input", () => {
            patch(f.ref, { comment: ta.value });
            fitComment();
          });
          ta.addEventListener("change", () => patch(f.ref, { comment: ta.value }));
        }
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

  function stripRedundantAnswers(map) {
    const out = { ...(map || {}) };
    fields.forEach((f) => {
      if (isRedundantSubField(f) && out[f.ref] != null) delete out[f.ref];
    });
    return out;
  }

  async function loadRemote() {
    const { store, doc, getDoc } = await getDb();
    const snap = await getDoc(doc(store, "portalFill", "impact2027"));
    const raw = snap.exists() ? snap.data().answers || {} : {};
    remote = {};
    Object.keys(raw).forEach((ref) => {
      remote[ref] = sanitizePortalAnswer(raw[ref] || {});
    });
    remote = stripRedundantAnswers(remote);
  }

  async function saveAll() {
    const btn = $("#btnSave");
    const merged = stripRedundantAnswers({ ...remote });
    Object.keys(drafts).forEach((ref) => {
      if (fields.some((f) => f.ref === ref && isRedundantSubField(f))) return;
      merged[ref] = sanitizePortalAnswer({ ...(merged[ref] || {}), ...drafts[ref] });
    });
    Object.keys(merged).forEach((ref) => {
      merged[ref] = sanitizePortalAnswer(merged[ref] || {});
    });
    const publicAutoPrivate = [];
    fields
      .filter((f) => (f.portal || {}).hasPublic)
      .forEach((f) => {
        const a = merged[f.ref] || {};
        if (a.public === "public" && !publicEvidenceUrl(a.evidence)) {
          a.public = "private";
          merged[f.ref] = a;
          drafts[f.ref] = { ...(drafts[f.ref] || {}), public: "private" };
          publicAutoPrivate.push(f.ref);
        }
      });
    btn.disabled = true;
    btn.textContent = pendingFiles.size ? t("evidenceUploading") : t("saving");
    try {
      const { store, doc, setDoc } = await getDb();
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
      if (publicAutoPrivate.length) {
        banner("warn", `${t("saved")} ${t("publicAutoPrivate", publicAutoPrivate.join("、"))}`);
      } else {
        banner("ok", t("saved"));
      }
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
  const btnTogglePortalChrome = $("#btnTogglePortalChrome");
  if (btnTogglePortalChrome) {
    let collapsed = false;
    try {
      collapsed = localStorage.getItem("portal-chrome-collapsed") === "1";
    } catch (_) {
      collapsed = false;
    }
    setPortalChromeCollapsed(collapsed);
    btnTogglePortalChrome.addEventListener("click", () => {
      const chrome = $("#portalChrome");
      setPortalChromeCollapsed(!(chrome && chrome.classList.contains("collapsed")));
    });
  }
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
