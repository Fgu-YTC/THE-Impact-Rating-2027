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

  global.THEUI = {
    splitQuestionText,
    getLang,
    setLang,
    bindLangToggle,
    renderQuestionCopy,
    questionAsk,
  };
})(window);
