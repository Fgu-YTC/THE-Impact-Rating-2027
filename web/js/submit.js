/** 把單位填答與證據檔提交到 Firebase Storage。 */
(function (global) {
  const JSON_TYPE = "application/json";

  async function storage() {
    const { initializeApp, getApp, getApps } = await import(
      "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"
    );
    const { getStorage } = await import(
      "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js"
    );
    let app;
    if (getApps().length) app = getApp();
    else {
      try {
        app = initializeApp(global.FIREBASE_CONFIG);
      } catch (err) {
        app = getApp();
      }
    }
    return { storage: getStorage(app) };
  }

  function safeName(name) {
    return String(name || "file").replace(/[\\/:*?"<>|#]/g, "_").trim() || "file";
  }

  function questionMeta(questions, questionId) {
    const found = (questions || []).find((item) => item.id === questionId);
    if (found) return { sdg: found.sdg, ref: found.ref || questionId };
    const match = String(questionId).match(/^sdg(\d+)-(.+)$/);
    if (match) return { sdg: Number(match[1]), ref: match[2] };
    return { sdg: 0, ref: questionId };
  }

  function storedFileName(ref, fileName) {
    const base = safeName(fileName);
    const prefix = safeName(ref);
    if (base === prefix || base.startsWith(`${prefix}_`) || base.startsWith(`${prefix}-`)) return base;
    return `${prefix}_${base}`;
  }

  function explain(err) {
    const code = err && (err.code || err.message || "");
    if (String(code).includes("storage/unauthorized")) {
      return "系統還不允許寫入。請到 Firebase Storage 規則，允許 submissions 與 evidence 上傳。";
    }
    if (String(code).includes("storage/unknown") || String(code).includes("storage/retry-limit-exceeded")) {
      return "連不到 Storage。請確認 Firebase Storage 已啟用。";
    }
    if (String(code).includes("permission-denied")) {
      return "Firestore 仍拒絕寫入。請發布允許 units 與 answers 的規則。";
    }
    return "提交失敗，請再試一次。";
  }

  async function submitChanged({ unitId, entries, files, questions, office }) {
    if (!global.FIREBASE_CONFIG || !global.FIREBASE_CONFIG.storageBucket) {
      throw new Error("還沒有設定 Firebase Storage。");
    }
    if (!global.THELive) throw new Error("Firestore 尚未載入。");
    const { storage: bucket } = await storage();
    const { ref, uploadBytes, getDownloadURL } = await import(
      "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js"
    );
    const pending = files || new Map();
    const saved = [];
    try {
      for (const entry of entries) {
        let answer = { ...(entry.answer || {}) };
        const file = pending.get(entry.questionId);
        if (file) {
          const meta = questionMeta(questions, entry.questionId);
          const evidenceStoredName = storedFileName(meta.ref, file.name);
          const path = `evidence/${unitId}/${entry.questionId}/${evidenceStoredName}`;
          const stored = ref(bucket, path);
          await uploadBytes(stored, file, { contentType: file.type || "application/octet-stream" });
          let evidenceFileUrl = "";
          try {
            evidenceFileUrl = await getDownloadURL(stored);
          } catch (err) {
            evidenceFileUrl = "";
          }
          answer = {
            ...answer,
            evidenceFileName: file.name,
            evidenceStoredName,
            evidenceFilePath: path,
            evidenceFileUrl,
          };
        }
        saved.push({ questionId: entry.questionId, answer });
      }
      await (office
        ? global.THELive.saveOfficeAnswers(unitId, saved, office)
        : global.THELive.saveAnswers(unitId, saved));
    } catch (err) {
      throw new Error(explain(err));
    }
  }

  async function submitUnit({ unitId, unitName, answers, files, questions, onFileUploaded }) {
    if (!global.FIREBASE_CONFIG || !global.FIREBASE_CONFIG.storageBucket) {
      throw new Error("還沒有設定 Firebase Storage。");
    }
    const { storage: bucket } = await storage();
    const { ref, uploadBytes, uploadString, getDownloadURL } = await import(
      "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js"
    );
    const next = { ...(answers || {}) };
    const pending = files || new Map();
    try {
      for (const [questionId, file] of pending.entries()) {
        if (!file) continue;
        const meta = questionMeta(questions, questionId);
        const evidenceStoredName = storedFileName(meta.ref, file.name);
        const path = `evidence/${unitId}/${questionId}/${evidenceStoredName}`;
        const stored = ref(bucket, path);
        await uploadBytes(stored, file, { contentType: file.type || "application/octet-stream" });
        const evidenceFileUrl = await getDownloadURL(stored);
        const info = {
          evidenceFileName: file.name,
          evidenceStoredName,
          evidenceFilePath: path,
          evidenceFileUrl,
        };
        next[questionId] = { ...(next[questionId] || {}), ...info };
        if (onFileUploaded) onFileUploaded(questionId, info);
      }
      const payload = {
        unitId,
        unitName,
        updatedAt: new Date().toISOString(),
        answers: next,
      };
      await uploadString(ref(bucket, `submissions/${unitId}.json`), JSON.stringify(payload), "raw", {
        contentType: JSON_TYPE,
      });
    } catch (err) {
      throw new Error(explain(err));
    }
  }

  async function listSubmissions() {
    const { storage: bucket } = await storage();
    const { ref, listAll, getDownloadURL } = await import(
      "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js"
    );
    let listed;
    try {
      listed = await listAll(ref(bucket, "submissions"));
    } catch (err) {
      if (String(err && err.code).includes("object-not-found")) return [];
      throw err;
    }
    const packs = [];
    for (const item of listed.items) {
      const url = await getDownloadURL(item);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`讀取提交紀錄 HTTP ${res.status}`);
      packs.push(await res.json());
    }
    return packs;
  }

  function mergeAnswers(packs) {
    const sorted = [...(packs || [])].sort((a, b) =>
      String(a.updatedAt || "").localeCompare(String(b.updatedAt || ""))
    );
    const merged = {};
    sorted.forEach((pack) => {
      Object.entries(pack.answers || {}).forEach(([questionId, answer]) => {
        if (answer) merged[questionId] = answer;
      });
    });
    return merged;
  }

  function loadJSZip() {
    return new Promise((resolve, reject) => {
      if (global.JSZip) {
        resolve(global.JSZip);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js";
      script.onload = () => resolve(global.JSZip);
      script.onerror = () => reject(new Error("zip"));
      document.head.appendChild(script);
    });
  }

  function uniqueZipPath(used, folder, fileName) {
    let path = `${folder}/${fileName}`;
    if (!used.has(path)) {
      used.add(path);
      return path;
    }
    const dot = fileName.lastIndexOf(".");
    const stem = dot > 0 ? fileName.slice(0, dot) : fileName;
    const ext = dot > 0 ? fileName.slice(dot) : "";
    let n = 2;
    while (used.has(`${folder}/${stem}_${n}${ext}`)) n += 1;
    path = `${folder}/${stem}_${n}${ext}`;
    used.add(path);
    return path;
  }

  async function fileUrl(answer) {
    if (!answer) return "";
    if (answer.evidenceFileUrl) return answer.evidenceFileUrl;
    if (!answer.evidenceFilePath) return "";
    const { storage: bucket } = await storage();
    const { ref, getDownloadURL } = await import(
      "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js"
    );
    return getDownloadURL(ref(bucket, answer.evidenceFilePath));
  }

  async function readEvidence(bucket, answer) {
    const { ref, getDownloadURL } = await import(
      "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js"
    );
    let lastError = null;
    let url = answer.evidenceFileUrl || "";
    if (!url && answer.evidenceFilePath) {
      try {
        url = await getDownloadURL(ref(bucket, answer.evidenceFilePath));
      } catch (err) {
        lastError = err;
      }
    }
    if (url) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`下載連結 HTTP ${res.status}`);
        return await res.blob();
      } catch (err) {
        lastError = lastError || err;
      }
    }
    const failed = new Error(
      (lastError && (lastError.code || lastError.message)) || "讀不到證據檔"
    );
    if (lastError && lastError.code) failed.code = lastError.code;
    throw failed;
  }

  async function runPool(items, limit, worker) {
    let cursor = 0;
    async function take() {
      while (cursor < items.length) {
        const item = items[cursor];
        cursor += 1;
        await worker(item);
      }
    }
    const workers = Math.min(limit, items.length);
    await Promise.all(Array.from({ length: workers }, () => take()));
  }

  async function exportEvidenceZip({ packs, questions, filename, onProgress }) {
    const JSZip = await loadJSZip();
    const { storage: bucket } = await storage();
    const zip = new JSZip();
    const used = new Set();
    let count = 0;
    const failed = [];
    const jobs = [];
    for (const pack of packs || []) {
      for (const [questionId, answer] of Object.entries(pack.answers || {})) {
        if (!answer || (!answer.evidenceFilePath && !answer.evidenceFileUrl)) continue;
        const meta = questionMeta(questions, questionId);
        jobs.push({
          answer,
          folder: meta.sdg ? `SDG${meta.sdg}` : "SDG",
          name: answer.evidenceStoredName || storedFileName(meta.ref, answer.evidenceFileName || "evidence"),
          ref: meta.ref,
        });
      }
    }
    if (!jobs.length) {
      const err = new Error("no-files");
      throw err;
    }
    let done = 0;
    if (onProgress) onProgress({ phase: "download", done: 0, total: jobs.length });
    await runPool(jobs, 4, async (job) => {
      try {
        const bytes = await readEvidence(bucket, job.answer);
        zip.file(uniqueZipPath(used, job.folder, job.name), bytes);
        count += 1;
      } catch (err) {
        failed.push(`${job.ref} ${err.code || err.message || "讀取失敗"}`);
      }
      done += 1;
      if (onProgress) onProgress({ phase: "download", done, total: jobs.length });
    });
    if (!count) {
      const err = new Error(failed.slice(0, 3).join("；"));
      throw err;
    }
    if (onProgress) onProgress({ phase: "zip", done: count, total: jobs.length });
    const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename || "THE2027_證據檔_依SDG.zip";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    return { count, failed };
  }

  global.THESubmit = { submitUnit, submitChanged, listSubmissions, mergeAnswers, exportEvidenceZip, fileUrl };
})(window);
