/** Resolve + format methodology (PDF-like; definitions as tables) */
(function (global) {
  function pack(lang, methodologyZh, methodologyEn) {
    return lang === "en" ? methodologyEn : methodologyZh;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function cleanRaw(raw) {
    let text = String(raw || "");
    text = text.replace(/泰晤士高等教育[\s\S]{0,80}?用戶指南\s*2027/g, "\n");
    text = text.replace(/THE SUSTAINABILITY IMPACT RATINGS[^\n]*/gi, "\n");
    text = text.replace(/Times Higher Education[^\n]*/gi, "\n");
    text = text.replace(/(?:\n|^)\s*SDG\s*\d+\s*(?:\n[^\n]{0,40})?(?=\n)/g, "\n");
    text = text.replace(/\u00a0/g, " ");
    text = text.replace(/[ \t]+\n/g, "\n");
    text = text.replace(/\n{3,}/g, "\n\n");
    return text.trim();
  }

  function isHeading(line) {
    if (/^\d{1,2}\.\d+(?:\.\d+)?\b/.test(line)) return true;
    if (/^(定義：|註：|注：|Definition:|Note:)/i.test(line)) return true;
    if (
      /^(數據提交指南|數據收集|與其他\s*SDG|我們為什麼衡量|Why we measure|Links to other|Guidance|參數與指標|Metrics and indicators)/i.test(
        line
      )
    )
      return true;
    return false;
  }

  function isShortBreak(line) {
    if (!line) return false;
    if (/[。！？；：:.!?]$/.test(line)) return false;
    if (/[-–—，,、)]$/.test(line)) return true;
    if (line.length < 42) return true;
    return line.length < 55;
  }

  function reflowLines(text) {
    const lines = text
      .split(/\n/)
      .map((l) => l.replace(/[ \t]+/g, " ").trim())
      .filter(Boolean);
    const out = [];
    let buf = "";
    for (const line of lines) {
      if (isHeading(line) || /^https?:\/\//i.test(line)) {
        if (buf) {
          out.push(buf);
          buf = "";
        }
        out.push(line);
        continue;
      }
      if (/^https?:\/\//i.test(buf)) {
        out.push(buf);
        buf = line;
        continue;
      }
      // 勿把下一個「欄位名 指…」黏進上一句
      if (/^[\u4e00-\u9fffA-Za-z].{0,34}\s+(指|這是|係|the number|This is)/i.test(line)) {
        if (buf) {
          out.push(buf);
          buf = "";
        }
        out.push(line);
        continue;
      }
      if (!buf) {
        buf = line;
        continue;
      }
      if (isShortBreak(buf) && !isHeading(line)) {
        const needSpace = /[A-Za-z0-9]$/.test(buf) && /^[A-Za-z0-9]/.test(line);
        buf += (needSpace ? " " : "") + line;
      } else {
        out.push(buf);
        buf = line;
      }
    }
    if (buf) out.push(buf);
    return out;
  }

  function splitDefinitionTitle(line) {
    const m = line.match(/^(定義：|註：|注：|Definition:\s*|Note:\s*)(.+)$/i);
    if (!m) return null;
    const kindRaw = m[1].replace(/[:：]\s*$/, "").trim();
    return { kind: kindRaw, term: m[2].trim() };
  }

  function renderTable(caption, headers, rows) {
    if (!rows.length) return "";
    const head = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
    const body = rows
      .map((r) => {
        const cells = r.map((c, i) =>
          i === 0
            ? `<th scope="row">${escapeHtml(c)}</th>`
            : `<td>${escapeHtml(c)}</td>`
        );
        return `<tr>${cells.join("")}</tr>`;
      })
      .join("");
    return `<div class="method-table-wrap"><table class="method-table"><caption>${escapeHtml(
      caption
    )}</caption><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  /** Parse 「數據收集」區塊：欄位名 + 說明 → 表格 */
  function parseDataCollectionRows(lines) {
    const rows = [];
    let term = null;
    let body = [];

    function flush() {
      if (term && body.length) {
        rows.push([term, body.join("")]);
      } else if (term && !body.length) {
        rows.push([term, "—"]);
      }
      term = null;
      body = [];
    }

    function trySplitField(line) {
      // 「開始攻讀學位的女性數量 指貴校…」— JS \b 對中文無效，勿用
      const zh = line.match(/^(.{2,36}?)\s+(指|這是|係)(.+)$/);
      if (zh && !/^(此項|注意|如果|對於|我們|第一代大學生是)/.test(zh[1])) {
        return { term: zh[1].trim(), rest: (zh[2] + zh[3]).trim() };
      }
      // 「學生數量 2025年所有年級…」
      const yr = line.match(/^(.{2,28}?)\s+(20\d{2}年.+)$/);
      if (yr && !/^(此項|注意|如果|對於|我們)/.test(yr[1])) {
        return { term: yr[1].trim(), rest: yr[2].trim() };
      }
      const en = line.match(
        /^(.{2,50}?)\s+(the number of|This is|Refers to|Number of)\s*(.+)$/i
      );
      if (en) return { term: en[1].trim(), rest: (en[2] + " " + en[3]).trim() };
      return null;
    }

    for (const line of lines) {
      const same = trySplitField(line);
      if (same) {
        flush();
        term = same.term;
        body = [same.rest];
        continue;
      }

      // Continuation / note under current field
      if (
        term &&
        (/^(此項|注意|註|第一代|如果|然而|首次|我們認識)/.test(line) || line.length > 28)
      ) {
        body.push(line);
        continue;
      }

      // New short field label
      if (line.length <= 36 && !/[。！？]$/.test(line) && !/^(此項|如果|對於|我們|注意)/.test(line)) {
        flush();
        term = line;
        body = [];
        continue;
      }

      if (term) body.push(line);
      else {
        // 整段被 reflow 黏在一起時，再嘗試切開多個「名詞 指…」
        const pieces = line.split(/(?=(?:^|[^。；;])(?:[\u4e00-\u9fff]{4,30})\s+(?:指|這是|係))/);
        if (pieces.length > 1) {
          for (const p of pieces) {
            const sp = trySplitField(p.trim());
            if (sp) {
              flush();
              term = sp.term;
              body = [sp.rest];
            } else if (term) {
              body.push(p.trim());
            }
          }
          continue;
        }
        rows.push(["說明", line]);
      }
    }
    flush();
    return rows.filter((r) => r[0] && r[1] && r[1] !== "—");
  }

  function formatToHtml(raw) {
    const cleaned = cleanRaw(raw);
    const lines = reflowLines(cleaned);
    if (!lines.length) return `<p class="method-p">${escapeHtml(cleaned)}</p>`;

    const parts = [];
    let defRows = [];

    function flushDefs() {
      if (!defRows.length) return;
      parts.push(
        renderTable(
          "定義與說明",
          ["項目", "說明"],
          defRows.map((r) => [r.term, r.body || "—"])
        )
      );
      defRows = [];
    }

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];

      if (/^\d{1,2}\.\d+(?:\.\d+)?\b/.test(line)) {
        flushDefs();
        parts.push(`<h3 class="method-h">${escapeHtml(line)}</h3>`);
        i += 1;
        continue;
      }

      // 數據收集（定義）→ 收集到下一個標題，畫成表格
      if (/^數據收集/.test(line) || /^Data collection/i.test(line)) {
        flushDefs();
        parts.push(`<h4 class="method-sub">${escapeHtml(line)}</h4>`);
        i += 1;
        const chunk = [];
        while (i < lines.length && !isHeading(lines[i])) {
          chunk.push(lines[i]);
          i += 1;
        }
        const rows = parseDataCollectionRows(chunk);
        if (rows.length) {
          parts.push(renderTable("數據收集 · 定義", ["欄位／名詞", "定義"], rows));
        } else {
          chunk.forEach((c) => parts.push(`<p class="method-p">${escapeHtml(c)}</p>`));
        }
        continue;
      }

      if (
        /^(數據提交指南|與其他\s*SDG|我們為什麼衡量|Why we measure|Links to other|Guidance|參數與指標|Metrics and indicators)/i.test(
          line
        )
      ) {
        flushDefs();
        parts.push(`<h4 class="method-sub">${escapeHtml(line)}</h4>`);
        i += 1;
        continue;
      }

      const defHead = splitDefinitionTitle(line);
      if (defHead) {
        const chunks = [];
        i += 1;
        while (i < lines.length && !isHeading(lines[i]) && !splitDefinitionTitle(lines[i])) {
          chunks.push(lines[i]);
          i += 1;
        }
        const label =
          /定義|Definition/i.test(defHead.kind)
            ? `定義：${defHead.term}`
            : `${defHead.kind}：${defHead.term}`;
        defRows.push({ term: label, body: chunks.join("") });
        continue;
      }

      const urlSplit = line.match(/^(https?:\/\/[^\s\u4e00-\u9fff<>"']+)/i);
      if (urlSplit) {
        flushDefs();
        const href = urlSplit[1].replace(/[.,;，。、)）]+$/, "");
        const rest = line.slice(urlSplit[1].length).trim();
        const safe = escapeHtml(href);
        parts.push(
          `<p class="method-link"><a href="${safe}" target="_blank" rel="noopener">${safe}</a></p>`
        );
        if (rest) lines.splice(i + 1, 0, rest);
        i += 1;
        continue;
      }

      flushDefs();
      parts.push(`<p class="method-p">${escapeHtml(line)}</p>`);
      i += 1;
    }
    flushDefs();
    return parts.join("");
  }

  function resolve(args) {
    const data = pack(args.lang, args.methodologyZh, args.methodologyEn) || {};
    const byRef = data.byRef || {};
    const bySdg = data.bySdg || data;

    const tryRefs = [];
    if (args.ref) tryRefs.push(String(args.ref));
    if (args.metricRef && String(args.metricRef) !== String(args.ref)) {
      tryRefs.push(String(args.metricRef));
    }
    // parent like 17.3 from 17.3.5
    if (args.ref && /^\d+\.\d+\.\d+/.test(String(args.ref))) {
      const parent = String(args.ref).replace(/\.\d+$/, "");
      if (!tryRefs.includes(parent)) tryRefs.push(parent);
    }

    for (const r of tryRefs) {
      const body = byRef[r];
      if (body && String(body).trim().length > 20) {
        return {
          title: args.lang === "en" ? `Methodology · ${r}` : `方法論 · ${r}`,
          body: String(body).trim(),
          html: formatToHtml(body),
          level: "ref",
          ref: r,
        };
      }
    }

    if (args.sdg != null) {
      const m = bySdg[String(args.sdg)] || {};
      if (m.body) {
        return {
          title: m.title || `SDG${args.sdg}`,
          body: m.body,
          html: formatToHtml(m.body),
          level: "sdg",
          ref: null,
        };
      }
    }

    const empty =
      args.lang === "en"
        ? "Select a question on the left to view its methodology."
        : "請在左側點選題目，右側將顯示對應方法論。";
    return {
      title: args.fallbackTitle || (args.lang === "en" ? "Methodology" : "方法論"),
      body: empty,
      html: `<p class="method-p method-empty">${escapeHtml(empty)}</p>`,
      level: "empty",
      ref: null,
    };
  }

  /**
   * 大標題（x.x）在進入下一題（x.x.x）之前若有說明段落，回傳該段文字；
   * 沒有說明、只有標題或詞彙對照，則回傳空字串。
   */
  function metricBlurb(raw, ref) {
    const cleaned = cleanRaw(raw);
    if (!cleaned || !ref) return "";
    const refEsc = String(ref).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const lines = cleaned
      .split(/\n/)
      .map((l) => l.replace(/[ \t]+/g, " ").trim())
      .filter(Boolean);
    let i = 0;
    if (lines[0] && new RegExp("^" + refEsc + "(?!\\.\\d)\\b").test(lines[0])) i = 1;
    while (i < lines.length && /^(20\d{2})(年)?$/.test(lines[i])) i += 1;
    if (i >= lines.length) return "";
    if (new RegExp("^" + refEsc + "\\.\\d+\\b").test(lines[i])) return "";
    if (/^\d{1,2}\.\d+\.\d+\b/.test(lines[i])) return "";

    const restLines = [];
    for (; i < lines.length; i += 1) {
      if (new RegExp("^" + refEsc + "\\.\\d+\\b").test(lines[i])) break;
      if (/^\d{1,2}\.\d+\.\d+\b/.test(lines[i])) break;
      if (/^(數據收集|數據提交指南|Data collection|Guidance)/i.test(lines[i])) break;
      restLines.push(lines[i]);
    }
    let rest = restLines.join("");
    rest = rest.replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim();
    if (rest.length < 36) return "";
    if (/(\.pdf|https?:|www\.)/i.test(rest.slice(0, 90))) return "";
    const substantive =
      /定義|此處|該指標|大學|衡量|比例|學生|在該|指標涉及|We |This metric|Universities|defined as|proportion/i.test(
        rest
      );
    if (!substantive) return "";
    if (rest.length > 700) rest = rest.slice(0, 700).replace(/\s+\S*$/, "") + "…";
    return rest;
  }

  function render(titleEl, bodyEl, resolved) {
    if (titleEl) titleEl.textContent = resolved.title || "";
    if (bodyEl) {
      bodyEl.classList.add("method-doc");
      bodyEl.innerHTML = resolved.html || formatToHtml(resolved.body || "");
    }
  }

  global.THEMethod = { resolve, formatToHtml, render, metricBlurb };
})(window);
