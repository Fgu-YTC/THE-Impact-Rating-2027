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

  const FONT = "Microsoft JhengHei";

  function topicRich(q, metricsByRef) {
    const metric = (metricsByRef && metricsByRef[String(q.metricRef)]) || {};
    const zh = questionParts(q.zh);
    const en = questionParts(q.en);
    const richText = [];
    const metricLine = [q.metricRef, metric.zh || q.metricZh || ""].filter(Boolean).join("　");
    if (metricLine) {
      richText.push({
        font: { name: FONT, size: 11, bold: true, color: { argb: "FF1F6B4A" } },
        text: metricLine + "\n",
      });
    }
    if (zh.title) {
      richText.push({
        font: { name: FONT, size: 16, bold: true, color: { argb: "FF1A2E26" } },
        text: zh.title,
      });
    }
    if (zh.body) {
      richText.push({
        font: { name: FONT, size: 12, color: { argb: "FF24322C" } },
        text: (zh.title ? "\n" : "") + zh.body,
      });
    }
    const enLines = [en.title, en.body].filter(Boolean);
    if (enLines.length) {
      richText.push({
        font: { name: FONT, size: 10, italic: true, color: { argb: "FF6B7C74" } },
        text: "\n" + enLines.join("\n"),
      });
    }
    const plain = [
      metricLine,
      zh.title,
      zh.body,
      enLines.length ? "" : "",
      ...enLines,
    ]
      .filter((line) => line !== undefined)
      .join("\n");
    return { richText, plain };
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
        kind: "number",
      }));
    }
    if (q.answerType === "picklist" && q.options?.length) {
      const selected = new Set(a.options || []);
      return [
        ...q.options.map((o) => ({
          label: o.zh || o.en,
          value: selected.has(o.en) || selected.has(o.zh) ? "Yes" : "",
          kind: "yesno",
        })),
        { label: "證據網址", value: a.evidence || "", kind: "text" },
        {
          label: "證據是否已放上公開網頁",
          value: a.public ? String(a.public).toUpperCase() : "",
          kind: "yesno",
        },
      ];
    }
    return [
      { label: "有沒有做到", value: a.yesNo ? String(a.yesNo).toUpperCase() : "", kind: "yesno" },
      { label: "證據網址", value: a.evidence || "", kind: "text" },
      {
        label: "證據是否已放上公開網頁",
        value: a.public ? String(a.public).toUpperCase() : "",
        kind: "yesno",
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
      views: [{ showGridLines: false }],
      pageSetup: {
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        orientation: "portrait",
        paperSize: 9,
        horizontalCentered: true,
      },
      pageMargins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.2, footer: 0.2 },
    });
    ws.properties.defaultRowHeight = 22;
    ws.columns = [{ width: 38 }, { width: 52 }];

    ws.mergeCells("A1:B1");
    const title = ws.getCell("A1");
    title.value = unit.name;
    styleCell(title, { bold: true, size: 20, fill: "FF1F6B4A", color: "FFFFFFFF" });
    ws.getRow(1).height = 36;

    ws.mergeCells("A2:B2");
    const note = ws.getCell("A2");
    note.value = "THE Impact 2027　只填黃色格子。Yes／No 請用下拉選單。證據網址要讓審核人員打得開。";
    styleCell(note, { size: 10, fill: "FFF4F7F5", color: "FF3D4F46" });
    ws.getRow(2).height = 24;

    let row = 4;
    let lastSdg = null;
    mine.forEach((q) => {
      if (q.sdg !== lastSdg) {
        lastSdg = q.sdg;
        const meta = (sdgs && sdgs[String(q.sdg)]) || {};
        ws.mergeCells(row, 1, row, 2);
        const sdgCell = ws.getCell(row, 1);
        sdgCell.value = meta.zh || meta.en || `SDG ${q.sdg}`;
        styleCell(sdgCell, { bold: true, size: 13, fill: "FFDCE8E3", color: "FF1F6B4A" });
        ws.getRow(row).height = 26;
        row += 1;
      }

      const topic = topicRich(q, metricsByRef);
      const refCell = ws.getCell(row, 1);
      refCell.value = q.ref;
      styleCell(refCell, { bold: true, size: 14, fill: "FF1F6B4A", color: "FFFFFFFF", align: "center", middle: true });
      const qCell = ws.getCell(row, 2);
      qCell.value = { richText: topic.richText };
      styleCell(qCell, { fill: "FFF7F4EE", size: 12 });
      ws.getRow(row).height = Math.max(48, estimateLines(topic.plain, 48) * 16);
      row += 1;

      fillItems(q, answers && answers[q.id]).forEach((item) => {
        const labelCell = ws.getCell(row, 1);
        labelCell.value = item.label;
        styleCell(labelCell, { fill: "FFFFFFFF", color: "FF3D4F46" });
        const answerCell = ws.getCell(row, 2);
        answerCell.value = item.value;
        styleCell(answerCell, {
          fill: "FFFFF3C4",
          align: "left",
          border: "FFD4B44A",
        });
        if (item.kind === "yesno") {
          ws.dataValidations.add(answerCell.address, {
            type: "list",
            allowBlank: true,
            formulae: ['"Yes,No"'],
            showErrorMessage: true,
            errorTitle: "請選擇",
            error: "請選 Yes 或 No",
          });
        }
        ws.getRow(row).height = Math.max(24, estimateLines(item.label, 34) * 18);
        row += 1;
      });

      ws.getRow(row).height = 14;
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
    const line = opts.border || "FFE4DDD2";
    cell.alignment = {
      wrapText: true,
      vertical: opts.middle ? "middle" : "top",
      horizontal: opts.align || "left",
    };
    if (!(cell.value && cell.value.richText)) {
      cell.font = {
        name: FONT,
        size: opts.size || 12,
        bold: !!opts.bold,
        color: opts.color ? { argb: opts.color } : { argb: "FF24322C" },
      };
    }
    cell.border = {
      top: { style: "thin", color: { argb: line } },
      left: { style: "thin", color: { argb: line } },
      bottom: { style: "thin", color: { argb: line } },
      right: { style: "thin", color: { argb: line } },
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
