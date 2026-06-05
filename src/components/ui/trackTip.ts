/**
 * Update the tooltip bubble's position custom-props from a pointer event on its
 * host element, so the bubble follows the cursor. Used by `Tooltip` and by any
 * element hosting a `.ui-tip` bubble inline (the `ui-tip-host` pattern).
 */
export function trackTip(el: HTMLElement | null, e: { clientX: number; clientY: number }) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  el.style.setProperty("--tip-x", `${e.clientX - r.left}px`);
  el.style.setProperty("--tip-y", `${e.clientY - r.top}px`);
}
