/** 單位題目清單與每一題答案。Firestore，不存填寫人姓名。 */
(function (global) {
  const VERSION = "10.14.1";
  let dbPromise;

  function explain(err) {
    const code = String((err && (err.code || err.message)) || "");
    if (code.includes("permission-denied")) {
      return "Firestore 仍拒絕讀寫。請確認已發布含 units／answers／returns 的規則。";
    }
    if (code.includes("not-found") || code.includes("unit-missing")) {
      return "找不到這個單位，請重新整理後再分派。";
    }
    if (code.includes("questionIds-limit")) {
      return "分派題數超過上限（每單位少於 400 題）。";
    }
    if (code.includes("assign-verify-failed")) {
      return "分派寫入後核對失敗，請再試一次。";
    }
    if (code.includes("unavailable") || code.includes("failed-precondition")) {
      return "連不到 Firestore，或寫入後資料不一致。請確認已建立資料庫後再試。";
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
              group: String(data.group || "").trim(),
            });
          });
          units.sort(function (a, b) {
            const ga = String(a.group || "");
            const gb = String(b.group || "");
            if (ga !== gb) return ga.localeCompare(gb, "zh-Hant");
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
      const name = String(unit.name).slice(0, 79);
      byUnit[unit.id] = {
        name: name,
        questionIds: [],
        group: String(unit.group || inferUnitGroup(name)).slice(0, 39),
      };
    });
    Object.entries(assignmentMap || {}).forEach(function (entry) {
      const questionId = entry[0];
      (entry[1] || []).forEach(function (unitId) {
        if (!byUnit[unitId]) {
          byUnit[unitId] = {
            name: unitId,
            questionIds: [],
            group: inferUnitGroup(unitId),
          };
        }
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

  function inferUnitGroup(name) {
    const n = String(name || "");
    if (/院$/.test(n) || n.includes("學院")) return "院";
    return "行政單位";
  }

  async function addUnit(id, name, group) {
    const { store, fs } = await db();
    const g = String(group || inferUnitGroup(name)).trim().slice(0, 39) || "行政單位";
    await fs.setDoc(fs.doc(store, "units", id), {
      name: String(name).slice(0, 79),
      questionIds: [],
      group: g,
    });
  }

  async function setUnitGroup(unitId, group) {
    if (!unitId) return;
    const { store, fs } = await db();
    const g = String(group || "").trim().slice(0, 39);
    if (!g) throw new Error("請選擇分組");
    await fs.setDoc(fs.doc(store, "units", unitId), { group: g }, { merge: true });
  }

  /** 補上缺少的 group；並確保 meta/unitGroups 有預設分組 */
  async function ensureUnitGroups(units) {
    const { store, fs } = await db();
    const metaRef = fs.doc(store, "meta", "unitGroups");
    const metaSnap = await fs.getDoc(metaRef);
    let groups = ["院", "行政單位"];
    if (metaSnap.exists()) {
      const raw = (metaSnap.data() || {}).groups;
      if (Array.isArray(raw) && raw.length) {
        groups = raw.map(function (g) {
          return String(g || "").trim();
        }).filter(Boolean);
      }
    } else {
      await fs.setDoc(metaRef, { groups: groups });
    }
    const need = (units || []).filter(function (u) {
      return u && u.id && !String(u.group || "").trim();
    });
    if (need.length) {
      const batch = fs.writeBatch(store);
      need.forEach(function (u) {
        batch.set(
          fs.doc(store, "units", u.id),
          { group: inferUnitGroup(u.name) },
          { merge: true }
        );
      });
      await batch.commit();
    }
    return groups;
  }

  function listenUnitGroups(onData, onError) {
    return listenWith(function (ctx) {
      const { store, fs } = ctx;
      return fs.onSnapshot(
        fs.doc(store, "meta", "unitGroups"),
        function (snap) {
          let groups = ["院", "行政單位"];
          if (snap.exists()) {
            const raw = (snap.data() || {}).groups;
            if (Array.isArray(raw) && raw.length) {
              groups = raw
                .map(function (g) {
                  return String(g || "").trim();
                })
                .filter(Boolean);
            }
          }
          onData(groups);
        },
        onError || function () {}
      );
    }, onError);
  }

  async function saveUnitGroups(groups) {
    const { store, fs } = await db();
    const cleaned = (groups || [])
      .map(function (g) {
        return String(g || "").trim().slice(0, 39);
      })
      .filter(Boolean);
    const uniq = [];
    cleaned.forEach(function (g) {
      if (!uniq.includes(g)) uniq.push(g);
    });
    if (!uniq.length) throw new Error("至少保留一個分組");
    await fs.setDoc(fs.doc(store, "meta", "unitGroups"), { groups: uniq });
    return uniq;
  }

  async function removeUnit(unitId) {
    if (!unitId) return;
    const { store, fs } = await db();
    const batch = fs.writeBatch(store);
    const answers = await fs.getDocs(fs.collection(store, "units", unitId, "answers"));
    answers.forEach(function (item) {
      batch.delete(item.ref);
    });
    const office = await fs.getDocs(fs.collection(store, "units", unitId, "office"));
    office.forEach(function (item) {
      batch.delete(item.ref);
    });
    batch.delete(fs.doc(store, "units", unitId));
    await batch.commit();
  }

  async function assignQuestions(unitId, questionIds) {
    const ids = [...new Set((questionIds || []).filter(Boolean).map(String))];
    if (!unitId || !ids.length) return { added: 0, total: 0 };
    const { store, fs } = await db();
    const ref = fs.doc(store, "units", unitId);
    const snap = await fs.getDoc(ref);
    if (!snap.exists()) {
      const err = new Error("unit-missing");
      err.code = "not-found";
      throw err;
    }
    const data = snap.data() || {};
    const before = Array.isArray(data.questionIds) ? data.questionIds.map(String) : [];
    const merged = [...new Set(before.concat(ids))];
    if (merged.length >= 400) {
      const err = new Error("questionIds-limit");
      err.code = "invalid-argument";
      throw err;
    }
    const payload = {
      name: String(data.name || "").trim() || unitId,
      questionIds: merged,
    };
    if (data.group) payload.group = String(data.group);
    // 寫完整清單（含 name／group），避免只送 arrayUnion 時規則／合併結果難驗證
    await fs.setDoc(ref, payload, { merge: true });
    const verify = await fs.getDoc(ref);
    const saved = ((verify.data() || {}).questionIds || []).map(String);
    const missing = ids.filter(function (id) {
      return saved.indexOf(id) < 0;
    });
    if (missing.length) {
      const err = new Error("assign-verify-failed:" + missing.slice(0, 3).join(","));
      err.code = "failed-precondition";
      throw err;
    }
    return { added: merged.length - before.length, total: saved.length };
  }

  async function unassignQuestions(unitId, questionIds) {
    const ids = [...new Set((questionIds || []).filter(Boolean).map(String))];
    if (!unitId || !ids.length) return { removed: 0, total: 0 };
    const { store, fs } = await db();
    const ref = fs.doc(store, "units", unitId);
    const snap = await fs.getDoc(ref);
    if (!snap.exists()) return { removed: 0, total: 0 };
    const data = snap.data() || {};
    const before = Array.isArray(data.questionIds) ? data.questionIds.map(String) : [];
    const remove = new Set(ids);
    const merged = before.filter(function (id) {
      return !remove.has(id);
    });
    const payload = {
      name: String(data.name || "").trim() || unitId,
      questionIds: merged,
    };
    if (data.group) payload.group = String(data.group);
    await fs.setDoc(ref, payload, { merge: true });
    return { removed: before.length - merged.length, total: merged.length };
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
    ["yesNo", "public", "comment", "evidence", "evidenceFileName", "evidenceStoredName", "evidenceFilePath", "evidenceFileUrl", "filledBy"].forEach(
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
    if (out.filledBy) out.filledBy = out.filledBy.trim().slice(0, 40);
    if (!out.filledBy) delete out.filledBy;
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

  function listenUnitReturns(unitId, onData, onError) {
    return listenWith(function (ctx) {
      const { store, fs } = ctx;
      return fs.onSnapshot(
        fs.collection(store, "units", unitId, "returns"),
        function (snap) {
          const map = {};
          snap.forEach(function (item) {
            map[item.id] = item.data() || {};
          });
          onData(map);
        },
        onError
      );
    }, onError);
  }

  async function saveReturn(unitId, questionId, suggestion, filledBy) {
    if (!unitId || !questionId) return;
    const note = String(suggestion || "").trim().slice(0, 500);
    if (!note) throw new Error("請填寫退回建議；若無建議請填「無」。");
    const { store, fs } = await db();
    const payload = {
      suggestion: note,
      updatedAt: new Date().toISOString(),
    };
    const who = String(filledBy || "").trim().slice(0, 40);
    if (who) payload.filledBy = who;
    await fs.setDoc(fs.doc(store, "units", unitId, "returns", questionId), payload);
  }

  async function clearReturn(unitId, questionId) {
    if (!unitId || !questionId) return;
    const { store, fs } = await db();
    await fs.deleteDoc(fs.doc(store, "units", unitId, "returns", questionId));
  }

  /** 重新分配前清掉各單位對該題的退回紀錄（分批，避免一次超過 500 筆 batch 上限） */
  async function clearReturnsForQuestions(questionIds) {
    const ids = (questionIds || []).filter(Boolean);
    if (!ids.length) return;
    const { store, fs } = await db();
    const snap = await fs.getDocs(fs.collection(store, "units"));
    if (snap.empty) return;
    const refs = [];
    snap.forEach(function (unitDoc) {
      ids.forEach(function (questionId) {
        refs.push(fs.doc(store, "units", unitDoc.id, "returns", questionId));
      });
    });
    const chunk = 450;
    for (let i = 0; i < refs.length; i += chunk) {
      const batch = fs.writeBatch(store);
      refs.slice(i, i + chunk).forEach(function (ref) {
        batch.delete(ref);
      });
      await batch.commit();
    }
  }

  global.THELive = {
    explain,
    listenUnits,
    listenUnitAnswers,
    listenUnitOffice,
    listenUnitReturns,
    listenAllAnswers,
    seedIfEmpty,
    addUnit,
    setUnitGroup,
    inferUnitGroup,
    ensureUnitGroups,
    listenUnitGroups,
    saveUnitGroups,
    removeUnit,
    assignQuestions,
    unassignQuestions,
    clearAssignments,
    saveAnswers,
    saveOfficeAnswers,
    saveReturn,
    clearReturn,
    clearReturnsForQuestions,
  };
})(window);
