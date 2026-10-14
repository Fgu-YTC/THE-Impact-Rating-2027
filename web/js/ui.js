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
  function renderQuestionCopy(q, lang, { showBoth = true, showAsk = false } = {}) {
    const wrap = document.createElement("div");
    wrap.className = "q-copy";

    const primary = lang === "en" ? q.en : q.zh;
    const secondary = lang === "en" ? q.zh : q.en;
    const parts = splitQuestionText(primary);
    const title = document.createElement("div");
    title.className = "q-title";
    title.textContent = parts.title || primary || "—";
    wrap.appendChild(title);

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

    if (q.answerType === "picklist" && q.options?.length) {
      const list = document.createElement("div");
      list.className = "option-list";
      q.options.forEach((opt) => {
        const lab = document.createElement("label");
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.disabled = true;
        lab.appendChild(cb);
        const text = document.createElement("span");
        const primary = lang === "en" ? opt.en || opt.zh : opt.zh || opt.en;
        const secondary = lang === "en" ? opt.zh : opt.en;
        text.textContent = secondary && secondary !== primary ? `${primary}　${secondary}` : primary;
        lab.appendChild(text);
        list.appendChild(lab);
      });
      fields.appendChild(list);
    } else if (q.answerType === "continuous") {
      const opts = q.options?.length ? q.options : [{ en: "Value", zh: "數值" }];
      opts.forEach((opt) => {
        const row = document.createElement("div");
        row.className = "row";
        const lab = document.createElement("label");
        lab.textContent = lang === "en" ? opt.en || opt.zh : opt.zh || opt.en;
        const inp = document.createElement("input");
        inp.type = "number";
        inp.disabled = true;
        inp.placeholder = lang === "en" ? "Number" : "填數字";
        row.appendChild(lab);
        row.appendChild(inp);
        fields.appendChild(row);
      });
    } else {
      const row = document.createElement("div");
      row.className = "row";
      const lab = document.createElement("label");
      lab.textContent = "Yes / No";
      const sel = document.createElement("select");
      sel.disabled = true;
      ["—", "YES", "NO"].forEach((v) => {
        const o = document.createElement("option");
        o.textContent = v;
        sel.appendChild(o);
      });
      row.appendChild(lab);
      row.appendChild(sel);
      fields.appendChild(row);
    }

    if (q.answerType !== "continuous") {
      const evRow = document.createElement("div");
      evRow.className = "row";
      const evLab = document.createElement("label");
      evLab.textContent = "Evidence";
      const evNote = appendHelp(evLab, evidenceTip(lang));
      const ev = document.createElement("input");
      ev.type = "text";
      ev.disabled = true;
      ev.placeholder = lang === "en" ? "Link or file name" : "網址，或要上傳的檔名";
      evRow.appendChild(evLab);
      evRow.appendChild(ev);
      const pubRow = document.createElement("div");
      pubRow.className = "row";
      const pubLab = document.createElement("label");
      pubLab.textContent = "Public";
      const pubNote = appendHelp(pubLab, publicTip(lang));
      const pub = document.createElement("select");
      pub.disabled = true;
      ["—", "YES", "NO"].forEach((v) => {
        const o = document.createElement("option");
        o.textContent = v;
        pub.appendChild(o);
      });
      pubRow.appendChild(pubLab);
      pubRow.appendChild(pub);
      fields.appendChild(evRow);
      fields.appendChild(evNote);
      fields.appendChild(pubRow);
      fields.appendChild(pubNote);
    }

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
  function renderMetricHeader(metric, lang, { note = "", altNote = "", clickable = false, selected = false } = {}) {
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
      renderQuestionCopy({ en: metric.en || "", zh: metric.zh || "" }, lang, { showBoth: true })
    );
    if (clickable && note) {
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
        "When this is submitted to THE, evidence can be an uploaded file or a link. Either is fine.",
        "Reviewers must be able to open it and see the direct evidence for this question. A page that needs a login, or that does not show the evidence, does not count.",
        "On this form, enter the link or the file name you will upload.",
      ].join("\n");
    }
    return [
      "送進泰晤士時，證據可以上傳檔案，也可以貼連結，兩種都可以。",
      "不論哪一種，審核人員都要打得開，而且看得到這題的直接證據。要登入才看得到、或打開後看不到該證據，不算。",
      "這張表請寫網址，或寫要上傳的檔名。",
    ].join("\n");
  }

  function publicTip(lang) {
    if (lang === "en") {
      return [
        "Public only asks whether this evidence is already on a public webpage.",
        "Yes: anyone can open a public webpage and see it.",
        "No: it is not on a public webpage. An uploaded file, or a link that is not a public webpage, is No.",
      ].join("\n");
    }
    return [
      "Public 只問這份證據現在有沒有放在公開網頁上。",
      "Yes：任何人打開公開網頁都看得到。",
      "No：沒有放在公開網頁。上傳檔案，或連結不是公開網頁，都選 No。",
    ].join("\n");
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
    appendHelp,
    renderMetricHeader,
    renderAnswerPreview,
  };
})(window);
