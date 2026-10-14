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
    return String(name || "file").replace(/[\\/:*?"<>|#]/g, "_");
  }

  function explain(err) {
    const code = err && (err.code || err.message || "");
    if (String(code).includes("storage/unauthorized")) {
      return "系統還不允許寫入。請到 Firebase Storage 規則，允許 submissions 與 evidence 上傳。";
    }
    if (String(code).includes("storage/unknown") || String(code).includes("storage/retry-limit-exceeded")) {
      return "連不到 Storage。請確認 Firebase Storage 已啟用。";
    }
    return "提交失敗，請再試一次。";
  }

  async function submitUnit({ unitId, unitName, answers, files, onFileUploaded }) {
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
        const path = `evidence/${unitId}/${questionId}/${Date.now()}-${safeName(file.name)}`;
        const stored = ref(bucket, path);
        await uploadBytes(stored, file, { contentType: file.type || "application/octet-stream" });
        const evidenceFileUrl = await getDownloadURL(stored);
        const info = { evidenceFileName: file.name, evidenceFileUrl };
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
    const { ref, listAll, getBytes } = await import(
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
      const bytes = await getBytes(item);
      const text = new TextDecoder().decode(bytes);
      packs.push(JSON.parse(text));
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

  global.THESubmit = { submitUnit, listSubmissions, mergeAnswers };
})(window);
