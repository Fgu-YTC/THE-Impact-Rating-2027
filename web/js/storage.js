/** localStorage helpers for assignments & answers */
(function (global) {
  const KEYS = {
    assignments: "the2027_assignments", // { [questionId]: string[] unitIds }
    answers: "the2027_answers", // { [unitId]: { [questionId]: answerObj } }
    units: "the2027_units_override",
  };

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function getAssignments() {
    return read(KEYS.assignments, {});
  }

  function setAssignments(map) {
    write(KEYS.assignments, map);
  }

  function clearAssignments() {
    setAssignments({});
  }

  /** Drop unit ids that are no longer in the unit list (e.g. removed placeholders). */
  function pruneAssignments(validUnitIds) {
    const valid = new Set(validUnitIds);
    const map = getAssignments();
    let changed = false;
    Object.keys(map).forEach((qid) => {
      const next = (map[qid] || []).filter((id) => valid.has(id));
      if (next.length !== (map[qid] || []).length) {
        changed = true;
        if (next.length) map[qid] = next;
        else delete map[qid];
      }
    });
    if (changed) setAssignments(map);
    return map;
  }

  const RESET_KEY = "the2027_assignment_reset";

  /** Clear every assignment once per token, so a published reset actually runs in this browser. */
  function resetAssignmentsOnce(token) {
    if (localStorage.getItem(RESET_KEY) === token) return false;
    clearAssignments();
    localStorage.setItem(RESET_KEY, token);
    return true;
  }

  /** Assign selected question ids to a unit (merge, no duplicates) */
  function assignQuestionsToUnit(questionIds, unitId) {
    const map = getAssignments();
    questionIds.forEach((qid) => {
      const list = map[qid] ? [...map[qid]] : [];
      if (!list.includes(unitId)) list.push(unitId);
      map[qid] = list;
    });
    setAssignments(map);
    return map;
  }

  function unassignQuestionsFromUnit(questionIds, unitId) {
    const map = getAssignments();
    questionIds.forEach((qid) => {
      if (!map[qid]) return;
      map[qid] = map[qid].filter((id) => id !== unitId);
      if (!map[qid].length) delete map[qid];
    });
    setAssignments(map);
    return map;
  }

  function getAnswers() {
    return read(KEYS.answers, {});
  }

  function setUnitAnswer(unitId, questionId, answer) {
    const all = getAnswers();
    if (!all[unitId]) all[unitId] = {};
    all[unitId][questionId] = answer;
    write(KEYS.answers, all);
  }

  function getUnitAnswers(unitId) {
    return getAnswers()[unitId] || {};
  }

  function getUnitsOverride() {
    return read(KEYS.units, null);
  }

  function setUnitsOverride(units) {
    write(KEYS.units, units);
  }

  global.THEStorage = {
    KEYS,
    getAssignments,
    setAssignments,
    clearAssignments,
    pruneAssignments,
    resetAssignmentsOnce,
    assignQuestionsToUnit,
    unassignQuestionsFromUnit,
    getAnswers,
    setUnitAnswer,
    getUnitAnswers,
    getUnitsOverride,
    setUnitsOverride,
  };
})(window);
