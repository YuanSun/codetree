/* Hover / tap tooltip for any element with data-tip (table cells, length bars). */
(function () {
  "use strict";
  const tip = document.getElementById("tip");
  function show(e) {
    const el = e.target.closest("[data-tip]");
    if (!el) { tip.hidden = true; return; }
    tip.textContent = el.dataset.tip;
    tip.hidden = false;
    const x = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8);
    tip.style.left = x + "px";
    tip.style.top = (e.clientY + 16) + "px";
  }
  document.addEventListener("pointermove", show);
  document.addEventListener("pointerdown", show);
  document.addEventListener("pointerleave", () => { tip.hidden = true; });
})();
