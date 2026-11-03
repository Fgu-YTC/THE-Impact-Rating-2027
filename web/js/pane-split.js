/** Resizable / collapsible methodology pane (shared by fill + admin). */
(function () {
  const STORAGE_W = "theImpactMethodPaneW";
  const STORAGE_COLLAPSED = "theImpactMethodPaneCollapsed";
  const MIN_W = 220;
  const MAX_W_RATIO = 0.62;
  const DEFAULT_W = 320;

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function readWidth() {
    const n = Number(localStorage.getItem(STORAGE_W));
    return Number.isFinite(n) && n >= MIN_W ? n : DEFAULT_W;
  }

  function readCollapsed() {
    return localStorage.getItem(STORAGE_COLLAPSED) === "1";
  }

  function maxWidth(layout) {
    const w = layout.getBoundingClientRect().width || window.innerWidth;
    return Math.max(MIN_W + 40, Math.floor(w * MAX_W_RATIO));
  }

  function applyWidth(layout, px) {
    const w = clamp(Math.round(px), MIN_W, maxWidth(layout));
    layout.style.setProperty("--method-pane-w", `${w}px`);
    return w;
  }

  function setCollapsed(layout, toggleBtn, collapsed, lang) {
    layout.classList.toggle("method-collapsed", collapsed);
    localStorage.setItem(STORAGE_COLLAPSED, collapsed ? "1" : "0");
    const pane = layout.querySelector(".pane-right");
    if (pane) {
      pane.title = collapsed
        ? lang === "en"
          ? "Click to expand methodology"
          : "點此展開方法論"
        : "";
      pane.setAttribute("aria-expanded", collapsed ? "false" : "true");
    }
    if (toggleBtn) {
      const en = lang === "en";
      toggleBtn.textContent = collapsed
        ? en
          ? "›"
          : "›"
        : en
          ? "Shrink"
          : "縮小";
      toggleBtn.setAttribute(
        "aria-expanded",
        collapsed ? "false" : "true"
      );
      toggleBtn.setAttribute(
        "aria-label",
        collapsed
          ? en
            ? "Expand methodology pane"
            : "展開方法論窗格"
          : en
            ? "Shrink methodology pane"
            : "縮小方法論窗格"
      );
      toggleBtn.title = collapsed
        ? en
          ? "Expand methodology pane"
          : "展開方法論窗格"
        : en
          ? "Shrink methodology pane"
          : "縮小方法論窗格";
    }
  }

  function currentLang() {
    if (window.THEUI && typeof window.THEUI.getLang === "function") {
      return window.THEUI.getLang() === "en" ? "en" : "zh";
    }
    return document.documentElement.lang === "en" ? "en" : "zh";
  }

  function init() {
    const layout = document.querySelector("main.layout");
    const pane = document.querySelector(".pane-right");
    if (!layout || !pane) return null;

    let split = layout.querySelector(".pane-split");
    if (!split) {
      split = document.createElement("button");
      split.type = "button";
      split.className = "pane-split";
      split.setAttribute("aria-label", "調整方法論窗格寬度");
      split.title = "拖曳調整寬度";
      const left = layout.querySelector(".pane-left");
      if (left && left.nextSibling) layout.insertBefore(split, left.nextSibling);
      else layout.insertBefore(split, pane);
    }

    let head = pane.querySelector(".method-head");
    const title = pane.querySelector("#methodTitle");
    if (!head && title) {
      head = document.createElement("div");
      head.className = "method-head";
      title.replaceWith(head);
      head.appendChild(title);
    }

    let toggleBtn = pane.querySelector(".method-toggle");
    if (head && !toggleBtn) {
      toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.className = "secondary method-toggle";
      head.appendChild(toggleBtn);
    }

    applyWidth(layout, readWidth());
    setCollapsed(layout, toggleBtn, readCollapsed(), currentLang());

    function toggleCollapsed(e) {
      if (e) e.stopPropagation();
      const next = !layout.classList.contains("method-collapsed");
      setCollapsed(layout, toggleBtn, next, currentLang());
    }

    if (toggleBtn) {
      toggleBtn.addEventListener("click", toggleCollapsed);
    }
    // 縮成窄軌後「展開」鈕常被擠掉；點整條方法論軌道即可展開
    pane.addEventListener("click", (e) => {
      if (!layout.classList.contains("method-collapsed")) return;
      if (e.target.closest("a, button, input, textarea, select, label")) return;
      setCollapsed(layout, toggleBtn, false, currentLang());
    });
    if (title) {
      title.addEventListener("click", (e) => {
        if (!layout.classList.contains("method-collapsed")) return;
        e.stopPropagation();
        setCollapsed(layout, toggleBtn, false, currentLang());
      });
    }

    let dragging = false;

    function onMove(clientX) {
      if (!dragging) return;
      const rect = layout.getBoundingClientRect();
      const next = rect.right - clientX;
      const w = applyWidth(layout, next);
      localStorage.setItem(STORAGE_W, String(w));
    }

    split.addEventListener("pointerdown", (e) => {
      if (layout.classList.contains("method-collapsed")) return;
      dragging = true;
      layout.classList.add("is-resizing");
      split.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    split.addEventListener("pointermove", (e) => onMove(e.clientX));
    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      layout.classList.remove("is-resizing");
      try {
        split.releasePointerCapture(e.pointerId);
      } catch (_) {}
    }
    split.addEventListener("pointerup", endDrag);
    split.addEventListener("pointercancel", endDrag);

    window.addEventListener("resize", () => {
      if (layout.classList.contains("method-collapsed")) return;
      applyWidth(layout, readWidth());
    });

    const api = {
      expand() {
        setCollapsed(layout, toggleBtn, false, currentLang());
      },
      collapse() {
        setCollapsed(layout, toggleBtn, true, currentLang());
      },
      refreshLabels() {
        setCollapsed(
          layout,
          toggleBtn,
          layout.classList.contains("method-collapsed"),
          currentLang()
        );
      },
    };
    window.THEPaneSplit = api;
    return api;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
