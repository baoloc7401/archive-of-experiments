/** Theme-derived colours read from the CSS custom properties. */
export interface Palette {
  accentRgb: [number, number, number];
  accent2Rgb: [number, number, number];
  textHiRgb: [number, number, number];
  bgRgb: [number, number, number];
}

/** Parse a hex colour into an [r, g, b] triple. */
export function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const v =
    h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0").slice(0, 6);
  const n = parseInt(v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Snapshot the current theme tokens (call again after a theme flip). */
export function readPalette(): Palette {
  const cs = getComputedStyle(document.documentElement);
  const get = (v: string) => cs.getPropertyValue(v).trim();
  return {
    accentRgb: rgb(get("--accent") || "#00f5c4"),
    accent2Rgb: rgb(get("--accent2") || "#7c6cfa"),
    textHiRgb: rgb(get("--text-hi") || "#e2e8f8"),
    bgRgb: rgb(get("--bg") || "#07080d"),
  };
}

/** Linearly blend two rgb triples (`t` in 0..1). */
export function mix(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
