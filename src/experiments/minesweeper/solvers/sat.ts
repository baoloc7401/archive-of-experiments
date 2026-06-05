import type { Board, SolveOptions, Solver, SolverReport } from "./types";
import { ENUM_LIMIT, ENUM_NODE_CAP } from "../constants";
import {
  buildConstraints,
  type Constraint,
  createKnowledge,
  isUnknown,
  markMine,
  now,
  reveal,
  report,
  singlePointStep,
  unknownCells,
} from "./core";

/**
 * A CSP/SAT-style prover. Each clue is an exact-cardinality constraint; instead
 * of counting models like the backtracking solver, this asks satisfiability
 * questions via DPLL with feasibility propagation:
 *   - "cell c is a mine" UNSAT  → c is safe;
 *   - "cell c is safe"  UNSAT  → c is a mine.
 * A cell it can neither place nor clear is genuinely ambiguous (a guess). The
 * endgame folds in the global mine budget.
 */

interface CSP {
  count: number;
  cVars: number[][]; // constraint → cell positions
  cNeed: number[];
  cell2cons: number[][]; // cell position → constraint ids
}

function buildCSP(cells: number[], constraints: Constraint[]): CSP {
  const pos = new Map<number, number>();
  cells.forEach((v, k) => pos.set(v, k));
  const cVars = constraints.map((c) => c.cells.map((v) => pos.get(v)!).filter((p) => p !== undefined));
  const cNeed = constraints.map((c) => c.mines);
  const cell2cons: number[][] = cells.map(() => []);
  cVars.forEach((vs, ci) => vs.forEach((p) => cell2cons[p].push(ci)));
  return { count: cells.length, cVars, cNeed, cell2cons };
}

/** Does a satisfying assignment exist with `cells[forcedPos] = forcedVal`?
 *  DPLL: branch + prune by per-constraint mine bounds. On hitting the node cap we
 *  return `true` (assume satisfiable) so the prover never *over*-claims a forced
 *  cell — it just stays conservatively incomplete. */
function exists(csp: CSP, forcedPos: number, forcedVal: number, nodeCap: number): boolean {
  const { count, cVars, cNeed, cell2cons } = csp;
  const assign = new Int8Array(count).fill(-1);
  const assignedMines = new Int32Array(cNeed.length);
  const unassigned = Int32Array.from(cVars.map((vs) => vs.length));
  let nodes = 0;
  let capped = false;

  function set(p: number, val: number): boolean {
    assign[p] = val;
    let feasible = true;
    for (const ci of cell2cons[p]) {
      unassigned[ci]--;
      if (val === 1) assignedMines[ci]++;
      if (assignedMines[ci] > cNeed[ci] || assignedMines[ci] + unassigned[ci] < cNeed[ci]) feasible = false;
    }
    return feasible;
  }
  function unset(p: number, val: number): void {
    for (const ci of cell2cons[p]) {
      unassigned[ci]++;
      if (val === 1) assignedMines[ci]--;
    }
    assign[p] = -1;
  }

  function search(idx: number): boolean {
    if (capped) return true;
    if (++nodes > nodeCap) {
      capped = true;
      return true;
    }
    if (idx === count) return true;
    if (assign[idx] !== -1) return search(idx + 1);
    for (let val = 1; val >= 0; val--) {
      if (set(idx, val)) {
        if (search(idx + 1)) return true;
      }
      unset(idx, val);
    }
    return false;
  }

  if (!set(forcedPos, forcedVal)) return false;
  return search(0);
}

function solve(board: Board, origin: number, opts: SolveOptions = {}): SolverReport {
  const enumLimit = opts.enumLimit ?? ENUM_LIMIT;
  const nodeCap = opts.nodeCap ?? ENUM_NODE_CAP;
  const t0 = now();
  const k = createKnowledge(board, undefined, true);
  reveal(k, origin);
  const techniques = { count: 0, sat: 0 };
  let steps = 0;

  for (;;) {
    if (singlePointStep(k)) {
      techniques.count++;
      steps++;
      continue;
    }
    const constraints = buildConstraints(k);
    if (constraints.length === 0) break;

    // Scope: in the endgame fold in the global budget over the whole remaining
    // pool; otherwise prove over the border cells the clues actually touch.
    const unknown = unknownCells(k);
    let cells: number[];
    let cons: Constraint[];
    if (unknown.length <= enumLimit) {
      cells = unknown;
      cons = [...constraints, { cells: unknown, mines: k.mineCount - k.identified }];
    } else {
      cells = [...new Set(constraints.flatMap((c) => c.cells))];
      cons = constraints;
    }

    const csp = buildCSP(cells, cons);
    let progressed = false;
    for (let p = 0; p < cells.length; p++) {
      if (!isUnknown(k, cells[p])) continue;
      const canMine = exists(csp, p, 1, nodeCap);
      const canSafe = exists(csp, p, 0, nodeCap);
      if (canMine && !canSafe) {
        markMine(k, cells[p]);
        progressed = true;
      } else if (canSafe && !canMine) {
        reveal(k, cells[p]);
        progressed = true;
      }
    }
    if (progressed) {
      techniques.sat++;
      steps++;
      continue;
    }
    break;
  }

  return report(k, "sat", techniques, steps, now() - t0);
}

export const satSolver: Solver = {
  id: "sat",
  name: "SAT / CSP",
  tagline: "DPLL satisfiability — formal proof of no ambiguity",
  description:
    "Models the board as exact-cardinality constraints and runs DPLL satisfiability checks: a cell is forced exactly when the opposite assignment is unsatisfiable. Slower than counting, but it yields a formal certificate that a position is — or isn't — solvable without guessing.",
  capabilities: {
    complete: true,
    provesNoGuess: true,
    givesProbabilities: false,
    suggestsGuess: false,
  },
  solve,
};
