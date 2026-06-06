/** Theme-derived colours read from the CSS custom properties. */
export interface Palette {
  accent: string;
  accent2: string;
  accentRgb: string;
  textHi: string;
  textDimRgb: string;
  wip: string;
  bgRgb: string;
}

/** Parse a hex colour into "r,g,b" for rgba() composition. */
export function rgb(hex: string): string {
  const h = hex.replace("#", "");
  const v =
    h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0").slice(0, 6);
  const n = parseInt(v, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

/** Snapshot the current theme tokens (call again after a theme flip). */
export function readPalette(): Palette {
  const cs = getComputedStyle(document.documentElement);
  const get = (v: string) => cs.getPropertyValue(v).trim();
  const accent = get("--accent") || "#00f5c4";
  return {
    accent,
    accent2: get("--accent2") || "#7c6cfa",
    accentRgb: rgb(accent),
    textHi: get("--text-hi") || "#e2e8f8",
    textDimRgb: rgb(get("--text-dim") || "#464f6a"),
    wip: get("--wip") || "#ffcc4d",
    bgRgb: rgb(get("--bg") || "#07080d"),
  };
}
