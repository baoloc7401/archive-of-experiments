import type { Board, SolveStatus, SolverAction, SolverReport, SolverId } from "./types";
import { neighborTable } from "../grid";

/**
 * Shared solving substrate. Every engine works over the same mutable
 * {@link Knowledge} (revealed cells + pinned mines) and {@link Constraint}
 * extraction, differing only in the deduction engine layered on top.
 */

export interface Knowledge {
  width: number;
  height: number;
  total: number;
  mineCount: number;
  cells: Board["cells"];
  table: number[][];
  /** 1 ⇒ this safe cell has been opened and its number read. */
  revealed: Uint8Array;
  /** 1 ⇒ this cell has been proven to be a mine. */
  mine: Uint8Array;
  revealedCount: number;
  identified: number;
  /** Ordered move log, or null when recording is off (the generator's hot path). */
  actions: SolverAction[] | null;
}

/** A live clue: exactly `mines` of these still-unknown `cells` hold a mine. */
export interface Constraint {
  cells: number[];
  mines: number;
}

/** `track` records the ordered move log (for human-style replay). Leave it off
 *  in the generator's hot loop, where the log would just be allocation churn. */
export function createKnowledge(board: Board, table?: number[][], track = false): Knowledge {
  const total = board.width * board.height;
  return {
    width: board.width,
    height: board.height,
    total,
    mineCount: board.mineCount,
    cells: board.cells,
    table: table ?? neighborTable(board.width, board.height),
    revealed: new Uint8Array(total),
    mine: new Uint8Array(total),
    revealedCount: 0,
    identified: 0,
    actions: track ? [] : null,
  };
}

export function isUnknown(k: Knowledge, i: number): boolean {
  return k.revealed[i] === 0 && k.mine[i] === 0;
}

export function isSolved(k: Knowledge): boolean {
  return k.revealedCount + k.identified === k.total;
}

/** Open a proven-safe cell; a zero cascades to its neighbours, just like a click. */
export function reveal(k: Knowledge, start: number): void {
  if (k.revealed[start] || k.mine[start]) return;
  // Log only the clicked cell; the cascade below is its side effect.
  if (k.actions) k.actions.push({ type: "reveal", cell: start });
  const stack = [start];
  while (stack.length) {
    const i = stack.pop()!;
    if (k.revealed[i] || k.mine[i]) continue;
    k.revealed[i] = 1;
    k.revealedCount++;
    if (k.cells[i].adjacent === 0) {
      for (const n of k.table[i]) if (isUnknown(k, n)) stack.push(n);
    }
  }
}

export function markMine(k: Knowledge, i: number): void {
  if (k.mine[i] || k.revealed[i]) return;
  k.mine[i] = 1;
  k.identified++;
  if (k.actions) k.actions.push({ type: "flag", cell: i });
}

/** All unknown cells. */
export function unknownCells(k: Knowledge): number[] {
  const out: number[] = [];
  for (let i = 0; i < k.total; i++) if (isUnknown(k, i)) out.push(i);
  return out;
}

/** Live constraints from every revealed number that still touches unknown cells. */
export function buildConstraints(k: Knowledge): Constraint[] {
  const out: Constraint[] = [];
  for (let i = 0; i < k.total; i++) {
    if (!k.revealed[i]) continue;
    const num = k.cells[i].adjacent;
    if (num === 0) continue;
    let knownMines = 0;
    const cells: number[] = [];
    for (const n of k.table[i]) {
      if (k.mine[n]) knownMines++;
      else if (isUnknown(k, n)) cells.push(n);
    }
    if (cells.length > 0) out.push({ cells, mines: num - knownMines });
  }
  return out;
}

/* ── Deduction primitives — composed differently by each solver. ──────────── */

/** Rule 1: a number whose hidden neighbours are all mines, or all safe. Runs to
 *  a fixpoint and returns whether anything changed. */
export function singlePointStep(k: Knowledge): boolean {
  let progressed = false;
  let again = true;
  while (again) {
    again = false;
    for (let i = 0; i < k.total; i++) {
      if (!k.revealed[i]) continue;
      const num = k.cells[i].adjacent;
      if (num === 0) continue;
      let knownMines = 0;
      let hidden = 0;
      for (const n of k.table[i]) {
        if (k.mine[n]) knownMines++;
        else if (isUnknown(k, n)) hidden++;
      }
      if (hidden === 0) continue;
      const remaining = num - knownMines;
      if (remaining === 0) {
        for (const n of k.table[i]) if (isUnknown(k, n)) reveal(k, n);
        again = progressed = true;
      } else if (remaining === hidden) {
        for (const n of k.table[i]) if (isUnknown(k, n)) markMine(k, n);
        again = progressed = true;
      }
    }
  }
  return progressed;
}

/** Rule 2: subset elimination. If clue A's cells ⊆ clue B's, the difference
 *  B∖A carries exactly B.mines − A.mines, which may resolve fully. */
export function subsetStep(k: Knowledge, constraints: Constraint[]): boolean {
  let progressed = false;
  const byCell = new Map<number, number[]>();
  constraints.forEach((c, ci) => {
    for (const v of c.cells) {
      const list = byCell.get(v);
      if (list) list.push(ci);
      else byCell.set(v, [ci]);
    }
  });

  for (let ai = 0; ai < constraints.length; ai++) {
    const A = constraints[ai];
    const setA = new Set(A.cells);
    const seen = new Set<number>();
    for (const v of A.cells) {
      for (const bi of byCell.get(v) ?? []) {
        if (bi === ai || seen.has(bi)) continue;
        seen.add(bi);
        const B = constraints[bi];
        if (B.cells.length <= A.cells.length) continue;
        let subset = true;
        for (const x of A.cells) {
          if (!B.cells.includes(x)) {
            subset = false;
            break;
          }
        }
        if (!subset) continue;
        const diff = B.cells.filter((x) => !setA.has(x));
        const diffMines = B.mines - A.mines;
        if (diffMines === 0) {
          for (const x of diff) if (isUnknown(k, x)) reveal(k, x);
          progressed = true;
        } else if (diffMines === diff.length) {
          for (const x of diff) if (isUnknown(k, x)) markMine(k, x);
          progressed = true;
        }
      }
    }
  }
  return progressed;
}

/** Connected components of constraints joined by shared cells. */
export function components(constraints: Constraint[]): { cells: number[]; cons: Constraint[] }[] {
  const parent = constraints.map((_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const byCell = new Map<number, number>();
  constraints.forEach((c, ci) => {
    for (const v of c.cells) {
      const prev = byCell.get(v);
      if (prev === undefined) byCell.set(v, ci);
      else parent[find(prev)] = find(ci);
    }
  });
  const groups = new Map<number, number[]>();
  constraints.forEach((_, ci) => {
    const r = find(ci);
    const g = groups.get(r);
    if (g) g.push(ci);
    else groups.set(r, [ci]);
  });
  return [...groups.values()].map((ids) => {
    const cons = ids.map((ci) => constraints[ci]);
    const cells = [...new Set(cons.flatMap((c) => c.cells))];
    return { cells, cons };
  });
}

export interface EnumResult {
  /** Per-cell count of solutions in which it was a mine, aligned with `cells`. */
  mineHits: number[];
  /** Total satisfying assignments. */
  solutions: number;
  /** Solutions grouped by total mine count — used for global probability. */
  byMineCount: Map<number, number>;
}

/** Enumerate every assignment a set of cells/constraints permits (backtracking
 *  with incremental feasibility pruning). Returns null if it blows the node cap. */
export function enumerate(
  cells: number[],
  constraints: Constraint[],
  nodeCap: number,
): EnumResult | null {
  const pos = new Map<number, number>();
  cells.forEach((v, k) => pos.set(v, k));
  const cVars = constraints.map((c) => c.cells.map((v) => pos.get(v)!).filter((p) => p !== undefined));
  const cNeed = constraints.map((c) => c.mines);
  const cell2cons: number[][] = cells.map(() => []);
  cVars.forEach((vs, ci) => vs.forEach((p) => cell2cons[p].push(ci)));

  const assignedMines = new Int32Array(constraints.length);
  const unassigned = Int32Array.from(cVars.map((vs) => vs.length));
  const mineHits = new Array(cells.length).fill(0);
  const assign = new Int8Array(cells.length).fill(-1);
  const byMineCount = new Map<number, number>();
  let solutions = 0;
  let nodes = 0;
  let blewCap = false;

  function recurse(idx: number, mineTally: number) {
    if (blewCap) return;
    if (++nodes > nodeCap) {
      blewCap = true;
      return;
    }
    if (idx === cells.length) {
      solutions++;
      byMineCount.set(mineTally, (byMineCount.get(mineTally) ?? 0) + 1);
      for (let p = 0; p < cells.length; p++) if (assign[p] === 1) mineHits[p]++;
      return;
    }
    for (let val = 0; val <= 1; val++) {
      assign[idx] = val;
      let feasible = true;
      for (const ci of cell2cons[idx]) {
        unassigned[ci]--;
        if (val === 1) assignedMines[ci]++;
        if (assignedMines[ci] > cNeed[ci] || assignedMines[ci] + unassigned[ci] < cNeed[ci]) {
          feasible = false;
        }
      }
      if (feasible) recurse(idx + 1, mineTally + val);
      for (const ci of cell2cons[idx]) {
        unassigned[ci]++;
        if (val === 1) assignedMines[ci]--;
      }
      if (blewCap) return;
    }
    assign[idx] = -1;
  }
  recurse(0, 0);
  if (blewCap || solutions === 0) return null;
  return { mineHits, solutions, byMineCount };
}

/** A cell fixed across every enumerated solution resolves. */
export function applyForced(k: Knowledge, cells: number[], res: EnumResult): boolean {
  let progressed = false;
  for (let p = 0; p < cells.length; p++) {
    if (!isUnknown(k, cells[p])) continue;
    if (res.mineHits[p] === res.solutions) {
      markMine(k, cells[p]);
      progressed = true;
    } else if (res.mineHits[p] === 0) {
      reveal(k, cells[p]);
      progressed = true;
    }
  }
  return progressed;
}

export interface FullTechniques {
  count: number;
  subset: number;
  enumerate: number;
}

/**
 * The complete deduction pipeline, run to a fixpoint: count rules → subset
 * elimination → per-component enumeration → endgame global-count enumeration.
 * This is the engine behind the backtracking solver, the probabilistic solver's
 * logic phase, and the field generator's no-guess check. Returns rounds run.
 */
export function fullPropagate(
  k: Knowledge,
  enumLimit: number,
  nodeCap: number,
  tech: FullTechniques,
): number {
  let steps = 0;
  for (;;) {
    if (singlePointStep(k)) {
      tech.count++;
      steps++;
      continue;
    }
    const constraints = buildConstraints(k);
    if (constraints.length === 0) break;
    if (subsetStep(k, constraints)) {
      tech.subset++;
      steps++;
      continue;
    }
    let progressed = false;
    for (const comp of components(constraints)) {
      if (comp.cells.length > enumLimit) continue;
      const res = enumerate(comp.cells, comp.cons, nodeCap);
      if (res && applyForced(k, comp.cells, res)) progressed = true;
    }
    if (progressed) {
      tech.enumerate++;
      steps++;
      continue;
    }
    const unknown = unknownCells(k);
    if (unknown.length > 0 && unknown.length <= enumLimit) {
      const global: Constraint = { cells: unknown, mines: k.mineCount - k.identified };
      const res = enumerate(unknown, [...constraints, global], nodeCap);
      if (res && applyForced(k, unknown, res)) {
        tech.enumerate++;
        steps++;
        continue;
      }
    }
    break;
  }
  return steps;
}

/** Assemble the normalized report from final knowledge. */
export function report(
  k: Knowledge,
  solverId: SolverId,
  techniques: Record<string, number>,
  steps: number,
  ms: number,
  extra: { probabilities?: Map<number, number> | null; bestGuess?: number | null } = {},
): SolverReport {
  const safe: number[] = [];
  const mines: number[] = [];
  const undecided: number[] = [];
  for (let i = 0; i < k.total; i++) {
    if (k.revealed[i]) safe.push(i);
    else if (k.mine[i]) mines.push(i);
    else undecided.push(i);
  }
  const status: SolveStatus = isSolved(k) ? "solved" : "stuck";
  return {
    solverId,
    status,
    safe,
    mines,
    undecided,
    revealedCount: k.revealedCount,
    identifiedCount: k.identified,
    total: k.total,
    probabilities: extra.probabilities ?? null,
    bestGuess: extra.bestGuess ?? null,
    actions: k.actions ?? [],
    techniques,
    steps,
    ms,
  };
}

/** Monotonic clock that survives non-browser (test) environments. */
export function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}
