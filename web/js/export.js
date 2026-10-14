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

  function loadExcelJS() {
    return loadScript(
      "https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js",
      () => global.ExcelJS
    ).then(() => global.ExcelJS);
  }

  function topicText(q, metricsByRef) {
    const metric = (metricsByRef && metricsByRef[String(q.metricRef)]) || {};
    const zh = questionParts(q.zh);
    const en = questionParts(q.en);
    const lines = [];
    const metricLine = [q.metricRef, metric.zh || q.metricZh || ""].filter(Boolean).join("　");
    if (metricLine) lines.push(metricLine);
    if (zh.title) lines.push(zh.title);
    if (zh.body) lines.push(zh.body);
    const enLines = [en.title, en.body].filter(Boolean);
    if (enLines.length) {
      lines.push("");
      lines.push(...enLines);
    }
    return lines.join("\n");
  }

  function textUnits(text) {
    let n = 0;
    for (const ch of String(text || "")) n += ch.charCodeAt(0) > 255 ? 2 : 1;
    return n;
  }

  function estimateLines(text, width) {
    return String(text || "").split("\n").reduce((sum, line) => {
      if (!line) return sum + 1;
      return sum + Math.max(1, Math.ceil(textUnits(line) / width));
    }, 0);
  }

  function fillItems(q, answer) {
    const a = answer || {};
    if (q.answerType === "continuous") {
      const opts = q.options?.length ? q.options : [{ zh: "數值", en: "Value" }];
      const values = a.values || {};
      return opts.map((o, i) => ({
        label: o.zh || o.en || "數值",
        value: values[`v${i}`] != null && values[`v${i}`] !== "" ? String(values[`v${i}`]) : "",
      }));
    }
    if (q.answerType === "picklist" && q.options?.length) {
      const selected = new Set(a.options || []);
      return [
        ...q.options.map((o) => ({
          label: `這項要做就填 Yes：${o.zh || o.en}`,
          value: selected.has(o.en) || selected.has(o.zh) ? "Yes" : "",
        })),
        { label: "證據網址（審核人員要打得開；沒有就留空）", value: a.evidence || "" },
        {
          label: "證據是否公開（已放上公開網頁填 Yes，沒有公開填 No）",
          value: a.public ? String(a.public).toUpperCase() : "",
        },
      ];
    }
    return [
      { label: "Yes 或 No", value: a.yesNo ? String(a.yesNo).toUpperCase() : "" },
      { label: "證據網址（審核人員要打得開；沒有就留空）", value: a.evidence || "" },
      {
        label: "證據是否公開（已放上公開網頁填 Yes，沒有公開填 No）",
        value: a.public ? String(a.public).toUpperCase() : "",
      },
    ];
  }

  function addUnitSheet(wb, used, { unit, questions, answers, sdgs, metricsByRef }) {
    const mine = [...questions].sort((a, b) => {
      if (a.sdg !== b.sdg) return a.sdg - b.sdg;
      return String(a.ref).localeCompare(String(b.ref), undefined, { numeric: true });
    });
    if (!mine.length) return false;

    const ws = wb.addWorksheet(sheetName(unit.name, used), {
      views: [{ state: "frozen", ySplit: 3, showGridLines: false }],
      pageSetup: { fitToPage: true, fitToWidth: 1, orientation: "landscape", paperSize: 9 },
    });
    ws.columns = [{ width: 12 }, { width: 62 }, { width: 36 }, { width: 28 }];

    ws.mergeCells("A1:D1");
    const title = ws.getCell("A1");
    title.value = `${unit.name}　THE Impact 2027 填寫表`;
    styleCell(title, { bold: true, size: 16, fill: "FFE7F2EC" });
    ws.getRow(1).height = 30;

    ws.mergeCells("A2:D2");
    const note = ws.getCell("A2");
    note.value =
      "題目在第二欄，由上到下是大標題、中文題目、空一行、英文題目。只填黃色格子。證據網址必須是審核人員打得開的連結。";
    styleCell(note, { size: 11, fill: "FFFFF8E8" });
    ws.getRow(2).height = 36;

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
        styleCell(sdgCell, { bold: true, size: 13, fill: "FFDCE8E3" });
        ws.getRow(row).height = 24;
        row += 1;
      }

      const topic = topicText(q, metricsByRef);
      const fills = fillItems(q, answers && answers[q.id]);
      const start = row;
      const per = Math.max(28, Math.ceil((estimateLines(topic, 56) * 18) / fills.length));

      fills.forEach((item) => {
        if (row === start) {
          ws.getCell(row, 1).value = q.ref;
          ws.getCell(row, 2).value = topic;
        }
        ws.getCell(row, 3).value = item.label;
        ws.getCell(row, 4).value = item.value;
        styleCell(ws.getCell(row, 1), { bold: true, fill: "FFF7F4EE", align: "center" });
        styleCell(ws.getCell(row, 2), { fill: "FFF7F4EE" });
        styleCell(ws.getCell(row, 3), { fill: "FFFFFFFF" });
        styleCell(ws.getCell(row, 4), { fill: "FFFFF3C4" });
        ws.getRow(row).height = Math.max(per, estimateLines(item.label, 32) * 18);
        row += 1;
      });
      if (fills.length > 1) {
        ws.mergeCells(start, 1, row - 1, 1);
        ws.mergeCells(start, 2, row - 1, 2);
      }
      row += 1;
    });
    return true;
  }

  async function downloadWorkbook(wb, filename) {
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function exportUnitAnswers({ unit, questions, answers, sdgs, metricsByRef }) {
    const ExcelJS = await loadExcelJS();
    const wb = new ExcelJS.Workbook();
    const ok = addUnitSheet(wb, new Set(), { unit, questions, answers, sdgs, metricsByRef });
    if (!ok) throw new Error("empty");
    const safe = String(unit.name).replace(/[\\/:*?"<>|]/g, "_");
    await downloadWorkbook(wb, `THE2027_填報_${safe}.xlsx`);
  }

  function questionParts(text) {
    const raw = String(text || "").trim();
    const lines = raw.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return { title: "", body: "" };
    if (lines.length === 1) return { title: lines[0], body: "" };
    return { title: lines[0], body: lines.slice(1).join("\n") };
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

  async function exportAssignedForms({ units, questions, assignments, sdgs, metricsByRef }) {
    const ExcelJS = await loadExcelJS();
    const wb = new ExcelJS.Workbook();
    const used = new Set();
    let sheetCount = 0;
    units.forEach((unit) => {
      const mine = questions.filter((q) => (assignments[q.id] || []).includes(unit.id));
      if (
        addUnitSheet(wb, used, {
          unit,
          questions: mine,
          answers: {},
          sdgs,
          metricsByRef,
        })
      ) {
        sheetCount += 1;
      }
    });
    if (!sheetCount) throw new Error("empty");
    await downloadWorkbook(wb, "THE2027_單位填寫表.xlsx");
  }

  global.THEExport = { exportUnitAnswers, exportAssignedForms };
})(window);
