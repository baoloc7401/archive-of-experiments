import type { Board, SolveOptions, Solver, SolverReport } from "./types";
import { ENUM_LIMIT, ENUM_NODE_CAP } from "../constants";
import {
  buildConstraints,
  components,
  type Constraint,
  createKnowledge,
  fullPropagate,
  isUnknown,
  type Knowledge,
  markMine,
  now,
  reveal,
  report,
  unknownCells,
} from "./core";

/**
 * Exhausts the logic ({@link fullPropagate}), then computes each remaining cell's
 * exact mine probability and picks the safest click. Probabilities are global,
 * not local estimates: each border component is enumerated, then the components
 * are combined under the global mine budget (including the "outside" cells no
 * clue touches) via a generating-function convolution counted in BigInt. Cells at
 * probability 0 or 1 are forced, catching global-count deductions the frontier-
 * only solvers miss.
 */

interface Detail {
  /** solutions of this component grouped by its mine total. */
  countByM: Map<number, bigint>;
  /** per cell: solutions where that cell is a mine, grouped by mine total. */
  cellMineByM: Map<number, bigint>[];
}

/** Enumerate one component, tracking per-cell mine totals by overall mine count. */
function enumerateDetailed(cells: number[], cons: Constraint[], nodeCap: number): Detail | null {
  const pos = new Map<number, number>();
  cells.forEach((v, k) => pos.set(v, k));
  const cVars = cons.map((c) => c.cells.map((v) => pos.get(v)!).filter((p) => p !== undefined));
  const cNeed = cons.map((c) => c.mines);
  const cell2cons: number[][] = cells.map(() => []);
  cVars.forEach((vs, ci) => vs.forEach((p) => cell2cons[p].push(ci)));

  const assignedMines = new Int32Array(cons.length);
  const unassigned = Int32Array.from(cVars.map((vs) => vs.length));
  const assign = new Int8Array(cells.length).fill(-1);
  const countByM = new Map<number, bigint>();
  const cellMineByM: Map<number, bigint>[] = cells.map(() => new Map());
  let nodes = 0;
  let capped = false;

  function recurse(idx: number, mineTally: number) {
    if (capped) return;
    if (++nodes > nodeCap) {
      capped = true;
      return;
    }
    if (idx === cells.length) {
      countByM.set(mineTally, (countByM.get(mineTally) ?? 0n) + 1n);
      for (let p = 0; p < cells.length; p++) {
        if (assign[p] === 1) {
          const m = cellMineByM[p];
          m.set(mineTally, (m.get(mineTally) ?? 0n) + 1n);
        }
      }
      return;
    }
    for (let val = 0; val <= 1; val++) {
      assign[idx] = val;
      let feasible = true;
      for (const ci of cell2cons[idx]) {
        unassigned[ci]--;
        if (val === 1) assignedMines[ci]++;
        if (assignedMines[ci] > cNeed[ci] || assignedMines[ci] + unassigned[ci] < cNeed[ci]) feasible = false;
      }
      if (feasible) recurse(idx + 1, mineTally + val);
      for (const ci of cell2cons[idx]) {
        unassigned[ci]++;
        if (val === 1) assignedMines[ci]--;
      }
      if (capped) return;
    }
    assign[idx] = -1;
  }
  recurse(0, 0);
  return capped ? null : { countByM, cellMineByM };
}

const binomCache = new Map<string, bigint>();
function binom(n: number, k: number): bigint {
  if (k < 0 || k > n || n < 0) return 0n;
  const key = `${n},${k}`;
  const hit = binomCache.get(key);
  if (hit !== undefined) return hit;
  k = Math.min(k, n - k);
  let num = 1n;
  let den = 1n;
  for (let i = 0; i < k; i++) {
    num *= BigInt(n - i);
    den *= BigInt(i + 1);
  }
  const r = num / den;
  binomCache.set(key, r);
  return r;
}

/** Polynomial (coefficients keyed by exponent) multiply. */
function convolve(a: Map<number, bigint>, b: Map<number, bigint>): Map<number, bigint> {
  const out = new Map<number, bigint>();
  for (const [s1, v1] of a) {
    for (const [s2, v2] of b) {
      const s = s1 + s2;
      out.set(s, (out.get(s) ?? 0n) + v1 * v2);
    }
  }
  return out;
}

function ratio(n: bigint, d: bigint): number {
  if (d === 0n) return 0;
  const SCALE = 1_000_000n;
  return Number((n * SCALE) / d) / 1_000_000;
}

interface ProbResult {
  prob: Map<number, number>;
  /** Cells with probability exactly 0 (safe) or 1 (mine). */
  forcedSafe: number[];
  forcedMine: number[];
}

/** Exact per-cell mine probability over all global models. null if a component
 *  blew the enumeration cap (probabilities then can't be computed exactly). */
function probabilities(k: Knowledge, nodeCap: number, enumLimit: number): ProbResult | null {
  const constraints = buildConstraints(k);
  const unknown = unknownCells(k);
  if (unknown.length === 0) return { prob: new Map(), forcedSafe: [], forcedMine: [] };

  const comps = components(constraints);
  const details: Detail[] = [];
  for (const comp of comps) {
    if (comp.cells.length > enumLimit) return null;
    const d = enumerateDetailed(comp.cells, comp.cons, nodeCap);
    if (!d) return null;
    details.push(d);
  }

  const frontier = new Set(comps.flatMap((c) => c.cells));
  const outside = unknown.filter((c) => !frontier.has(c));
  const o = outside.length;
  const R = k.mineCount - k.identified;

  // A(S) = number of frontier arrangements using exactly S mines (all components).
  let A: Map<number, bigint> = new Map([[0, 1n]]);
  for (const d of details) A = convolve(A, d.countByM);

  // Total weighted models: pick S frontier mines, the rest among the outside o.
  let T = 0n;
  for (const [s, v] of A) T += v * binom(o, R - s);
  if (T === 0n) return null; // inconsistent — leave it to the logic solvers

  const prob = new Map<number, number>();
  const forcedSafe: number[] = [];
  const forcedMine: number[] = [];

  // Frontier cells: weight component j's cell against the convolution of the rest.
  comps.forEach((comp, j) => {
    const rest = details.reduce<Map<number, bigint>>(
      (acc, d, i) => (i === j ? acc : convolve(acc, d.countByM)),
      new Map([[0, 1n]]),
    );
    comp.cells.forEach((cell, p) => {
      if (!isUnknown(k, cell)) return;
      const qx = convolve(details[j].cellMineByM[p], rest);
      let N = 0n;
      for (const [s, v] of qx) N += v * binom(o, R - s);
      const P = ratio(N, T);
      prob.set(cell, P);
      if (N === 0n) forcedSafe.push(cell);
      else if (N === T) forcedMine.push(cell);
    });
  });

  // Outside cells (symmetric): place this one as a mine, the rest among o−1.
  if (o > 0) {
    let N = 0n;
    for (const [s, v] of A) N += v * binom(o - 1, R - s - 1);
    const P = ratio(N, T);
    for (const cell of outside) {
      prob.set(cell, P);
      if (N === 0n) forcedSafe.push(cell);
      else if (N === T) forcedMine.push(cell);
    }
  }

  return { prob, forcedSafe, forcedMine };
}

function solve(board: Board, origin: number, opts: SolveOptions = {}): SolverReport {
  const enumLimit = opts.enumLimit ?? ENUM_LIMIT;
  const nodeCap = opts.nodeCap ?? ENUM_NODE_CAP;
  const t0 = now();
  const k = createKnowledge(board, undefined, true);
  reveal(k, origin);
  const techniques = { count: 0, subset: 0, enumerate: 0, probability: 0 };
  let steps = 0;
  let probs: Map<number, number> | null = null;

  for (;;) {
    const tech = { count: 0, subset: 0, enumerate: 0 };
    steps += fullPropagate(k, enumLimit, nodeCap, tech);
    techniques.count += tech.count;
    techniques.subset += tech.subset;
    techniques.enumerate += tech.enumerate;
    if (k.revealedCount + k.identified === k.total) break;

    const pr = probabilities(k, nodeCap, enumLimit);
    if (!pr) break; // enumeration too large — leave the rest undecided
    probs = pr.prob;
    if (pr.forcedSafe.length || pr.forcedMine.length) {
      techniques.probability++;
      steps++;
      for (const c of pr.forcedSafe) reveal(k, c);
      for (const c of pr.forcedMine) markMine(k, c);
      continue; // global-count progress — re-run the cheap logic
    }
    break; // genuinely stuck: probabilities stand, pick the safest guess
  }

  // Best guess = lowest mine probability among the still-unknown cells.
  let bestGuess: number | null = null;
  if (k.revealedCount + k.identified !== k.total && probs) {
    let best = Infinity;
    for (let i = 0; i < k.total; i++) {
      if (!isUnknown(k, i)) continue;
      const p = probs.get(i) ?? 1;
      if (p < best) {
        best = p;
        bestGuess = i;
      }
    }
  }

  return report(k, "probabilistic", techniques, steps, now() - t0, {
    probabilities: probs,
    bestGuess,
  });
}

export const probabilisticSolver: Solver = {
  id: "probabilistic",
  name: "Probabilistic",
  tagline: "exact mine odds + safest guess when logic runs out",
  description:
    "Runs the full logic, then computes each remaining cell's exact mine probability by enumerating border components and combining them under the global mine budget (outside cells included). Cells at probability 0 or 1 are forced — catching global-count deductions the frontier solvers miss — and the lowest-probability cell is the recommended guess.",
  capabilities: {
    complete: false,
    provesNoGuess: false,
    givesProbabilities: true,
    suggestsGuess: true,
  },
  solve,
};
