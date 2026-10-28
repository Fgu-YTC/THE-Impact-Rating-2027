/** Shared UI helpers for question readability + language */
(function (global) {
  function splitQuestionText(text) {
    const raw = String(text || "").trim();
    if (!raw) return { title: "", body: "" };
    const lines = raw.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 1) return { title: lines[0], body: "" };
    return { title: lines[0], body: lines.slice(1).join("\n") };
  }

  function getLang() {
    return localStorage.getItem("the2027_lang") || "zh";
  }

  function setLang(lang) {
    localStorage.setItem("the2027_lang", lang === "en" ? "en" : "zh");
  }

  function bindLangToggle(container, onChange) {
    if (!container) return;
    container.querySelectorAll("[data-lang]").forEach((btn) => {
      btn.addEventListener("click", () => {
        setLang(btn.dataset.lang);
        container.querySelectorAll("[data-lang]").forEach((b) => {
          b.classList.toggle("active", b.dataset.lang === getLang());
        });
        onChange(getLang());
      });
    });
    container.querySelectorAll("[data-lang]").forEach((b) => {
      b.classList.toggle("active", b.dataset.lang === getLang());
    });
  }

  /** 這題實際要問的句子；數值題則列出要填的欄位 */
  function questionAsk(q, lang) {
    const primary = lang === "en" ? q.en : q.zh;
    const parts = splitQuestionText(primary);
    if (parts.body) return parts.body;
    if (q.answerType === "continuous") {
      const opts = (q.options || [])
        .map((o) => (lang === "en" ? o.en || o.zh : o.zh || o.en))
        .filter(Boolean);
      if (opts.length) {
        return lang === "en" ? `Enter: ${opts.join("; ")}` : `請填寫：${opts.join("、")}`;
      }
    }
    return "";
  }

  /** Build readable question text block — 依目前語系顯示；showBoth 才附另一語 */
  function renderQuestionCopy(q, lang, { showBoth = false, showAsk = false, titleOnly = false } = {}) {
    const wrap = document.createElement("div");
    wrap.className = "q-copy";

    const primary = lang === "en" ? q.en : q.zh;
    const secondary = lang === "en" ? q.zh : q.en;
    const parts = splitQuestionText(primary);
    const title = document.createElement("div");
    title.className = "q-title";
    title.textContent = parts.title || primary || "—";
    wrap.appendChild(title);
    if (titleOnly) return wrap;

    const ask = showAsk ? questionAsk(q, lang) : "";
    if (ask) {
      const askEl = document.createElement("div");
      askEl.className = "q-ask";
      const label = document.createElement("span");
      label.className = "q-ask-label";
      label.textContent = lang === "en" ? "Question" : "本題詢問";
      const text = document.createElement("p");
      text.textContent = ask;
      askEl.appendChild(label);
      askEl.appendChild(text);
      wrap.appendChild(askEl);
    } else if (parts.body) {
      const body = document.createElement("div");
      body.className = "q-body";
      body.textContent = parts.body;
      wrap.appendChild(body);
    }

    if (showBoth && secondary && String(secondary).trim()) {
      const alt = document.createElement("div");
      alt.className = "q-alt";
      const tag = document.createElement("span");
      tag.className = "q-alt-lang";
      tag.textContent = lang === "en" ? "中文" : "EN";
      const altParts = splitQuestionText(secondary);
      const text = document.createElement("div");
      text.className = "q-alt-text";
      text.textContent =
        altParts.title + (altParts.body ? "\n" + altParts.body : "");
      alt.appendChild(tag);
      alt.appendChild(text);
      wrap.appendChild(alt);
    }
    return wrap;
  }

  /** 管理頁用：顯示填寫頁會出現的作答格式，欄位不可填 */
  function renderAnswerPreview(q, lang) {
    const wrap = document.createElement("div");
    wrap.className = "q-format";
    const label = document.createElement("div");
    label.className = "q-format-label";
    label.textContent = lang === "en" ? "Answer format" : "填寫格式";
    wrap.appendChild(label);

    const fields = document.createElement("div");
    fields.className = "fields";
    appendAnswerFields(fields, q, { lang, answer: {}, disabled: true });
    wrap.appendChild(fields);
    return wrap;
  }

  /** x.x.x 題目對應的原生大標題編號 x.x */
  function parentRef(q) {
    const given = String(q.metricRef || "").trim();
    if (/^\d+\.\d+$/.test(given)) return given;
    const fromQuestion = String(q.ref || "").match(/^(\d+\.\d+)\.\d+/);
    return fromQuestion ? fromQuestion[1] : "";
  }

  /** 大標題。沒有說明時不可點；有說明才附上說明並可點。 */
  function renderMetricHeader(metric, lang, { note = "", altNote = "", clickable = false, selected = false, compact = false } = {}) {
    const header = document.createElement("div");
    header.className =
      "metric-header" + (clickable ? "" : " static") + (selected ? " selected" : "");
    const mMeta = document.createElement("div");
    mMeta.className = "q-meta";
    const mLabel = document.createElement("span");
    mLabel.className = "ref-label";
    mLabel.textContent = lang === "en" ? "Title" : "大標題";
    const mRef = document.createElement("span");
    mRef.className = "q-ref ref-metric";
    mRef.textContent = metric.ref || "";
    mMeta.appendChild(mLabel);
    mMeta.appendChild(mRef);
    header.appendChild(mMeta);
    header.appendChild(
      renderQuestionCopy({ en: metric.en || "", zh: metric.zh || "" }, lang, {
        showBoth: false,
        titleOnly: compact,
      })
    );
    if (!compact && clickable && note) {
      const noteEl = document.createElement("div");
      noteEl.className = "metric-note";
      noteEl.textContent = note;
      header.appendChild(noteEl);
    }
    return header;
  }

  function evidenceTip(lang) {
    if (lang === "en") {
      return [
        "Evidence can be an uploaded file or a link. Either is fine.",
        "Reviewers must be able to open it and see the direct evidence for this question. A page that needs a login, or that does not show the evidence, does not count.",
        "Paste a link here, or choose a file. Submit sends the file into the system.",
      ].join("\n");
    }
    return [
      "證據可以上傳檔案，也可以貼連結，兩種都可以。",
      "不論哪一種，審核人員都要打得開，而且看得到這題的直接證據。要登入才看得到、或打開後看不到該證據，不算。",
      "有網址就貼在這裡；要上傳檔案就選檔案。按下提交後，檔案會存進系統。",
    ].join("\n");
  }

  function publicTip(lang) {
    if (lang === "en") {
      return [
        "Choose one: Public, Private, or Undefined.",
        "Public: the evidence is on a public webpage anyone can open.",
        "Private: there is evidence, but it is not a public webpage. An uploaded file, or a link only reviewers can open, is Private.",
        "Undefined: there is no evidence for this question yet.",
      ].join("\n");
    }
    return [
      "三選一：Public、Private、Undefined。",
      "Public：證據已經在公開網頁上，任何人打得開、看得到。",
      "Private：有證據，但不是公開網頁。上傳的檔案，或只有審核人員打得開的位置，選 Private。",
      "Undefined：這題還沒有可提供的證據。",
    ].join("\n");
  }

  function publicChoices(lang) {
    if (lang === "en") {
      return [
        { value: "", label: "—" },
        { value: "public", label: "Public" },
        { value: "private", label: "Private" },
        { value: "undefined", label: "Undefined" },
      ];
    }
    return [
      { value: "", label: "—" },
      { value: "public", label: "公開" },
      { value: "private", label: "不公開" },
      { value: "undefined", label: "未定" },
    ];
  }

  function normalizePublic(value) {
    if (value === "yes") return "public";
    if (value === "no") return "private";
    return value || "";
  }

  function appendAnswerFields(fields, q, opts) {
    const lang = opts.lang || "zh";
    const disabled = !!opts.disabled;
    const getAnswer = opts.getAnswer || (() => opts.answer || {});
    const onPatch = opts.onPatch || (() => {});
    const ans = getAnswer() || {};

    if (q.answerType === "picklist" && q.options?.length) {
      fields.appendChild(yesNoRow(ans, disabled, onPatch, lang));
      const wrap = document.createElement("div");
      wrap.className = "option-list";
      q.options.forEach((opt, i) => {
        const lab = document.createElement("label");
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.disabled = disabled;
        cb.id = `${opts.idPrefix || q.id}-opt-${i}`;
        const selected = new Set(ans.options || []);
        cb.checked = selected.has(opt.en) || selected.has(opt.zh);
        cb.addEventListener("change", () => {
          const cur = getAnswer() || {};
          const next = new Set(cur.options || []);
          if (cb.checked) next.add(opt.en);
          else {
            next.delete(opt.en);
            next.delete(opt.zh);
          }
          onPatch({ options: [...next], yesNo: next.size ? cur.yesNo || "yes" : cur.yesNo || "" });
        });
        lab.appendChild(cb);
        const text = document.createElement("span");
        text.textContent = lang === "en" ? opt.en || opt.zh : opt.zh || opt.en;
        lab.appendChild(text);
        wrap.appendChild(lab);
      });
      fields.appendChild(wrap);
    } else if (q.answerType === "continuous") {
      (q.options?.length ? q.options : [{ en: "Value", zh: "數值", kind: "value" }]).forEach((opt, i) => {
        const row = document.createElement("div");
        row.className = "row";
        const lab = document.createElement("label");
        lab.textContent = lang === "en" ? opt.en || opt.zh : opt.zh || opt.en;
        const inp = document.createElement("input");
        inp.type = "number";
        inp.disabled = disabled;
        inp.placeholder = lang === "en" ? "Number" : "填數字";
        const key = `v${i}`;
        const values = ans.values || {};
        inp.value = values[key] ?? "";
        inp.addEventListener("change", () => {
          const cur = getAnswer() || {};
          const next = { ...(cur.values || {}) };
          next[key] = inp.value;
          onPatch({ values: next });
        });
        row.appendChild(lab);
        row.appendChild(inp);
        fields.appendChild(row);
      });
    } else {
      fields.appendChild(yesNoRow(ans, disabled, onPatch, lang));
    }

    if (q.answerType === "continuous") return fields;

    const commentRow = document.createElement("div");
    commentRow.className = "row";
    const commentLab = document.createElement("label");
    commentLab.textContent = lang === "en" ? "Comments" : "備註";
    const comment = document.createElement("textarea");
    comment.maxLength = 1000;
    comment.disabled = disabled;
    comment.placeholder = lang === "en" ? "Comments, max 1000 characters" : "備註，最多 1000 字";
    comment.value = ans.comment || "";
    comment.addEventListener("change", () => onPatch({ comment: comment.value }));
    commentRow.appendChild(commentLab);
    commentRow.appendChild(comment);
    fields.appendChild(commentRow);

    const evRow = document.createElement("div");
    evRow.className = "row";
    const evLab = document.createElement("label");
    evLab.textContent = lang === "en" ? "Evidence" : "證據";
    const evNote = appendHelp(evLab, evidenceTip(lang));
    const ev = document.createElement("input");
    ev.type = "text";
    ev.disabled = disabled;
    ev.placeholder = "https://";
    ev.value = ans.evidence || "";
    ev.addEventListener("change", () => onPatch({ evidence: ev.value }));
    evRow.appendChild(evLab);
    evRow.appendChild(ev);

    const fileRow = document.createElement("div");
    fileRow.className = "row";
    const fileLab = document.createElement("label");
    fileLab.textContent = lang === "en" ? "Upload" : "上傳檔案";
    const fileWrap = document.createElement("div");
    const file = document.createElement("input");
    file.type = "file";
    file.disabled = disabled;
    const fileName = document.createElement("div");
    fileName.className = "file-name";
    fileName.textContent = opts.pendingName || "";
    const savedName = ans.evidenceFileName || "";
    const savedUrl = ans.evidenceFileUrl || "";
    if (!opts.pendingName && (savedName || savedUrl || ans.evidenceFilePath)) {
      const link = document.createElement("a");
      link.className = "file-download";
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = savedName
        ? (lang === "en" ? `Download last file: ${savedName}` : `下載上次提交的檔案：${savedName}`)
        : (lang === "en" ? "Download last file" : "下載上次提交的檔案");
      if (savedUrl) link.href = savedUrl;
      else link.hidden = true;
      fileWrap.appendChild(link);
      if (!savedUrl && ans.evidenceFilePath && opts.resolveFileUrl) {
        opts.resolveFileUrl(ans).then((url) => {
          if (!url) return;
          link.href = url;
          link.hidden = false;
        }).catch(() => {});
      }
    }
    file.addEventListener("change", () => {
      const chosen = file.files && file.files[0];
      fileName.textContent = chosen ? chosen.name : "";
      onPatch({ evidenceFileName: chosen ? chosen.name : "" });
      if (opts.onFile) opts.onFile(chosen || null);
    });
    fileWrap.appendChild(file);
    fileWrap.appendChild(fileName);
    fileRow.appendChild(fileLab);
    fileRow.appendChild(fileWrap);

    const pubRow = document.createElement("div");
    pubRow.className = "row";
    const pubLab = document.createElement("label");
    pubLab.textContent = lang === "en" ? "Public" : "是否公開";
    const pubNote = appendHelp(pubLab, publicTip(lang));
    const pub = document.createElement("select");
    pub.disabled = disabled;
    publicChoices(lang).forEach((item) => {
      const o = document.createElement("option");
      o.value = item.value;
      o.textContent = item.label;
      pub.appendChild(o);
    });
    pub.value = normalizePublic(ans.public);
    pub.addEventListener("change", () => onPatch({ public: pub.value }));
    pubRow.appendChild(pubLab);
    pubRow.appendChild(pub);

    fields.appendChild(evRow);
    fields.appendChild(evNote);
    fields.appendChild(fileRow);
    fields.appendChild(pubRow);
    fields.appendChild(pubNote);
    return fields;
  }

  function yesNoRow(ans, disabled, onPatch, lang) {
    const row = document.createElement("div");
    row.className = "row";
    const lab = document.createElement("label");
    lab.textContent = lang === "en" ? "Yes / No" : "是／否";
    const sel = document.createElement("select");
    sel.disabled = disabled;
    (lang === "en"
      ? [
          ["", "—"],
          ["yes", "Yes"],
          ["no", "No"],
        ]
      : [
          ["", "—"],
          ["yes", "是"],
          ["no", "否"],
        ]
    ).forEach(([value, label]) => {
      const o = document.createElement("option");
      o.value = value;
      o.textContent = label;
      sel.appendChild(o);
    });
    sel.value = ans.yesNo || "";
    sel.addEventListener("change", () => onPatch({ yesNo: sel.value }));
    row.appendChild(lab);
    row.appendChild(sel);
    return row;
  }

  function appendHelp(labelEl, tip) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "field-help";
    btn.textContent = "?";
    btn.title = tip;
    btn.setAttribute("aria-expanded", "false");
    const note = document.createElement("p");
    note.className = "field-help-note";
    note.hidden = true;
    note.textContent = tip;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      note.hidden = !note.hidden;
      btn.setAttribute("aria-expanded", note.hidden ? "false" : "true");
    });
    labelEl.appendChild(btn);
    return note;
  }

  /** 去年標籤常是英中黏在一起；依介面語言只留一邊，或對齊今年選項文案 */
  function preferLangLabel(raw, lang, option) {
    if (option) {
      const picked = lang === "en" ? option.en || option.zh : option.zh || option.en;
      if (picked) return String(picked).trim();
    }
    const s = String(raw || "").trim();
    if (!s) return lang === "en" ? "Option" : "選項";
    const paren = s.match(/^(.+?)\s*[\(（]\s*(.+?)\s*[\)）]\s*$/);
    if (paren) return (lang === "en" ? paren[1] : paren[2]).trim();
    const cjk = s.search(/[\u4e00-\u9fff]/);
    if (cjk > 0) {
      const en = s.slice(0, cjk).trim();
      const zh = s.slice(cjk).trim();
      if (en && zh) return lang === "en" ? en : zh;
    }
    return s;
  }

  function priorRow(list, label, value, { block = false } = {}) {
    if (value == null || value === "") return;
    const row = document.createElement("div");
    const longText = typeof value === "string" && value.length > 80;
    row.className = "prior-row" + (block || longText ? " prior-row-block" : "");
    const dt = document.createElement("span");
    dt.className = "prior-dt";
    dt.textContent = label;
    const dd = document.createElement("span");
    dd.className = "prior-dd";
    if (value instanceof Node) dd.appendChild(value);
    else dd.textContent = value;
    row.appendChild(dt);
    row.appendChild(dd);
    list.appendChild(row);
  }

  function priorLink(href, text) {
    const a = document.createElement("a");
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = text || href;
    return a;
  }

  function priorFieldChangeNote(question, data, lang) {
    if (!question || !data) return "";
    const priorValues = Array.isArray(data.values) ? data.values.length : 0;
    const priorLines = Array.isArray(data.lines) ? data.lines.length : 0;
    const opts = question.options || [];
    if (question.answerType === "continuous" && priorValues > 0) {
      const now = opts.length || 1;
      if (now !== priorValues) {
        return lang === "en"
          ? `Fields changed vs last year: last year ${priorValues}, this year ${now}. Fill this year’s fields only.`
          : `與去年題目有調整：去年 ${priorValues} 欄，今年 ${now} 欄。請依今年欄位填寫。`;
      }
    }
    if (question.answerType === "picklist" && priorLines > 0 && opts.length) {
      if (opts.length !== priorLines) {
        return lang === "en"
          ? `Options changed vs last year: last year ${priorLines}, this year ${opts.length}. Follow this year’s options.`
          : `與去年題目有調整：去年 ${priorLines} 個選項，今年 ${opts.length} 個。請依今年選項填寫。`;
      }
    }
    return "";
  }

  function renderPriorYear(data, question) {
    if (!data) return null;
    const lang = getLang();
    const yesNoLabel = lang === "en" ? "Yes / No" : "是／否";
    const evidenceLabel = lang === "en" ? "Evidence" : "證據";
    const fileLabel = lang === "en" ? "File" : "檔案";
    const publicLabel = lang === "en" ? "Public" : "是否公開";
    const noteLabel = lang === "en" ? "Comments" : "備註";
    const yesText = lang === "en" ? "Yes" : "是";
    const noText = lang === "en" ? "No" : "否";
    const box = document.createElement("div");
    box.className = "prior";
    const head = document.createElement("div");
    head.className = "prior-head";
    head.textContent = lang === "en" ? "Last year" : "去年";
    box.appendChild(head);
    const changeNote = priorFieldChangeNote(question, data, lang);
    if (changeNote) {
      const note = document.createElement("div");
      note.className = "prior-change";
      note.textContent = changeNote;
      box.appendChild(note);
    }
    const list = document.createElement("div");
    list.className = "prior-list";
    if (data.yesNo === "yes") priorRow(list, yesNoLabel, yesText);
    if (data.yesNo === "no") priorRow(list, yesNoLabel, noText);
    (data.lines || []).forEach((line, i) => {
      const bits = [];
      if (line.yesNo === "yes") bits.push(yesText);
      if (line.yesNo === "no") bits.push(noText);
      if (line.public === "yes") bits.push(lang === "en" ? "Public" : "公開");
      if (line.public === "no") bits.push(lang === "en" ? "Not public" : "未公開");
      const opt = question && Array.isArray(question.options) ? question.options[i] : null;
      priorRow(list, preferLangLabel(line.label, lang, opt), bits.join("　") || "—");
      (line.evidence || []).forEach((href) => priorRow(list, evidenceLabel, priorLink(href)));
    });
    (data.values || []).forEach((entry, i) => {
      const opt = question && Array.isArray(question.options) ? question.options[i] : null;
      priorRow(
        list,
        preferLangLabel(entry.label || (lang === "en" ? "Number" : "數字"), lang, opt),
        entry.value
      );
    });
    (data.evidence || []).forEach((href) => priorRow(list, evidenceLabel, priorLink(href)));
    (data.files || []).forEach((item) => {
      if (item && typeof item === "object" && item.url) {
        priorRow(list, fileLabel, priorLink(item.url, item.name || item.url));
      } else if (item && typeof item === "object" && item.name) {
        priorRow(list, fileLabel, item.name);
      } else if (item) {
        priorRow(list, fileLabel, String(item));
      }
    });
    if (data.public === "yes") priorRow(list, publicLabel, lang === "en" ? "Yes" : "公開");
    if (data.public === "no") priorRow(list, publicLabel, lang === "en" ? "No" : "未公開");
    if (data.note) priorRow(list, noteLabel, data.note, { block: true });
    if (!list.childNodes.length && !changeNote) return null;
    if (list.childNodes.length) box.appendChild(list);
    return box;
  }

  function renderPriorUnit(names) {
    if (!names || !names.length) return null;
    const line = document.createElement("div");
    line.className = "prior-unit";
    const joined = names.join(getLang() === "en" ? ", " : "、");
    line.textContent =
      getLang() === "en"
        ? `Last-year unit${names.length > 1 ? "s" : ""}: ${joined}`
        : `去年單位：${joined}`;
    return line;
  }

  /** 唯讀：單位已退回 */
  function renderReturnStatus(ret, lang, unitLabel) {
    if (!ret || !String(ret.suggestion || "").trim()) return null;
    const box = document.createElement("div");
    box.className = "return-box returned";
    const head = document.createElement("div");
    head.className = "return-head";
    head.textContent = lang === "en"
      ? `Returned${unitLabel ? ` by ${unitLabel}` : ""} (cannot answer)`
      : `已退回${unitLabel ? `（${unitLabel}）` : ""}：此單位無法回答`;
    box.appendChild(head);
    const why = document.createElement("div");
    why.className = "return-suggestion";
    why.textContent =
      (lang === "en" ? "Suggestion: " : "退回建議：") + String(ret.suggestion || "").trim();
    box.appendChild(why);
    return box;
  }

  /** 填報頁：退回此題＋退回建議 */
  function renderReturnEditor({ ret, lang, onReturn, onClear }) {
    const box = document.createElement("div");
    box.className = "return-box" + (ret ? " returned" : "");
    box.addEventListener("click", (e) => e.stopPropagation());

    const head = document.createElement("div");
    head.className = "return-head";
    head.textContent = lang === "en" ? "Cannot answer — return" : "無法填寫？退回此題";
    box.appendChild(head);

    const note = document.createElement("p");
    note.className = "return-note";
    note.textContent = lang === "en"
      ? "Returning means this unit cannot answer. Suggest another unit, or write「無」if none."
      : "退回表示本單位無法回答此題。可建議改派單位；若沒有建議請填「無」。";
    box.appendChild(note);

    const ta = document.createElement("textarea");
    ta.rows = 2;
    ta.maxLength = 500;
    ta.placeholder = lang === "en"
      ? "Return suggestion (or write 無)"
      : "退回建議（可建議我們改派誰；沒有建議請填「無」）";
    ta.value = (ret && ret.suggestion) || "";
    box.appendChild(ta);

    const actions = document.createElement("div");
    actions.className = "return-actions";
    const status = document.createElement("span");
    status.className = "return-status";
    if (ret) {
      status.textContent = lang === "en" ? "Returned" : "目前：已退回";
    }

    const btnReturn = document.createElement("button");
    btnReturn.type = "button";
    btnReturn.className = "secondary";
    btnReturn.textContent = lang === "en" ? "Return question" : "退回";
    btnReturn.addEventListener("click", async () => {
      btnReturn.disabled = true;
      status.textContent = lang === "en" ? "Saving…" : "送出中…";
      try {
        await onReturn(ta.value);
        status.textContent = lang === "en" ? "Returned" : "已退回";
      } catch (err) {
        status.textContent = (err && err.message) || (lang === "en" ? "Failed" : "退回失敗");
      } finally {
        btnReturn.disabled = false;
      }
    });
    actions.appendChild(btnReturn);

    if (ret) {
      const btnClear = document.createElement("button");
      btnClear.type = "button";
      btnClear.className = "secondary";
      btnClear.textContent = lang === "en" ? "Undo return" : "取消退回";
      btnClear.addEventListener("click", async () => {
        btnClear.disabled = true;
        status.textContent = lang === "en" ? "Undoing…" : "取消中…";
        try {
          await onClear();
          status.textContent = lang === "en" ? "Cleared" : "已取消退回";
        } catch (err) {
          status.textContent = (err && err.message) || (lang === "en" ? "Failed" : "取消失敗");
        } finally {
          btnClear.disabled = false;
        }
      });
      actions.appendChild(btnClear);
    }

    actions.appendChild(status);
    box.appendChild(actions);
    return box;
  }

  /** 今年填寫在上、去年參考在下（全寬，方便閱讀長文） */
  function renderFillCompare({ prior, priorUnit, fields, lang }) {
    const wrap = document.createElement("div");
    wrap.className = "fill-compare";

    const now = document.createElement("div");
    now.className = "fill-compare-side fill-compare-now";
    const nowHead = document.createElement("div");
    nowHead.className = "fill-compare-label";
    nowHead.textContent = lang === "en" ? "This year (fill in)" : "今年填報";
    now.appendChild(nowHead);
    if (fields) now.appendChild(fields);

    const ref = document.createElement("div");
    ref.className = "fill-compare-side fill-compare-prior";
    const refHead = document.createElement("div");
    refHead.className = "fill-compare-label";
    refHead.textContent = lang === "en" ? "Last year (reference)" : "去年填報（參考）";
    ref.appendChild(refHead);
    if (priorUnit) ref.appendChild(priorUnit);
    if (prior) {
      ref.appendChild(prior);
    } else {
      const empty = document.createElement("div");
      empty.className = "fill-compare-empty";
      empty.textContent = lang === "en" ? "No last-year answer for this question." : "此題沒有去年填答可對照。";
      ref.appendChild(empty);
    }

    wrap.appendChild(now);
    wrap.appendChild(ref);
    return wrap;
  }

  global.THEUI = {
    splitQuestionText,
    getLang,
    setLang,
    bindLangToggle,
    renderQuestionCopy,
    questionAsk,
    parentRef,
    evidenceTip,
    publicTip,
    normalizePublic,
    appendHelp,
    appendAnswerFields,
    renderMetricHeader,
    renderAnswerPreview,
    renderPriorYear,
    renderPriorUnit,
    renderReturnStatus,
    renderReturnEditor,
    renderFillCompare,
  };
})(window);
