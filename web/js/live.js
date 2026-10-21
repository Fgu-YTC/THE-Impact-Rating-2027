/** 單位題目清單與每一題答案。Firestore，不存填寫人姓名。 */
(function (global) {
  const VERSION = "10.14.1";
  let dbPromise;

  function explain(err) {
    const code = String((err && (err.code || err.message)) || "");
    if (code.includes("permission-denied")) {
      return "Firestore 仍拒絕讀寫。請到 Firestore 規則，貼上只允許 units 與 answers 的那一份後發布。";
    }
    if (code.includes("unavailable") || code.includes("failed-precondition")) {
      return "連不到 Firestore。請確認這個專案已建立 Firestore 資料庫。";
    }
    return code || "Firestore 讀寫失敗。";
  }

  async function db() {
    if (!global.FIREBASE_CONFIG || !global.FIREBASE_CONFIG.projectId) {
      throw new Error("還沒有設定 Firebase。");
    }
    if (!dbPromise) {
      dbPromise = (async () => {
        const { initializeApp, getApp, getApps } = await import(
          `https://www.gstatic.com/firebasejs/${VERSION}/firebase-app.js`
        );
        const fs = await import(`https://www.gstatic.com/firebasejs/${VERSION}/firebase-firestore.js`);
        const app = getApps().length ? getApp() : initializeApp(global.FIREBASE_CONFIG);
        return { store: fs.getFirestore(app), fs };
      })();
    }
    return dbPromise;
  }

  function listenUnits(onData, onError) {
    return listenWith(function (ctx) {
      const { store, fs } = ctx;
      return fs.onSnapshot(
        fs.collection(store, "units"),
        function (snap) {
          const units = [];
          snap.forEach(function (item) {
            const data = item.data() || {};
            units.push({
              id: item.id,
              name: data.name || item.id,
              questionIds: Array.isArray(data.questionIds) ? data.questionIds : [],
            });
          });
          units.sort(function (a, b) {
            return String(a.name).localeCompare(String(b.name), "zh-Hant");
          });
          onData(units);
        },
        onError || function () {}
      );
    }, onError);
  }

  function listenWith(start, onError) {
    let inner = function () {};
    let dead = false;
    db()
      .then(function (ctx) {
        if (dead) return;
        inner = start(ctx);
      })
      .catch(function (err) {
        if (!dead && onError) onError(err);
      });
    return function () {
      dead = true;
      inner();
    };
  }

  function listenUnitAnswers(unitId, onData, onError) {
    return listenWith(function (ctx) {
      const { store, fs } = ctx;
      return fs.onSnapshot(
        fs.collection(store, "units", unitId, "answers"),
        function (snap) {
          const map = {};
          snap.forEach(function (item) {
            map[item.id] = item.data() || {};
          });
          onData(map);
        },
        onError || function () {}
      );
    }, onError);
  }

  function listenUnitOffice(unitId, onData, onError) {
    return listenWith(function (ctx) {
      const { store, fs } = ctx;
      return fs.onSnapshot(
        fs.collection(store, "units", unitId, "office"),
        function (snap) {
          const map = {};
          snap.forEach(function (item) {
            map[item.id] = item.data() || {};
          });
          onData(map);
        },
        onError || function () {}
      );
    }, onError);
  }

  function listenAllAnswers(onData, onError) {
    return listenWith(function (ctx) {
      const { store, fs } = ctx;
      return fs.onSnapshot(
        fs.collectionGroup(store, "answers"),
        function (snap) {
          const byUnit = {};
          snap.forEach(function (item) {
            const unitId = item.ref.parent.parent.id;
            if (!byUnit[unitId]) byUnit[unitId] = { unitId, updatedAt: "", answers: {} };
            const data = item.data() || {};
            byUnit[unitId].answers[item.id] = data;
            if (String(data.updatedAt || "") > byUnit[unitId].updatedAt) {
              byUnit[unitId].updatedAt = data.updatedAt;
            }
          });
          onData(Object.values(byUnit));
        },
        onError || function () {}
      );
    }, onError);
  }

  async function seedIfEmpty(localUnits, assignmentMap) {
    const { store, fs } = await db();
    const snap = await fs.getDocs(fs.collection(store, "units"));
    if (!snap.empty) return false;
    const byUnit = {};
    (localUnits || []).forEach(function (unit) {
      if (!unit || !unit.id || !unit.name) return;
      byUnit[unit.id] = { name: String(unit.name).slice(0, 79), questionIds: [] };
    });
    Object.entries(assignmentMap || {}).forEach(function (entry) {
      const questionId = entry[0];
      (entry[1] || []).forEach(function (unitId) {
        if (!byUnit[unitId]) byUnit[unitId] = { name: unitId, questionIds: [] };
        if (!byUnit[unitId].questionIds.includes(questionId)) byUnit[unitId].questionIds.push(questionId);
      });
    });
    const ids = Object.keys(byUnit);
    if (!ids.length) return false;
    const batch = fs.writeBatch(store);
    ids.forEach(function (id) {
      batch.set(fs.doc(store, "units", id), byUnit[id]);
    });
    await batch.commit();
    return true;
  }

  async function addUnit(id, name) {
    const { store, fs } = await db();
    await fs.setDoc(fs.doc(store, "units", id), {
      name: String(name).slice(0, 79),
      questionIds: [],
    });
  }

  async function assignQuestions(unitId, questionIds) {
    if (!questionIds.length) return;
    const { store, fs } = await db();
    await fs.setDoc(
      fs.doc(store, "units", unitId),
      { questionIds: fs.arrayUnion.apply(null, questionIds) },
      { merge: true }
    );
  }

  async function unassignQuestions(unitId, questionIds) {
    if (!questionIds.length) return;
    const { store, fs } = await db();
    await fs.setDoc(
      fs.doc(store, "units", unitId),
      { questionIds: fs.arrayRemove.apply(null, questionIds) },
      { merge: true }
    );
  }

  async function clearAssignments() {
    const { store, fs } = await db();
    const snap = await fs.getDocs(fs.collection(store, "units"));
    if (snap.empty) return;
    const batch = fs.writeBatch(store);
    snap.forEach(function (item) {
      batch.update(item.ref, { questionIds: [] });
    });
    await batch.commit();
  }

  function sanitizeAnswer(answer, updatedAt) {
    const source = answer || {};
    const out = { updatedAt: updatedAt };
    ["yesNo", "public", "comment", "evidence", "evidenceFileName", "evidenceStoredName", "evidenceFilePath", "evidenceFileUrl"].forEach(
      function (key) {
        if (typeof source[key] === "string") out[key] = source[key];
      }
    );
    if (Array.isArray(source.options)) out.options = source.options.map(function (item) { return String(item); });
    if (source.values && typeof source.values === "object") {
      const values = {};
      Object.entries(source.values).forEach(function (entry) {
        if (entry[1] != null && String(entry[1]) !== "") values[entry[0]] = String(entry[1]);
      });
      out.values = values;
    }
    if (out.comment) out.comment = out.comment.slice(0, 1000);
    if (out.evidence) out.evidence = out.evidence.slice(0, 2000);
    return out;
  }

  async function saveAnswers(unitId, entries) {
    if (!entries.length) return;
    const { store, fs } = await db();
    const batch = fs.writeBatch(store);
    const updatedAt = new Date().toISOString();
    entries.forEach(function (entry) {
      batch.set(
        fs.doc(store, "units", unitId, "answers", entry.questionId),
        sanitizeAnswer(entry.answer, updatedAt)
      );
    });
    await batch.commit();
  }

  async function saveOfficeAnswers(unitId, entries, source) {
    if (!entries.length) return;
    const { store, fs } = await db();
    const batch = fs.writeBatch(store);
    const updatedAt = new Date().toISOString();
    const unitName = String((source && source.unitName) || "").slice(0, 79);
    entries.forEach(function (entry) {
      const answer = sanitizeAnswer(entry.answer, updatedAt);
      answer.editor = "永續辦";
      answer.sourceUnitId = String(unitId);
      answer.sourceUnitName = unitName;
      batch.set(fs.doc(store, "units", unitId, "office", entry.questionId), answer);
    });
    await batch.commit();
  }

  global.THELive = {
    explain,
    listenUnits,
    listenUnitAnswers,
    listenUnitOffice,
    listenAllAnswers,
    seedIfEmpty,
    addUnit,
    assignQuestions,
    unassignQuestions,
    clearAssignments,
    saveAnswers,
    saveOfficeAnswers,
  };
})(window);
