/** 逐步浮動教學：反白目標＋箭頭說明 */
(function (global) {
  const KEY = "theImpact2027.tour.seen.v2";
  const PAD = 8;

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

  function stepDefs(lang) {
    const en = lang === "en";
    return [
      {
        sel: "#unitSelect",
        title: en ? "Choose your unit" : "選擇填寫單位",
        body: en
          ? "Start here. Pick the unit you are filling for."
          : "從這裡開始：選你要代填的單位。",
        prefer: "bottom",
      },
      {
        sel: "#sdgTabs",
        title: en ? "SDG tabs" : "SDG 分頁",
        body: en
          ? "After a unit is selected, open an SDG to see assigned questions."
          : "選好單位後，點 SDG 分頁查看分派給你們的題目。",
        prefer: "bottom",
      },
      {
        sel: ".pane-left",
        title: en ? "Questions & answers" : "提問與填答",
        body: en
          ? "Fill answers and evidence here. Last year’s content is reference only."
          : "在這裡填答案與證據；去年內容只供參考。",
        prefer: "right",
      },
      {
        sel: ".pane-right",
        title: en ? "Methodology" : "方法論",
        body: en
          ? "The right pane shows THE methodology for the selected SDG or question."
          : "右側顯示目前 SDG／題目的 THE 方法論說明。",
        prefer: "left",
      },
      {
        sel: ".pane-left",
        title: en ? "Return if you cannot answer" : "無法填就退回",
        body: en
          ? "Under each question, use Return and write a suggestion (or「無」) if your unit cannot answer."
          : "每題下方可「退回」：表示本單位無法回答，並寫退回建議（沒有就填「無」）。",
        prefer: "right",
      },
      {
        sel: "#btnSubmit",
        title: en ? "Submit" : "提交",
        body: en
          ? "When finished, submit here and enter the filler’s name."
          : "改完按這裡提交，並輸入填寫人姓名。",
        prefer: "top",
      },
    ];
  }

  function bind(opts) {
    const root = document.getElementById("tourRoot");
    if (!root) return { show() {}, syncLang() {} };
    const getLang = (opts && opts.getLang) || (() => "zh");
    const spot = root.querySelector("[data-tour-spot]");
    const pop = root.querySelector("[data-tour-pop]");
    const arrow = root.querySelector("[data-tour-arrow]");
    const stepEl = root.querySelector("[data-tour-step]");
    const titleEl = root.querySelector("[data-tour-title]");
    const bodyEl = root.querySelector("[data-tour-body]");
    const btnPrev = root.querySelector("[data-tour-prev]");
    const btnNext = root.querySelector("[data-tour-next]");
    const btnSkip = root.querySelector("[data-tour-skip]");

    let index = 0;
    let active = false;
    let defs = [];

    function finish() {
      active = false;
      root.hidden = true;
      document.body.classList.remove("tour-open");
      markSeen();
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    }

    function onReposition() {
      if (active) place(defs[index]);
    }

    function place(def) {
      if (!def) return;
      const el = document.querySelector(def.sel);
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let rect;
      if (el) {
        el.scrollIntoView({ block: "nearest", inline: "nearest" });
        rect = el.getBoundingClientRect();
      } else {
        rect = { top: vh * 0.3, left: vw * 0.2, width: vw * 0.6, height: 80, bottom: vh * 0.3 + 80, right: vw * 0.8 };
      }

      const top = Math.max(PAD, rect.top - PAD);
      const left = Math.max(PAD, rect.left - PAD);
      const width = Math.min(vw - left - PAD, rect.width + PAD * 2);
      const height = Math.min(vh - top - PAD, rect.height + PAD * 2);

      spot.style.top = `${top}px`;
      spot.style.left = `${left}px`;
      spot.style.width = `${Math.max(width, 40)}px`;
      spot.style.height = `${Math.max(height, 36)}px`;

      pop.style.visibility = "hidden";
      pop.style.display = "block";
      const popW = pop.offsetWidth || 300;
      const popH = pop.offsetHeight || 140;

      let side = def.prefer || "bottom";
      const space = {
        bottom: vh - (top + height),
        top: top,
        right: vw - (left + width),
        left: left,
      };
      if (side === "bottom" && space.bottom < popH + 20 && space.top > space.bottom) side = "top";
      if (side === "top" && space.top < popH + 20 && space.bottom > space.top) side = "bottom";
      if (side === "right" && space.right < popW + 20 && space.left > space.right) side = "left";
      if (side === "left" && space.left < popW + 20 && space.right > space.left) side = "right";

      let popTop;
      let popLeft;
      arrow.className = "tour-arrow";
      if (side === "bottom") {
        popTop = top + height + 14;
        popLeft = left + width / 2 - popW / 2;
        arrow.classList.add("arrow-top");
      } else if (side === "top") {
        popTop = top - popH - 14;
        popLeft = left + width / 2 - popW / 2;
        arrow.classList.add("arrow-bottom");
      } else if (side === "right") {
        popTop = top + height / 2 - popH / 2;
        popLeft = left + width + 14;
        arrow.classList.add("arrow-left");
      } else {
        popTop = top + height / 2 - popH / 2;
        popLeft = left - popW - 14;
        arrow.classList.add("arrow-right");
      }

      popLeft = Math.min(Math.max(PAD, popLeft), vw - popW - PAD);
      popTop = Math.min(Math.max(PAD, popTop), vh - popH - PAD);

      pop.style.top = `${popTop}px`;
      pop.style.left = `${popLeft}px`;
      pop.style.visibility = "visible";
    }

    function render() {
      defs = stepDefs(getLang());
      const def = defs[index];
      if (!def) {
        finish();
        return;
      }
      const en = getLang() === "en";
      stepEl.textContent = en ? `Step ${index + 1} / ${defs.length}` : `步驟 ${index + 1}／${defs.length}`;
      titleEl.textContent = def.title;
      bodyEl.textContent = def.body;
      btnPrev.disabled = index === 0;
      btnPrev.hidden = index === 0;
      btnNext.textContent =
        index >= defs.length - 1 ? (en ? "Got it" : "知道了") : en ? "Next" : "下一步";
      btnSkip.textContent = en ? "Skip" : "略過";
      btnPrev.textContent = en ? "Back" : "上一步";
      place(def);
    }

    function show() {
      index = 0;
      active = true;
      root.hidden = false;
      document.body.classList.add("tour-open");
      window.addEventListener("resize", onReposition);
      window.addEventListener("scroll", onReposition, true);
      render();
    }

    function syncLang() {
      if (active) render();
    }

    btnNext.addEventListener("click", () => {
      if (index >= defs.length - 1) finish();
      else {
        index += 1;
        render();
      }
    });
    btnPrev.addEventListener("click", () => {
      if (index > 0) {
        index -= 1;
        render();
      }
    });
    btnSkip.addEventListener("click", finish);

    if (!seen()) setTimeout(show, 400);

    const reopen = document.getElementById("btnTour");
    if (reopen) reopen.addEventListener("click", show);

    return { show, syncLang };
  }

  global.THETour = { bind, seen };
})(window);
