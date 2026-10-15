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

  /** Build readable question text block — 主語系完整顯示，另一語系永遠附在下方 */
  function renderQuestionCopy(q, lang, { showBoth = true, showAsk = false, titleOnly = false } = {}) {
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
        showBoth: !compact,
        titleOnly: compact,
      })
    );
    if (!compact && clickable && note) {
      const noteEl = document.createElement("div");
      noteEl.className = "metric-note";
      noteEl.textContent = note;
      header.appendChild(noteEl);
      if (altNote) {
        const alt = document.createElement("div");
        alt.className = "q-alt";
        const tag = document.createElement("span");
        tag.className = "q-alt-lang";
        tag.textContent = lang === "en" ? "中文" : "EN";
        const text = document.createElement("div");
        text.className = "q-alt-text";
        text.textContent = altNote;
        alt.appendChild(tag);
        alt.appendChild(text);
        header.appendChild(alt);
      }
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

  function publicChoices() {
    return [
      { value: "", label: "—" },
      { value: "public", label: "Public" },
      { value: "private", label: "Private" },
      { value: "undefined", label: "Undefined" },
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
      fields.appendChild(yesNoRow(ans, disabled, onPatch));
      const wrap = document.createElement("div");
      wrap.className = "option-list";
      q.options.forEach((opt, i) => {
        const lab = document.createElement("label");
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.disabled = disabled;
        cb.id = `${q.id}-opt-${i}`;
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
        const primary = lang === "en" ? opt.en || opt.zh : opt.zh || opt.en;
        const secondary = lang === "en" ? opt.zh : opt.en;
        text.textContent = secondary && secondary !== primary ? `${primary}　${secondary}` : primary;
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
      fields.appendChild(yesNoRow(ans, disabled, onPatch));
    }

    if (q.answerType === "continuous") return fields;

    const commentRow = document.createElement("div");
    commentRow.className = "row";
    const commentLab = document.createElement("label");
    commentLab.textContent = "Comments";
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
    evLab.textContent = "Evidence";
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
    fileName.textContent = opts.pendingName || ans.evidenceFileName || "";
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
    pubLab.textContent = "Public";
    const pubNote = appendHelp(pubLab, publicTip(lang));
    const pub = document.createElement("select");
    pub.disabled = disabled;
    publicChoices().forEach((item) => {
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

  function yesNoRow(ans, disabled, onPatch) {
    const row = document.createElement("div");
    row.className = "row";
    const lab = document.createElement("label");
    lab.textContent = "Yes / No";
    const sel = document.createElement("select");
    sel.disabled = disabled;
    [
      ["", "—"],
      ["yes", "Yes"],
      ["no", "No"],
    ].forEach(([value, label]) => {
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

  function priorRow(list, label, value) {
    if (value == null || value === "") return;
    const row = document.createElement("div");
    row.className = "prior-row";
    const dt = document.createElement("span");
    dt.textContent = label;
    const dd = document.createElement("span");
    if (value instanceof Node) dd.appendChild(value);
    else dd.textContent = value;
    row.appendChild(dt);
    row.appendChild(dd);
    list.appendChild(row);
  }

  function priorLink(href) {
    const a = document.createElement("a");
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = href;
    return a;
  }

  function renderPriorYear(data) {
    if (!data) return null;
    const box = document.createElement("div");
    box.className = "prior";
    const head = document.createElement("div");
    head.className = "prior-head";
    head.textContent = "去年";
    box.appendChild(head);
    const list = document.createElement("div");
    if (data.yesNo === "yes") priorRow(list, "Yes / No", "Yes");
    if (data.yesNo === "no") priorRow(list, "Yes / No", "No");
    (data.lines || []).forEach((line) => {
      const bits = [];
      if (line.yesNo === "yes") bits.push("Yes");
      if (line.yesNo === "no") bits.push("No");
      if (line.public === "yes") bits.push("公開");
      if (line.public === "no") bits.push("未公開");
      priorRow(list, line.label || "選項", bits.join("　") || "—");
      (line.evidence || []).forEach((href) => priorRow(list, "證據", priorLink(href)));
    });
    (data.values || []).forEach((entry) => {
      priorRow(list, entry.label || "數字", entry.value);
    });
    (data.evidence || []).forEach((href) => priorRow(list, "證據", priorLink(href)));
    (data.files || []).forEach((name) => priorRow(list, "檔案", name));
    if (data.public === "yes") priorRow(list, "Public", "公開");
    if (data.public === "no") priorRow(list, "Public", "未公開");
    if (data.note) priorRow(list, "說明", data.note);
    if (!list.childNodes.length) return null;
    box.appendChild(list);
    return box;
  }

  function renderPriorUnit(names) {
    if (!names || !names.length) return null;
    const line = document.createElement("div");
    line.className = "prior-unit";
    line.textContent = `去年：${names.join("、")}`;
    return line;
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
  };
})(window);
