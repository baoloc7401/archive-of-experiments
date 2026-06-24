import type { PaletteId } from "./types";

/** An RGB colour in 0..1 float channels (GL-ready). */
export type Rgb = [number, number, number];

/** Parse a hex colour into 0..1 float channels. */
export function rgb(hex: string): Rgb {
  const h = hex.replace("#", "");
  const v =
    h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0").slice(0, 6);
  const n = parseInt(v, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/**
 * Each palette is exactly five colour stops, low concentration to high. The
 * display shader interpolates across the four segments by V concentration, so
 * "empty" field reads as the first (dark) stop and dense growth as the last.
 * Ramps are fixed (not theme-derived): the display pass paints the whole stage,
 * so nothing behind it shows through and the mappings stay consistent.
 */
const STOPS: Record<PaletteId, [string, string, string, string, string]> = {
  magma: ["#000004", "#3b0f70", "#8c2981", "#f1605d", "#fcfdbf"],
  viridis: ["#440154", "#3b528b", "#21918c", "#5ec962", "#fde725"],
  ice: ["#03071e", "#023e8a", "#0096c7", "#48cae4", "#caf0f8"],
  ember: ["#03071e", "#6a040f", "#dc2f02", "#f48c06", "#ffba08"],
  mono: ["#0a0a0f", "#3a3a44", "#7a7a86", "#c2c2cc", "#ffffff"],
};

export const PALETTE_IDS = Object.keys(STOPS) as PaletteId[];

/**
 * The five stops of a palette flattened to a 15-float array, ready for a single
 * `uniform3fv(loc, stops)` upload to the `uStops[5]` shader array.
 */
export function paletteStops(id: PaletteId): Float32Array {
  const out = new Float32Array(15);
  STOPS[id].forEach((hex, i) => {
    const [r, g, b] = rgb(hex);
    out[i * 3] = r;
    out[i * 3 + 1] = g;
    out[i * 3 + 2] = b;
  });
  return out;
}

/** The high (densest-growth) stop, for the sidebar swatch / legend. */
export function paletteAccentCss(id: PaletteId): string {
  return STOPS[id][3];
}
