/** Export answers to Excel via SheetJS */
(function (global) {
  function loadXLSX() {
    return new Promise((resolve, reject) => {
      if (global.XLSX) {
        resolve(global.XLSX);
        return;
      }
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
      s.onload = () => resolve(global.XLSX);
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function exportUnitAnswers({ unit, questions, answers, sdgs }) {
    const XLSX = await loadXLSX();
    const rows = [
      [
        "單位",
        "SDG",
        "SDG名稱",
        "Reference",
        "English",
        "中文",
        "YesNo",
        "Value",
        "Options",
        "Evidence",
        "Public",
      ],
    ];

    const assigned = questions.filter((q) => {
      // caller may already filter; still safe
      return true;
    });

    assigned.forEach((q) => {
      const a = answers[q.id] || {};
      const sdgMeta = (sdgs && sdgs[String(q.sdg)]) || {};
      rows.push([
        unit.name,
        q.sdg,
        sdgMeta.zh || sdgMeta.en || `SDG${q.sdg}`,
        q.ref,
        q.en,
        q.zh,
        a.yesNo || "",
        a.value || "",
        Array.isArray(a.options) ? a.options.join("; ") : a.options || "",
        a.evidence || "",
        a.public || "",
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [
      { wch: 18 },
      { wch: 6 },
      { wch: 18 },
      { wch: 10 },
      { wch: 50 },
      { wch: 50 },
      { wch: 8 },
      { wch: 14 },
      { wch: 24 },
      { wch: 30 },
      { wch: 8 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "填報");
    const safe = String(unit.name).replace(/[\\/:*?"<>|]/g, "_");
    XLSX.writeFile(wb, `THE2027_填報_${safe}.xlsx`);
  }

  function fillGuide(q) {
    if (q.answerType === "continuous") {
      return "依「請填欄位」順序填數字，多個以分號隔開。Evidence 與 Public 留空。";
    }
    if (q.answerType === "picklist") {
      return "在「填寫內容」填勾選項目，多個以分號隔開。Yes/No 可留空。有證據再填 Evidence，Public 填證據是否公開（Yes 或 No）。";
    }
    return "Yes/No 填 Yes 或 No。有證據再填 Evidence 網址，Public 填證據是否公開（Yes 或 No）。";
  }

  function fieldList(q) {
    return (q.options || [])
      .map((o) => o.zh || o.en)
      .filter(Boolean)
      .join("；");
  }

  /** 已分派題目做成空白填寫表，一個單位一張工作表 */
  async function exportAssignedForms({ units, questions, assignments, sdgs, metricsByRef }) {
    const XLSX = await loadXLSX();
    const headers = [
      "SDG",
      "題號",
      "大標題",
      "中文題目",
      "英文題目",
      "怎麼填",
      "請填欄位",
      "Yes/No",
      "填寫內容",
      "Evidence",
      "Public",
    ];
    const wb = XLSX.utils.book_new();
    let sheetCount = 0;

    units.forEach((unit) => {
      const mine = questions
        .filter((q) => (assignments[q.id] || []).includes(unit.id))
        .sort((a, b) => {
          if (a.sdg !== b.sdg) return a.sdg - b.sdg;
          return String(a.ref).localeCompare(String(b.ref), undefined, { numeric: true });
        });
      if (!mine.length) return;
      const rows = [headers];
      mine.forEach((q) => {
        const metric = (metricsByRef && metricsByRef[String(q.metricRef)]) || {};
        const metricTitle = [q.metricRef, metric.zh || q.metricZh || ""].filter(Boolean).join(" ");
        rows.push([
          q.sdg,
          q.ref,
          metricTitle,
          q.zh || "",
          q.en || "",
          fillGuide(q),
          fieldList(q),
          "",
          "",
          q.answerType === "continuous" ? "" : "",
          q.answerType === "continuous" ? "" : "",
        ]);
      });
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = [
        { wch: 6 },
        { wch: 10 },
        { wch: 28 },
        { wch: 42 },
        { wch: 42 },
        { wch: 36 },
        { wch: 36 },
        { wch: 10 },
        { wch: 24 },
        { wch: 28 },
        { wch: 10 },
      ];
      let name = String(unit.name).replace(/[\\/:*?"<>|\[\]]/g, "_").slice(0, 31);
      if (!name) name = "單位";
      const used = new Set(wb.SheetNames);
      let unique = name;
      let n = 2;
      while (used.has(unique)) {
        const suffix = `_${n}`;
        unique = name.slice(0, 31 - suffix.length) + suffix;
        n += 1;
      }
      XLSX.utils.book_append_sheet(wb, ws, unique);
      sheetCount += 1;
    });

    if (!sheetCount) {
      throw new Error("empty");
    }
    XLSX.writeFile(wb, "THE2027_單位填寫表.xlsx");
  }

  global.THEExport = { exportUnitAnswers, exportAssignedForms };
})(window);
