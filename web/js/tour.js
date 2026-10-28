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
          ? `This tour uses「${EXAMPLE_UNIT}」as an example. Later pick your own unit here.`
          : `教學先以「${EXAMPLE_UNIT}」為例；之後請在這裡改選你們單位。`,
        prefer: "bottom",
      },
      {
        sel: "#sdgTabs",
        title: en ? "SDG tabs" : "SDG 分頁",
        body: en
          ? `These are SDGs assigned to「${EXAMPLE_UNIT}」. Click a tab to switch goals.`
          : `這是「${EXAMPLE_UNIT}」有分派的 SDG；點分頁可切換目標。`,
        prefer: "bottom",
      },
      {
        sel: "#questionList .q-card, #questionList, .pane-left",
        title: en ? "Questions & answers" : "提問與填答",
        body: en
          ? `Example questions for「${EXAMPLE_UNIT}」. Fill answers and evidence; last year is reference only.`
          : `以下是「${EXAMPLE_UNIT}」的例題。在此填答案與證據；去年內容僅供參考。`,
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
          ? "When finished, submit here and enter the filler’s name. (Demo only—don’t submit for 永續辦 unless you mean to.)"
          : "改完按這裡提交並輸入填寫人。教學以永續辦示範，非你們單位時請勿誤送。",
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

    function finish() {
      active = false;
      root.hidden = true;
      document.body.classList.remove("tour-open");
      markSeen();
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
      try {
        restoreSelection();
      } catch (_) {}
    }

    function onReposition() {
      if (active) place(defs[index]);
    }

    function place(def) {
      if (!def) return;
      const el = firstMatch(def.sel);
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let rect;
      if (el) {
        el.scrollIntoView({ block: "nearest", inline: "nearest" });
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
      stepEl.textContent = en
        ? `Step ${index + 1} / ${defs.length} · example: ${EXAMPLE_UNIT}`
        : `步驟 ${index + 1}／${defs.length} · 以${EXAMPLE_UNIT}為例`;
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
      Promise.resolve(prepareExample())
        .catch(() => {})
        .then(() => {
          if (!active) return;
          // 等畫面畫出永續辦題目
          setTimeout(() => {
            if (active) render();
          }, 180);
        });
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

    const reopen = document.getElementById("btnTour");
    if (reopen) reopen.addEventListener("click", show);

    return { show, syncLang };
  }

  global.THETour = { bind, seen, EXAMPLE_UNIT };
})(window);
