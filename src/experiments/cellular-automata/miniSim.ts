import type { RuleGenome } from "./types";

/**
 * Framework-free CPU engine for small grids: the breeding lab's live
 * thumbnails and rules.ts's `scoreGenome` both run this directly (no WebGL
 * context) since a 40x26 grid is trivially cheap for plain JS, and spinning up
 * 6+ extra WebGL2 contexts alongside the main canvas would be the wrong
 * tradeoff (browsers cap concurrent live contexts).
 *
 * This reimplements the SAME Generations transition as SIM_FS in shaders.ts -
 * an intentional GPU/CPU duplication (same rationale as reaction-diffusion's
 * grayscott.test.ts CPU reference). Keep the two in sync by hand if the rule
 * engine ever changes; no vitest file is added for this per this repo's "no
 * tests" convention.
 */

export function createGrid(w: number, h: number): Uint8Array {
  return new Uint8Array(w * h);
}

export function randomizeGrid(
  grid: Uint8Array,
  w: number,
  h: number,
  density: number,
  rng: () => number,
): void {
  const n = w * h;
  for (let i = 0; i < n; i++) grid[i] = rng() < density ? 1 : 0;
}

/** Count state===1 (alive, not decaying) neighbors in the Moore neighborhood at (x, y). */
function countAlive(grid: Uint8Array, w: number, h: number, x: number, y: number, wrap: boolean): number {
  let n = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      let nx = x + dx;
      let ny = y + dy;
      if (wrap) {
        nx = (nx + w) % w;
        ny = (ny + h) % h;
      } else if (nx < 0 || ny < 0 || nx >= w || ny >= h) {
        continue;
      }
      if (grid[ny * w + nx] === 1) n++;
    }
  }
  return n;
}

/**
 * One Generations step: dead(0) births to 1 if the alive-neighbor count is in
 * `birth`; alive(1) survives if the count is in `survive`, else starts
 * decaying (states-1) or dies outright when states===2; decaying (>=2) always
 * ages down by one, ignoring neighbors entirely. Writes into `dst` (caller
 * swaps src/dst), wraps the torus when `wrap` is true.
 */
export function stepGrid(
  src: Uint8Array,
  dst: Uint8Array,
  w: number,
  h: number,
  genome: RuleGenome,
  wrap: boolean,
): void {
  const { birth, survive, states } = genome;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const here = src[i];
      let next: number;
      if (here === 0) {
        const n = countAlive(src, w, h, x, y, wrap);
        next = (birth >> n) & 1 ? 1 : 0;
      } else if (here === 1) {
        const n = countAlive(src, w, h, x, y, wrap);
        const surv = (survive >> n) & 1;
        next = surv ? 1 : states > 2 ? states - 1 : 0;
      } else {
        next = here - 1;
      }
      dst[i] = next;
    }
  }
}

/** Draw a state grid to a 2D canvas via ImageData, mapped through a palette's RGBA bytes. */
export function drawGrid(
  ctx: CanvasRenderingContext2D,
  grid: Uint8Array,
  w: number,
  h: number,
  colors255: Uint8ClampedArray,
): void {
  const img = ctx.createImageData(w, h);
  const data = img.data;
  for (let i = 0; i < grid.length; i++) {
    const o = grid[i] * 4;
    const p = i * 4;
    data[p] = colors255[o];
    data[p + 1] = colors255[o + 1];
    data[p + 2] = colors255[o + 2];
    data[p + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}
