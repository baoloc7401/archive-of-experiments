/**
 * Update the tooltip bubble's position custom-props from a pointer event on its
 * host element, so the bubble follows the cursor. Used by `Tooltip` and by any
 * element hosting a `.ui-tip` bubble inline (the `ui-tip-host` pattern).
 *
 * The bubble is centred on the cursor (CSS lifts it above), but we clamp that
 * centre so the bubble never crosses the viewport edge - otherwise a wide
 * absolutely-positioned bubble extends the document and widens the page.
 */
export function trackTip(el: HTMLElement | null, e: { clientX: number; clientY: number }) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  const tip = el.querySelector<HTMLElement>(":scope > .ui-tip");

  const margin = 8;
  // clientWidth excludes the vertical scrollbar, so the bubble stays inside the
  // visible content box (and out of the scrollbar gutter) rather than innerWidth.
  const viewW = document.documentElement.clientWidth;
  let centreX = e.clientX;
  if (tip) {
    const halfW = tip.offsetWidth / 2;
    const min = margin + halfW;
    const max = viewW - margin - halfW;
    // When the viewport is narrower than the bubble, min > max; centre instead.
    centreX = min > max ? viewW / 2 : Math.min(Math.max(centreX, min), max);
  }

  el.style.setProperty("--tip-x", `${centreX - r.left}px`);
  el.style.setProperty("--tip-y", `${e.clientY - r.top}px`);
}
