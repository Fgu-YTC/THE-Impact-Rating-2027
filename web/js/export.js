/** Export answers to Excel via SheetJS */
(function (global) {
  function loadScript(src, ready) {
    return new Promise((resolve, reject) => {
      if (ready()) {
        resolve();
        return;
      }
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => resolve();
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function loadXLSX() {
    return loadScript(
      "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js",
      () => global.XLSX
    ).then(() => global.XLSX);
  }

  function loadExcelJS() {
    return loadScript(
      "https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js",
      () => global.ExcelJS
    ).then(() => global.ExcelJS);
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

  function questionParts(text) {
    const raw = String(text || "").trim();
    const lines = raw.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return { title: "", body: "" };
    if (lines.length === 1) return { title: lines[0], body: "" };
    return { title: lines[0], body: lines.slice(1).join("\n") };
  }

  function answerRows(q) {
    if (q.answerType === "continuous") {
      const opts = q.options?.length ? q.options : [{ zh: "數值", en: "Value" }];
      return opts.map((o) => `數字：${o.zh || o.en}`);
    }
    if (q.answerType === "picklist" && q.options?.length) {
      const rows = q.options.map((o) => `這項要做就填 Yes：${o.zh || o.en}`);
      rows.push("證據網址（審核人員要打得開；沒有就留空）");
      rows.push("證據是否公開（已放上公開網頁填 Yes，沒有公開填 No）");
      return rows;
    }
    return [
      "Yes 或 No",
      "證據網址（審核人員要打得開；沒有就留空）",
      "證據是否公開（已放上公開網頁填 Yes，沒有公開填 No）",
    ];
  }

  function sheetName(unitName, used) {
    let name = String(unitName || "單位").replace(/[\\/:*?"<>|[\]]/g, "_").slice(0, 31);
    if (!name) name = "單位";
    let unique = name;
    let n = 2;
    while (used.has(unique)) {
      const suffix = `_${n}`;
      unique = name.slice(0, 31 - suffix.length) + suffix;
      n += 1;
    }
    used.add(unique);
    return unique;
  }

  function styleCell(cell, opts) {
    cell.alignment = { wrapText: true, vertical: "top", horizontal: opts.align || "left" };
    cell.font = { name: "Calibri", size: opts.size || 12, bold: !!opts.bold, color: opts.color ? { argb: opts.color } : undefined };
    cell.border = {
      top: { style: "thin", color: { argb: "FFD9D0C1" } },
      left: { style: "thin", color: { argb: "FFD9D0C1" } },
      bottom: { style: "thin", color: { argb: "FFD9D0C1" } },
      right: { style: "thin", color: { argb: "FFD9D0C1" } },
    };
    if (opts.fill) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: opts.fill } };
    }
  }

  /** 已分派題目做成空白填寫表：一題一區，黃格才是要填的 */
  async function exportAssignedForms({ units, questions, assignments, sdgs, metricsByRef }) {
    const ExcelJS = await loadExcelJS();
    const wb = new ExcelJS.Workbook();
    const used = new Set();
    let sheetCount = 0;

    units.forEach((unit) => {
      const mine = questions
        .filter((q) => (assignments[q.id] || []).includes(unit.id))
        .sort((a, b) => {
          if (a.sdg !== b.sdg) return a.sdg - b.sdg;
          return String(a.ref).localeCompare(String(b.ref), undefined, { numeric: true });
        });
      if (!mine.length) return;

      const ws = wb.addWorksheet(sheetName(unit.name, used), {
        views: [{ state: "frozen", ySplit: 3 }],
        pageSetup: { fitToPage: true, fitToWidth: 1, orientation: "landscape" },
      });
      ws.columns = [
        { width: 14 },
        { width: 46 },
        { width: 42 },
        { width: 28 },
      ];

      ws.mergeCells("A1:D1");
      const title = ws.getCell("A1");
      title.value = `${unit.name}　THE Impact 2027 填寫表`;
      styleCell(title, { bold: true, size: 16, fill: "FFE7F2EC", align: "left" });
      ws.getRow(1).height = 28;

      ws.mergeCells("A2:D2");
      const note = ws.getCell("A2");
      note.value = "只填黃色格子。證據網址必須是審核人員打得開的連結。證據是否公開：Yes＝已經放在公開網頁，No＝沒有公開。";
      styleCell(note, { size: 11, fill: "FFFFF8E8" });
      ws.getRow(2).height = 32;

      ["題號", "題目", "要填的項目", "你的答案"].forEach((text, i) => {
        const cell = ws.getCell(3, i + 1);
        cell.value = text;
        styleCell(cell, { bold: true, fill: "FF1F6B4A", color: "FFFFFFFF", align: "center" });
      });
      ws.getRow(3).height = 22;

      let row = 4;
      let lastSdg = null;
      mine.forEach((q) => {
        if (q.sdg !== lastSdg) {
          lastSdg = q.sdg;
          const meta = (sdgs && sdgs[String(q.sdg)]) || {};
          ws.mergeCells(row, 1, row, 4);
          const sdgCell = ws.getCell(row, 1);
          sdgCell.value = meta.zh || meta.en || `SDG ${q.sdg}`;
          styleCell(sdgCell, { bold: true, fill: "FFDCE8E3" });
          ws.getRow(row).height = 22;
          row += 1;
        }

        const metric = (metricsByRef && metricsByRef[String(q.metricRef)]) || {};
        const zh = questionParts(q.zh);
        const metricTitle = [q.metricRef, metric.zh || q.metricZh || ""].filter(Boolean).join(" ");
        const topic = [metricTitle && `大標題 ${metricTitle}`, zh.title, zh.body].filter(Boolean).join("\n");
        const fills = answerRows(q);
        const start = row;

        fills.forEach((label, i) => {
          const r = ws.getRow(row);
          if (i === 0) {
            ws.getCell(row, 1).value = q.ref;
            ws.getCell(row, 2).value = topic;
          }
          ws.getCell(row, 3).value = label;
          ws.getCell(row, 4).value = "";
          styleCell(ws.getCell(row, 1), { bold: true, fill: "FFF7F4EE", align: "center" });
          styleCell(ws.getCell(row, 2), { fill: "FFF7F4EE" });
          styleCell(ws.getCell(row, 3), { fill: "FFFFFFFF" });
          styleCell(ws.getCell(row, 4), { fill: "FFFFF3C4" });
          const lines = i === 0 ? Math.max(2, topic.split("\n").length) : 1;
          r.height = Math.max(22, lines * 18);
          row += 1;
        });
        if (fills.length > 1) {
          ws.mergeCells(start, 1, row - 1, 1);
          ws.mergeCells(start, 2, row - 1, 2);
        }
        row += 1;
      });
      sheetCount += 1;
    });

    if (!sheetCount) throw new Error("empty");

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "THE2027_單位填寫表.xlsx";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  global.THEExport = { exportUnitAnswers, exportAssignedForms };
})(window);
