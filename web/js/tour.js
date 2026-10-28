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
          : "點 SDG 分頁，查看分派給貴單位的題目。",
        prefer: "bottom",
      },
      {
        sel: "#questionList .q-card .fill-compare-now, #questionList .q-card .fields, #questionList .q-card",
        title: en ? "Questions & answers" : "提問與填答",
        body: en
          ? "Fill answers and evidence here. Last year’s content is for reference only."
          : "在這裡填答案與證據；去年內容僅供參考。",
        prefer: "bottom",
        scroll: "start",
      },
      {
        sel: "#questionList .q-card .q-method-btn, .pane-right .method-body, .pane-right",
        title: en ? "THE methodology" : "THE 方法論",
        body: en
          ? "Every question has a THE methodology button. Tap it to read THE’s Chinese methodology on the right."
          : "每個題目都有「看 THE 方法論」；點了可在右側看到 THE 的中文方法論內容。",
        prefer: "bottom",
        scroll: "start",
      },
      {
        sel: "#questionList .q-card .q-return-btn, #questionList .q-card .q-meta",
        title: en ? "Return if you cannot answer" : "無法填就退回",
        body: en
          ? "Tap Return to open the suggestion field. If you have no suggestion, enter「無」."
          : "按「退回」會出現建議欄；沒有建議請填「無」。",
        prefer: "bottom",
        scroll: "start",
      },
      {
        sel: "#btnSubmit",
        title: en ? "Submit" : "提交",
        body: en
          ? "When finished, submit here and enter the filler’s name. You can still edit and submit again later."
          : "改完按這裡提交，並輸入填寫人姓名。提交後仍可修改，再按一次提交即可更新。",
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

    /** 頂部 sticky（頂欄／年度說明／SDG 分頁）下緣，反白不可鑽進去 */
    function chromeBottom() {
      let bottom = PAD;
      [".topbar", ".data-year-note", ".sdg-tabs"].forEach((sel) => {
        const el = document.querySelector(sel);
        if (!el) return;
        const r = el.getBoundingClientRect();
        if (r.bottom > bottom) bottom = r.bottom;
      });
      return bottom + 6;
    }

    function footerTop() {
      const bar = document.querySelector(".bottombar");
      if (!bar) return window.innerHeight - PAD;
      return Math.min(window.innerHeight - PAD, bar.getBoundingClientRect().top - 6);
    }

    function scrollToEl(el, mode) {
      if (!el) return;
      const block = mode === "start" ? "start" : "center";
      try {
        el.scrollIntoView({ behavior: "auto", block, inline: "nearest" });
      } catch (_) {
        el.scrollIntoView(true);
      }
      const clear = chromeBottom();
      let node = el.parentElement;
      while (node && node !== document.body) {
        const style = window.getComputedStyle(node);
        const canScroll =
          /(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 4;
        if (canScroll) {
          const er = el.getBoundingClientRect();
          const nr = node.getBoundingClientRect();
          if (block === "start") {
            // 對齊到分頁列下方，不要被那條頂欄蓋住
            node.scrollTop += er.top - Math.max(nr.top, clear) - 10;
          } else {
            const mid = (Math.max(nr.top, clear) + nr.bottom) / 2;
            node.scrollTop += er.top + er.height / 2 - mid;
          }
          break;
        }
        node = node.parentElement;
      }
    }

    function targetInChrome(el) {
      if (!el || !el.closest) return false;
      return !!(
        el.closest(".topbar") ||
        el.closest(".data-year-note") ||
        el.id === "sdgTabs" ||
        el.closest(".sdg-tabs") ||
        el.closest(".bottombar")
      );
    }

    /** 內容區反白避開 sticky 頂列；頂欄／分頁本身則不夾 */
    function intersectViewport(rect, vw, vh, skipChromeClamp) {
      const topMin = skipChromeClamp ? PAD : chromeBottom();
      const bottomMax = skipChromeClamp ? window.innerHeight - PAD : footerTop();
      const top = Math.max(topMin, rect.top);
      const left = Math.max(PAD, rect.left);
      const bottom = Math.min(bottomMax, rect.bottom);
      const right = Math.min(vw - PAD, rect.right);
      const width = Math.max(0, right - left);
      const height = Math.max(0, bottom - top);
      return { top, left, width, height };
    }

    function layout(def) {
      if (!def) return;
      const el = firstMatch(def.sel);
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const inChrome = targetInChrome(el);
      const topMin = inChrome ? PAD : chromeBottom();
      let raw;
      if (el) {
        raw = el.getBoundingClientRect();
      } else {
        raw = {
          top: topMin + 24,
          left: vw * 0.15,
          width: vw * 0.45,
          height: 120,
          bottom: topMin + 144,
          right: vw * 0.6,
        };
      }

      let { top, left, width, height } = intersectViewport(
        {
          top: raw.top - PAD,
          left: raw.left - PAD,
          bottom: raw.bottom + PAD,
          right: raw.right + PAD,
        },
        vw,
        vh,
        inChrome
      );
      if (width < 40 || height < 28) {
        if (inChrome && el) {
          top = Math.max(PAD, raw.top - PAD);
          left = Math.max(PAD, raw.left - PAD);
          width = Math.min(vw - left - PAD, Math.max(raw.width + PAD * 2, 120));
          height = Math.min(vh - top - PAD, Math.max(raw.height + PAD * 2, 36));
        } else {
          top = topMin + 12;
          left = Math.max(PAD, raw.left);
          width = Math.min(vw - left - PAD, Math.max(raw.width, 200));
          height = Math.min(footerTop() - top, 220);
        }
      } else if (!inChrome) {
        height = Math.min(height, Math.max(120, footerTop() - top));
      }

      width = Math.max(width, 40);
      height = Math.max(height, 36);
      spot.style.top = `${top}px`;
      spot.style.left = `${left}px`;
      spot.style.width = `${width}px`;
      spot.style.height = `${height}px`;

      pop.style.visibility = "hidden";
      pop.style.display = "block";
      const popW = pop.offsetWidth || 300;
      const popH = pop.offsetHeight || 140;
      const spotBox = { top, left, width, height };
      const placed = placePopOutsideSpot(spotBox, def.prefer || "right", popW, popH, vw, vh);
      arrow.className = "tour-arrow " + placed.arrow;
      pop.style.top = `${placed.top}px`;
      pop.style.left = `${placed.left}px`;
      pop.style.visibility = "visible";
    }

    function boxesOverlap(a, b, gap) {
      return !(
        a.left + a.width + gap <= b.left ||
        b.left + b.width + gap <= a.left ||
        a.top + a.height + gap <= b.top ||
        b.top + b.height + gap <= a.top
      );
    }

    /** 浮框一定放在反白色塊外，避免被提問區擋住 */
    function placePopOutsideSpot(spotBox, prefer, popW, popH, vw, vh) {
      const gap = 16;
      const clamp = (left, top) => ({
        left: Math.min(Math.max(PAD, left), vw - popW - PAD),
        top: Math.min(Math.max(PAD, top), vh - popH - PAD),
      });
      const trials = [];
      const sides = [prefer, "right", "bottom", "left", "top"].filter(
        (s, i, arr) => s && arr.indexOf(s) === i
      );
      sides.forEach((side) => {
        let left;
        let top;
        let arrowCls;
        if (side === "right") {
          left = spotBox.left + spotBox.width + gap;
          top = spotBox.top + spotBox.height / 2 - popH / 2;
          arrowCls = "arrow-left";
        } else if (side === "left") {
          left = spotBox.left - popW - gap;
          top = spotBox.top + spotBox.height / 2 - popH / 2;
          arrowCls = "arrow-right";
        } else if (side === "bottom") {
          left = spotBox.left + spotBox.width / 2 - popW / 2;
          top = spotBox.top + spotBox.height + gap;
          arrowCls = "arrow-top";
        } else {
          left = spotBox.left + spotBox.width / 2 - popW / 2;
          top = spotBox.top - popH - gap;
          arrowCls = "arrow-bottom";
        }
        const c = clamp(left, top);
        const box = { left: c.left, top: c.top, width: popW, height: popH };
        trials.push({
          ...c,
          arrow: arrowCls,
          ok: !boxesOverlap(box, spotBox, 8),
        });
      });
      const good = trials.find((t) => t.ok);
      if (good) return good;
      // 仍重疊時：放到視窗右下／右上空隙
      const fallbacks = [
        { left: vw - popW - PAD, top: Math.min(spotBox.top, vh - popH - PAD), arrow: "arrow-left" },
        { left: vw - popW - PAD, top: PAD + 48, arrow: "arrow-left" },
        { left: PAD, top: vh - popH - PAD, arrow: "arrow-top" },
      ];
      for (let i = 0; i < fallbacks.length; i++) {
        const f = fallbacks[i];
        const c = clamp(f.left, f.top);
        const box = { left: c.left, top: c.top, width: popW, height: popH };
        if (!boxesOverlap(box, spotBox, 4)) return { ...c, arrow: f.arrow };
      }
      return { left: vw - popW - PAD, top: PAD + 48, arrow: "arrow-left" };
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

      // 每一步都再套一次示範單位，避免中途又變「請先選擇填寫單位」
      Promise.resolve(prepareExample())
        .catch(() => {})
        .then(() => {
          if (!active) return;
          const el = firstMatch(def.sel);
          scrollQuiet = true;
          scrollToEl(el, def.scroll || "center");
          window.clearTimeout(placeTimer);
          placeTimer = window.setTimeout(() => {
            layout(def);
            scrollQuiet = false;
            placeTimer = window.setTimeout(() => {
              if (active) layout(defs[index]);
            }, 100);
          }, 80);
        });
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
      // 等範例單位就緒再反白，避免步驟 1 對到空白頁
      Promise.resolve(prepareExample())
        .catch(() => {})
        .then(() => {
          if (!active) return;
          setTimeout(() => {
            if (active) goToStep();
          }, 200);
        });
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
