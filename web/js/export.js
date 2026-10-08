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

  global.THEExport = { exportUnitAnswers };
})(window);
