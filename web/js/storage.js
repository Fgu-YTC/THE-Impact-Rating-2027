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
    assignQuestionsToUnit,
    unassignQuestionsFromUnit,
    getAnswers,
    setUnitAnswer,
    getUnitAnswers,
    getUnitsOverride,
    setUnitsOverride,
  };
})(window);
