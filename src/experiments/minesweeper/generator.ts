import type { Cell, FieldConfig, GenStats, Minefield, RatingTier, Technique } from "./types";
import { ENUM_LIMIT, ENUM_NODE_CAP, FRESH_BEFORE_SWAP, MAX_ATTEMPTS, MAX_DENSITY, MAX_SWAPS, TIME_BUDGET_MS } from "./constants";
import { disk, neighborTable } from "./grid";
import { mulberry32, randInt, shuffle, type Rng } from "./rng";
import {
  createKnowledge,
  type FullTechniques,
  fullPropagate,
  isSolved,
  reveal,
  unknownCells,
} from "./solvers/core";

/**
 * Forge a field that is first-click safe (no mine in the safe disk around
 * `origin`), no-guess solvable (verified by `fullPropagate`), and difficulty-
 * rated. Generate-and-test with single-mine hill-climb repair: random boards are
 * rarely no-guess, so after a few fresh tries we relocate mines off the ambiguous
 * frontier rather than re-rolling. Bounded by a wall clock; returns the best
 * near-solvable board flagged `solved:false` if the budget runs out.
 */

/** Build the ground-truth field from the set of mine indices. */
function buildField(
  mineSet: Set<number>,
  width: number,
  height: number,
  table: number[][],
  origin: number,
): Minefield {
  const total = width * height;
  const cells: Cell[] = new Array(total);
  for (let i = 0; i < total; i++) {
    if (mineSet.has(i)) {
      cells[i] = { mine: true, adjacent: 0 };
    } else {
      let adj = 0;
      for (const n of table[i]) if (mineSet.has(n)) adj++;
      cells[i] = { mine: false, adjacent: adj };
    }
  }
  return {
    width,
    height,
    mineCount: mineSet.size,
    cells,
    mineIndices: [...mineSet].sort((a, b) => a - b),
    safeOrigin: origin,
  };
}

/** Bechtel's 3BV: the minimum number of left-clicks to clear with perfect play. */
function compute3BV(cells: Cell[], total: number, table: number[][]): number {
  const inOpening = new Uint8Array(total);
  const visited = new Uint8Array(total);
  let openings = 0;
  for (let i = 0; i < total; i++) {
    if (cells[i].mine || cells[i].adjacent !== 0 || visited[i]) continue;
    openings++;
    const stack = [i];
    visited[i] = 1;
    while (stack.length) {
      const c = stack.pop()!;
      inOpening[c] = 1;
      for (const n of table[c]) {
        if (cells[n].mine) continue;
        inOpening[n] = 1; // numbered border of an opening is cleared by the cascade
        if (cells[n].adjacent === 0 && !visited[n]) {
          visited[n] = 1;
          stack.push(n);
        }
      }
    }
  }
  let isolated = 0;
  for (let i = 0; i < total; i++) {
    if (!cells[i].mine && cells[i].adjacent > 0 && !inOpening[i]) isolated++;
  }
  return openings + isolated;
}

function hardestOf(t: Record<Technique, number>): Technique {
  if (t.enumerate > 0) return "enumerate";
  if (t.subset > 0) return "subset";
  return "count";
}

function rate(
  density: number,
  hardest: Technique,
  threeBV: number,
  total: number,
  solved: boolean,
): { rating: number; tier: RatingTier } {
  let r = 0;
  r += Math.min(1, density / MAX_DENSITY) * 34;
  r += hardest === "enumerate" ? 34 : hardest === "subset" ? 18 : 0;
  r += Math.min(26, (threeBV / total) * 64);
  if (!solved) r = Math.max(r, 88); // an unavoidable guess is its own kind of brutal
  const rating = Math.round(Math.max(2, Math.min(100, r)));
  const tier: RatingTier =
    rating < 20 ? "trivial" : rating < 40 ? "easy" : rating < 62 ? "medium" : rating < 82 ? "hard" : "brutal";
  return { rating, tier };
}

/** Clamp a requested mine count to what's physically placeable and worth attempting. */
export function clampMines(width: number, height: number, mines: number, safeRadius: number): number {
  const total = width * height;
  const safeCells = (Math.min(safeRadius, width - 1) * 2 + 1) * (Math.min(safeRadius, height - 1) * 2 + 1);
  const hardMax = total - safeCells; // every non-safe cell could be a mine
  const densityMax = Math.floor(total * MAX_DENSITY);
  return Math.max(1, Math.min(mines, hardMax, Math.max(densityMax, 1)));
}

export function generateField(cfg: FieldConfig, origin: number): { field: Minefield; stats: GenStats } {
  const { width, height } = cfg;
  const total = width * height;
  const table = neighborTable(width, height);
  const safe = new Set(disk(origin, cfg.safeRadius, width, height));
  const candidates = [...Array(total).keys()].filter((i) => !safe.has(i));
  const mines = Math.min(clampMines(width, height, cfg.mines, cfg.safeRadius), candidates.length);

  const seed = cfg.seed !== 0 ? cfg.seed : ((Date.now() ^ (origin * 2654435761)) >>> 0) || 1;
  const rng: Rng = mulberry32(seed);
  const t0 = (typeof performance !== "undefined" ? performance.now() : Date.now());
  const timeLeft = () => (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0 < TIME_BUDGET_MS;

  const density = mines / total;

  // Draw a fresh random mine placement.
  function freshSet(): Set<number> {
    const pool = candidates.slice();
    shuffle(pool, rng);
    return new Set(pool.slice(0, mines));
  }

  type Eval = {
    mineSet: Set<number>;
    field: Minefield;
    solved: boolean;
    coverage: number;
    undecided: number[];
    techniques: FullTechniques;
  };
  function evaluate(mineSet: Set<number>): Eval {
    const field = buildField(mineSet, width, height, table, origin);
    const k = createKnowledge(field, table);
    reveal(k, origin);
    const techniques: FullTechniques = { count: 0, subset: 0, enumerate: 0 };
    fullPropagate(k, ENUM_LIMIT, ENUM_NODE_CAP, techniques);
    return {
      mineSet,
      field,
      solved: isSolved(k),
      coverage: k.revealedCount + k.identified,
      undecided: isSolved(k) ? [] : unknownCells(k),
      techniques,
    };
  }

  let attempts = 0;
  let swaps = 0;
  let best = evaluate(freshSet());
  attempts++;

  // Phase 1 - a handful of fresh boards; many easy fields are solved outright here.
  while (!best.solved && attempts < FRESH_BEFORE_SWAP && timeLeft()) {
    const cand = evaluate(freshSet());
    attempts++;
    if (cand.coverage > best.coverage) best = cand;
  }

  // Phase 2 - hill-climb: relocate a mine touching the ambiguous frontier, keep
  // boards that don't regress, restart fresh when we stall in a local minimum.
  let sinceImprove = 0;
  while (!best.solved && swaps < MAX_SWAPS && attempts < MAX_ATTEMPTS && timeLeft()) {
    const next = new Set(best.mineSet);
    // Prefer a mine bordering an undecided cell (the ambiguity to break).
    const frontierMines: number[] = [];
    for (const u of best.undecided) {
      for (const n of table[u]) if (next.has(n)) frontierMines.push(n);
    }
    const movable = frontierMines.length > 0 ? frontierMines : [...next];
    const from = movable[randInt(rng, movable.length)];
    // Move it to a random currently-empty, non-safe cell.
    const empties = candidates.filter((i) => !next.has(i));
    if (empties.length === 0) break;
    const to = empties[randInt(rng, empties.length)];
    next.delete(from);
    next.add(to);

    const cand = evaluate(next);
    swaps++;
    if (cand.coverage >= best.coverage) {
      if (cand.coverage > best.coverage) sinceImprove = 0;
      best = cand;
    } else {
      sinceImprove++;
    }
    if (sinceImprove > 220 && attempts < MAX_ATTEMPTS) {
      const fresh = evaluate(freshSet());
      attempts++;
      sinceImprove = 0;
      if (fresh.coverage >= best.coverage) best = fresh;
    }
  }

  const threeBV = compute3BV(best.field.cells, total, table);
  const hardest = hardestOf(best.techniques);
  const { rating, tier } = rate(density, hardest, threeBV, total, best.solved);
  const ms = Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - t0);

  const stats: GenStats = {
    attempts,
    swaps,
    solved: best.solved,
    techniques: best.techniques,
    hardest,
    rating,
    tier,
    threeBV,
    density,
    ms,
    seed,
    undecided: best.solved ? [] : best.undecided,
  };

  return { field: best.field, stats };
}
