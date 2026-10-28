/** 填報頁初次使用教學（localStorage 記住已看過） */
(function (global) {
  const KEY = "theImpact2027.tour.seen.v1";

  function seen() {
    try {
      return localStorage.getItem(KEY) === "1";
    } catch (_) {
      return false;
    }
  }

  function markSeen() {
    try {
      localStorage.setItem(KEY, "1");
    } catch (_) {}
  }

  function steps(lang) {
    if (lang === "en") {
      return [
        "Choose your unit at the top.",
        "Open an SDG tab to see your questions; the right pane shows methodology.",
        "Fill answers and evidence. Last year’s answers are for reference only.",
        "If your unit cannot answer, use Return and write a suggestion (or「無」).",
        "When done, click Submit and enter the filler’s name.",
      ];
    }
    return [
      "上方選擇你的填寫單位。",
      "點 SDG 分頁看分派給你們的題；右側可看方法論。",
      "填寫答案與證據；去年內容僅供參考。",
      "若本單位無法回答，用「退回」並寫退回建議（沒有建議請填「無」）。",
      "改完按右下「提交」，並輸入填寫人姓名。",
    ];
  }

  function paint(dialog, lang) {
    const title = dialog.querySelector("[data-tour-title]");
    const lead = dialog.querySelector("[data-tour-lead]");
    const list = dialog.querySelector("[data-tour-list]");
    const done = dialog.querySelector("[data-tour-done]");
    if (!title || !list || !done) return;
    title.textContent = lang === "en" ? "Quick start" : "填報小教學";
    lead.textContent =
      lang === "en"
        ? "A short guide for first-time users. Open again anytime via「Replay guide」next to the language switch."
        : "第一次使用可先看這幾步。之後可點語言切換旁的「重看提交教學」再打開。";
    list.innerHTML = "";
    steps(lang).forEach((text, i) => {
      const li = document.createElement("li");
      li.textContent = `${i + 1}. ${text}`;
      list.appendChild(li);
    });
    done.textContent = lang === "en" ? "Got it" : "知道了，開始填";
  }

  function bind(opts) {
    const dialog = document.getElementById("tourDialog");
    if (!dialog) return { show() {}, syncLang() {} };
    const getLang = opts && opts.getLang ? opts.getLang : () => "zh";
    const doneBtn = dialog.querySelector("[data-tour-done]");
    const close = () => {
      dialog.hidden = true;
      markSeen();
    };
    if (doneBtn) doneBtn.addEventListener("click", close);
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) close();
    });

    function show() {
      paint(dialog, getLang());
      dialog.hidden = false;
    }

    function syncLang() {
      if (!dialog.hidden) paint(dialog, getLang());
    }

    if (!seen()) {
      // 等一拍，讓單位下拉先就緒
      setTimeout(show, 350);
    }

    const reopen = document.getElementById("btnTour");
    if (reopen) reopen.addEventListener("click", show);

    return { show, syncLang };
  }

  global.THETour = { bind, seen, show: null };
})(window);
