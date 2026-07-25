import type { PaletteId } from "./types";
import { MAX_STATES } from "./constants";

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

function lerp(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/**
 * Each palette is exactly five colour stops: index 0 is the dead/background
 * colour, index 1 is the brightest "just born" colour, and indices 2..4 trace
 * a decay gradient toward something dim/dark. Cell age (alive -> decaying
 * states) walks this ramp, so a multi-state Generations rule (Brian's Brain,
 * Star Wars, Frogs) renders as a glowing, fading trail instead of a flat
 * on/off pixel - the main visual differentiator from a plain Life demo.
 */
const STOPS: Record<PaletteId, [string, string, string, string, string]> = {
  ember: ["#050302", "#fff4d6", "#ff7a1a", "#c81d1d", "#3a0a0a"],
  spectral: ["#040410", "#7dfcff", "#ff3df0", "#8a2be2", "#1a0b3d"],
  toxic: ["#040a04", "#c6ff3d", "#5ad639", "#1f8a5f", "#0a2618"],
  ice: ["#02050a", "#f2fbff", "#7fd8ff", "#2f7fd6", "#0a1f4a"],
  mono: ["#050505", "#ffffff", "#a8a8a8", "#5c5c5c", "#1a1a1a"],
};

export const PALETTE_IDS = Object.keys(STOPS) as PaletteId[];

/** Interpolate the decay gradient (stops 1..4) at t in 0..1 (0 = brightest, 1 = dimmest). */
function decayColor(stops: Rgb[], t: number): Rgb {
  const s = Math.min(Math.max(t, 0), 1) * 3;
  const seg = Math.min(Math.floor(s), 2);
  const frac = s - seg;
  return lerp(stops[1 + seg], stops[1 + seg + 1], frac);
}

/**
 * Build exactly `states` colours for a palette: index 0 = dead, index 1 =
 * brightest alive, indices 2..states-1 spread across the decay gradient. This
 * generalizes to any states count (2..MAX_STATES) instead of hardcoding a
 * palette per possible states value.
 */
function buildColors(id: PaletteId, states: number): Rgb[] {
  const stops = STOPS[id].map(rgb) as Rgb[];
  const out: Rgb[] = [stops[0]];
  for (let i = 1; i < states; i++) {
    const t = states > 2 ? (i - 1) / (states - 2) : 0;
    out.push(decayColor(stops, t));
  }
  return out;
}

/**
 * `states*3` floats ready for a single `uniform3fv(loc, colors)` upload to the
 * `uColors[MAX_STATES]` shader array. Always padded to the full MAX_STATES*3
 * length (repeating the last real colour) even though the shader clamps its
 * read index to `states-1`, so a short array is never uploaded.
 */
export function paletteColors(id: PaletteId, states: number): Float32Array {
  const colors = buildColors(id, states);
  const out = new Float32Array(MAX_STATES * 3);
  for (let i = 0; i < MAX_STATES; i++) {
    const c = colors[Math.min(i, colors.length - 1)];
    out[i * 3] = c[0];
    out[i * 3 + 1] = c[1];
    out[i * 3 + 2] = c[2];
  }
  return out;
}

/** Same ramp as {@link paletteColors}, as `states*4` RGBA bytes for miniSim's ImageData draw. */
export function paletteColors255(id: PaletteId, states: number): Uint8ClampedArray {
  const colors = buildColors(id, states);
  const out = new Uint8ClampedArray(states * 4);
  for (let i = 0; i < states; i++) {
    const c = colors[i];
    out[i * 4] = Math.round(c[0] * 255);
    out[i * 4 + 1] = Math.round(c[1] * 255);
    out[i * 4 + 2] = Math.round(c[2] * 255);
    out[i * 4 + 3] = 255;
  }
  return out;
}

/** The brightest (just-born) stop, for the sidebar swatch. */
export function paletteAccentCss(id: PaletteId): string {
  return STOPS[id][1];
}
