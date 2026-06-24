import { describe, expect, it } from "vitest";
import {
  DEFAULT_PARAMS,
  LAP_DIAG,
  LAP_ORTHO,
  MAX_FEED,
  MAX_KILL,
  MIN_FEED,
  MIN_KILL,
  SIM_MAX,
} from "./constants";
import { PRESETS, matchPreset } from "./presets";
import { PALETTE_IDS, paletteStops } from "./palettes";
import { simSize } from "./simulation";

/**
 * CPU reference of the Gray-Scott step, mirroring SIM_FS in shaders.ts: a 9-tap
 * toroidal Laplacian (LAP_ORTHO / LAP_DIAG, centre -1) plus the reaction. It is
 * deliberately a separate implementation so a test can run the math without a
 * GPU - the live freeze bugs were in the GL plumbing, but this guards the
 * algorithm itself (does the field evolve, stay bounded, and keep moving?).
 */
interface Field {
  u: Float32Array;
  v: Float32Array;
  w: number;
  h: number;
}

function makeField(w: number, h: number): Field {
  const u = new Float32Array(w * h).fill(1);
  const v = new Float32Array(w * h);
  return { u, v, w, h };
}

/** Stamp a filled square of the seed nucleus (U = 0.5, V = 0.25). */
function seedSquare(f: Field, cx: number, cy: number, r: number): void {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      const i = ((y + f.h) % f.h) * f.w + ((x + f.w) % f.w);
      f.u[i] = 0.5;
      f.v[i] = 0.25;
    }
  }
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function stepN(
  f: Field,
  feed: number,
  kill: number,
  du: number,
  dv: number,
  dt: number,
  steps: number,
): void {
  const { w, h } = f;
  let u = f.u;
  let v = f.v;
  let nu = new Float32Array(w * h);
  let nv = new Float32Array(w * h);
  for (let s = 0; s < steps; s++) {
    for (let y = 0; y < h; y++) {
      const yn = ((y - 1 + h) % h) * w;
      const yp = ((y + 1) % h) * w;
      const yc = y * w;
      for (let x = 0; x < w; x++) {
        const xl = (x - 1 + w) % w;
        const xr = (x + 1) % w;
        const c = yc + x;
        const ortho = u[yc + xl] + u[yc + xr] + u[yn + x] + u[yp + x];
        const diag = u[yn + xl] + u[yn + xr] + u[yp + xl] + u[yp + xr];
        const lapU = ortho * LAP_ORTHO + diag * LAP_DIAG - u[c];
        const orthoV = v[yc + xl] + v[yc + xr] + v[yn + x] + v[yp + x];
        const diagV = v[yn + xl] + v[yn + xr] + v[yp + xl] + v[yp + xr];
        const lapV = orthoV * LAP_ORTHO + diagV * LAP_DIAG - v[c];
        const uu = u[c];
        const vv = v[c];
        const reaction = uu * vv * vv;
        nu[c] = clamp01(uu + (du * lapU - reaction + feed * (1 - uu)) * dt);
        nv[c] = clamp01(vv + (dv * lapV + reaction - (kill + feed) * vv) * dt);
      }
    }
    [u, nu] = [nu, u];
    [v, nv] = [nv, v];
  }
  f.u = u;
  f.v = v;
}

function sumV(f: Field): number {
  let s = 0;
  for (let i = 0; i < f.v.length; i++) s += f.v[i];
  return s;
}

/** Mean |V change| between two fields, the CPU twin of the debug `delta`. */
function meanDelta(a: Field, b: Field): number {
  let s = 0;
  for (let i = 0; i < a.v.length; i++) s += Math.abs(a.v[i] - b.v[i]);
  return s / a.v.length;
}

function allFinite(f: Field): boolean {
  for (let i = 0; i < f.v.length; i++) {
    if (!Number.isFinite(f.u[i]) || !Number.isFinite(f.v[i])) return false;
    if (f.u[i] < 0 || f.u[i] > 1 || f.v[i] < 0 || f.v[i] > 1) return false;
  }
  return true;
}

describe("gray-scott algorithm", () => {
  it("mitosis seed evolves through a live transient, stays bounded, then settles", () => {
    const f = makeField(64, 64);
    seedSquare(f, 32, 32, 5);
    const seeded = sumV(f);

    // Mitosis params (the preset the user reported "frozen" while running).
    const p = { feed: 0.0367, kill: 0.0649, du: 1, dv: 0.5, dt: 1 };

    // Early transient: the field must actively change as the seed spreads.
    stepN(f, p.feed, p.kill, p.du, p.dv, p.dt, 100);
    const early = { u: f.u.slice(), v: f.v.slice(), w: f.w, h: f.h };
    stepN(f, p.feed, p.kill, p.du, p.dv, p.dt, 300);

    expect(allFinite(f)).toBe(true); // no NaN / out-of-range blow-up
    expect(sumV(f)).toBeGreaterThan(seeded * 1.1); // the seed spread, did not die
    expect(meanDelta(early, f)).toBeGreaterThan(1e-3); // it was genuinely stepping

    // Long run: mitosis converges to a static steady state. This is WHY the live
    // sim looks "frozen while running" - it is the attractor, not a stuck loop.
    // (The debug panel's `steps` keeps climbing; `delta` falls to ~0.) If a future
    // change makes the field blow up or die instead, this assertion catches it.
    stepN(f, p.feed, p.kill, p.du, p.dv, p.dt, 1500);
    const settled = { u: f.u.slice(), v: f.v.slice(), w: f.w, h: f.h };
    stepN(f, p.feed, p.kill, p.du, p.dv, p.dt, 200);
    expect(allFinite(f)).toBe(true);
    expect(meanDelta(settled, f)).toBeLessThan(1e-3); // converged, still alive
    expect(sumV(f)).toBeGreaterThan(0);
  });

  it("a flat substrate with no seed stays flat (V never spawns from nothing)", () => {
    const f = makeField(48, 48);
    stepN(f, 0.0367, 0.0649, 1, 0.5, 1, 300);
    expect(sumV(f)).toBeLessThan(1e-3);
  });

  it("every preset's seed produces a living field, not a dead one", () => {
    for (const preset of PRESETS) {
      const f = makeField(64, 64);
      seedSquare(f, 32, 32, 6);
      stepN(f, preset.feed, preset.kill, 1, 0.5, 1, 800);
      expect(allFinite(f), `${preset.id} stayed bounded`).toBe(true);
      expect(sumV(f), `${preset.id} kept some V alive`).toBeGreaterThan(0);
    }
  });
});

describe("presets", () => {
  it("matchPreset round-trips exact preset values and rejects off-values", () => {
    for (const preset of PRESETS) {
      expect(matchPreset(preset.feed, preset.kill)).toBe(preset.id);
    }
    expect(matchPreset(0.5, 0.5)).toBeNull();
  });

  it("every preset sits inside the slider ranges", () => {
    for (const preset of PRESETS) {
      expect(preset.feed).toBeGreaterThanOrEqual(MIN_FEED);
      expect(preset.feed).toBeLessThanOrEqual(MAX_FEED);
      expect(preset.kill).toBeGreaterThanOrEqual(MIN_KILL);
      expect(preset.kill).toBeLessThanOrEqual(MAX_KILL);
    }
  });
});

describe("palettes", () => {
  it("each palette yields 15 in-range floats", () => {
    for (const id of PALETTE_IDS) {
      const stops = paletteStops(id);
      expect(stops).toHaveLength(15);
      for (const c of stops) {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(1);
      }
    }
  });

  it("the default palette is a known palette", () => {
    expect(PALETTE_IDS).toContain(DEFAULT_PARAMS.palette);
  });
});

describe("simSize", () => {
  it("caps the longest edge at SIM_MAX while keeping aspect", () => {
    const big = simSize(4000, 2000);
    expect(Math.max(big.w, big.h)).toBeLessThanOrEqual(SIM_MAX);
    expect(big.w / big.h).toBeCloseTo(2, 1);
  });

  it("leaves canvases under the cap untouched", () => {
    expect(simSize(200, 120)).toEqual({ w: 200, h: 120 });
  });
});
