/** 逐步浮動教學：以永續辦題目為例，反白＋箭頭說明 */
(function (global) {
  const KEY = "theImpact2027.tour.seen.v3";
  const PAD = 8;
  const EXAMPLE_UNIT = "永續辦";

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
          : "從這裡選擇你的填寫單位。",
        prefer: "bottom",
      },
      {
        sel: "#sdgTabs",
        title: en ? "SDG tabs" : "SDG 分頁",
        body: en
          ? "Open an SDG tab to see questions assigned to your unit."
          : "點 SDG 分頁，查看分派給你們的題目。",
        prefer: "bottom",
      },
      {
        sel: "#questionList .q-card, #questionList, .pane-left",
        title: en ? "Questions & answers" : "提問與填答",
        body: en
          ? "Fill answers and evidence here. Last year’s content is for reference only."
          : "在這裡填答案與證據；去年內容僅供參考。",
        prefer: "right",
      },
      {
        sel: ".pane-right",
        title: en ? "Methodology" : "方法論",
        body: en
          ? "The right pane shows THE methodology for the current SDG or question."
          : "右側顯示目前 SDG／題目的 THE 方法論。",
        prefer: "left",
      },
      {
        sel: ".q-return-btn, #questionList .q-card, .pane-left",
        title: en ? "Return if you cannot answer" : "無法填就退回",
        body: en
          ? "Next to「THE methodology」, tap Return. Then write a suggestion (or「無」)."
          : "在「看 THE 方法論」旁按「退回」，才會出現建議欄；沒有建議請填「無」。",
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

  function firstMatch(sel) {
    const parts = String(sel || "").split(",").map((s) => s.trim()).filter(Boolean);
    for (let i = 0; i < parts.length; i++) {
      const el = document.querySelector(parts[i]);
      if (el) return el;
    }
    return null;
  }

  function bind(opts) {
    const root = document.getElementById("tourRoot");
    if (!root) return { show() {}, syncLang() {} };
    const getLang = (opts && opts.getLang) || (() => "zh");
    const prepareExample = (opts && opts.prepareExample) || (() => Promise.resolve());
    const restoreSelection = (opts && opts.restoreSelection) || (() => {});
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

    let placeTimer = 0;
    let scrollQuiet = false;

    function finish() {
      active = false;
      root.hidden = true;
      document.body.classList.remove("tour-open");
      markSeen();
      window.clearTimeout(placeTimer);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onScrollReposition, true);
      try {
        restoreSelection();
      } catch (_) {}
    }

    function onReposition() {
      if (active) layout(defs[index]);
    }

    function onScrollReposition() {
      if (!active || scrollQuiet) return;
      window.clearTimeout(placeTimer);
      placeTimer = window.setTimeout(() => {
        if (active) layout(defs[index]);
      }, 40);
    }

    function scrollToEl(el) {
      if (!el) return;
      try {
        el.scrollIntoView({ behavior: "auto", block: "center", inline: "nearest" });
      } catch (_) {
        el.scrollIntoView(true);
      }
      // 左右欄是獨立 overflow，再對最近可捲動祖先補一次置中
      let node = el.parentElement;
      while (node && node !== document.body) {
        const style = window.getComputedStyle(node);
        const canScroll =
          /(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 4;
        if (canScroll) {
          const er = el.getBoundingClientRect();
          const nr = node.getBoundingClientRect();
          const delta = er.top + er.height / 2 - (nr.top + nr.height / 2);
          node.scrollTop += delta;
          break;
        }
        node = node.parentElement;
      }
    }

    function layout(def) {
      if (!def) return;
      const el = firstMatch(def.sel);
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let rect;
      if (el) {
        rect = el.getBoundingClientRect();
      } else {
        rect = {
          top: vh * 0.3,
          left: vw * 0.2,
          width: vw * 0.6,
          height: 80,
          bottom: vh * 0.3 + 80,
          right: vw * 0.8,
        };
      }

      const top = Math.max(PAD, rect.top - PAD);
      const left = Math.max(PAD, rect.left - PAD);
      const width = Math.min(vw - left - PAD, rect.width + PAD * 2);
      const height = Math.min(vh - top - PAD, Math.min(rect.height + PAD * 2, vh * 0.55));

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
      if (side === "bottom" && space.bottom < popH + 24 && space.top > space.bottom) side = "top";
      if (side === "top" && space.top < popH + 24 && space.bottom > space.top) side = "bottom";
      if (side === "right" && space.right < popW + 24 && space.left > space.right) side = "left";
      if (side === "left" && space.left < popW + 24 && space.right > space.left) side = "right";

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

    function goToStep() {
      defs = stepDefs(getLang());
      const def = defs[index];
      if (!def) {
        finish();
        return;
      }
      const en = getLang() === "en";
      stepEl.textContent = en
        ? `Step ${index + 1} / ${defs.length}`
        : `步驟 ${index + 1}／${defs.length}`;
      titleEl.textContent = def.title;
      bodyEl.textContent = def.body;
      btnPrev.disabled = index === 0;
      btnPrev.hidden = index === 0;
      btnNext.textContent =
        index >= defs.length - 1 ? (en ? "Got it" : "知道了") : en ? "Next" : "下一步";
      btnSkip.textContent = en ? "Skip" : "略過";
      btnPrev.textContent = en ? "Back" : "上一步";

      const el = firstMatch(def.sel);
      scrollQuiet = true;
      scrollToEl(el);
      window.clearTimeout(placeTimer);
      placeTimer = window.setTimeout(() => {
        layout(def);
        scrollQuiet = false;
        // 再量一次，避免字型／版面尚未穩定
        placeTimer = window.setTimeout(() => {
          if (active) layout(defs[index]);
        }, 80);
      }, 60);
    }

    function render() {
      goToStep();
    }

    function show() {
      index = 0;
      active = true;
      root.hidden = false;
      document.body.classList.add("tour-open");
      window.addEventListener("resize", onReposition);
      window.addEventListener("scroll", onScrollReposition, true);
      Promise.resolve(prepareExample())
        .catch(() => {})
        .then(() => {
          if (!active) return;
          setTimeout(() => {
            if (active) goToStep();
          }, 200);
        });
      goToStep();
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

    const reopen = document.getElementById("btnTour");
    if (reopen) reopen.addEventListener("click", show);

    return { show, syncLang };
  }

  global.THETour = { bind, seen, EXAMPLE_UNIT };
})(window);
