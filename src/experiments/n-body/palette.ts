/** Theme-derived colours read from the CSS custom properties, as GL floats. */
export type Rgb = [number, number, number];

export interface Palette {
  accent: Rgb;
  accent2: Rgb;
  textHi: Rgb;
  textDim: Rgb;
  bg: Rgb;
  /** CSS strings kept for the non-GL bits (legend dots, fallback text). */
  accentCss: string;
  accent2Css: string;
}

/** Parse a hex colour into 0..1 float channels. */
export function rgb(hex: string): Rgb {
  const h = hex.replace("#", "");
  const v =
    h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0").slice(0, 6);
  const n = parseInt(v, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Snapshot the current theme tokens (call again after a theme flip). */
export function readPalette(): Palette {
  const cs = getComputedStyle(document.documentElement);
  const get = (v: string, fb: string) => cs.getPropertyValue(v).trim() || fb;
  const accentCss = get("--accent", "#00f5c4");
  const accent2Css = get("--accent2", "#7c6cfa");
  return {
    accent: rgb(accentCss),
    accent2: rgb(accent2Css),
    textHi: rgb(get("--text-hi", "#e2e8f8")),
    textDim: rgb(get("--text-dim", "#464f6a")),
    bg: rgb(get("--bg", "#07080d")),
    accentCss,
    accent2Css,
  };
}
