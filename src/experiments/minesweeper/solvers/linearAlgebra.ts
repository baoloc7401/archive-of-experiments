import type { Board, Solver, SolverReport } from "./types";
import {
  buildConstraints,
  createKnowledge,
  isUnknown,
  type Knowledge,
  markMine,
  now,
  reveal,
  report,
  singlePointStep,
} from "./core";

/**
 * Each clue is a linear equation Σ xᵢ = m over mine indicators xᵢ ∈ {0,1}.
 * Row-reducing the system A·x = b to echelon form exposes deductions no single
 * pair of clues shows. Each reduced row is pinned by a bound argument: with every
 * xᵢ in [0,1], if the RHS equals the row's max (sum of positive coefficients),
 * every positive-coef cell is a mine and every negative-coef cell is safe, and
 * symmetrically at the min. A different, polynomial lens than subset elimination,
 * but the linear relaxation can't always settle integrality, so it's incomplete.
 */

interface Frac {
  n: number;
  d: number;
}

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}
function frac(n: number, d = 1): Frac {
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}
const ZERO: Frac = { n: 0, d: 1 };
const add = (a: Frac, b: Frac): Frac => frac(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a: Frac, b: Frac): Frac => frac(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a: Frac, b: Frac): Frac => frac(a.n * b.n, a.d * b.d);
const div = (a: Frac, b: Frac): Frac => frac(a.n * b.d, a.d * b.n);
const isZero = (a: Frac): boolean => a.n === 0;
const eq = (a: Frac, b: Frac): boolean => a.n * b.d === b.n * a.d;
const isPos = (a: Frac): boolean => a.n > 0;
const isNeg = (a: Frac): boolean => a.n < 0;

interface Row {
  coef: Frac[];
  rhs: Frac;
}

/** Reduce the system to row-echelon form in place. */
function rowReduce(rows: Row[], nVars: number): void {
  let pivotRow = 0;
  for (let col = 0; col < nVars && pivotRow < rows.length; col++) {
    let sel = -1;
    for (let r = pivotRow; r < rows.length; r++) {
      if (!isZero(rows[r].coef[col])) {
        sel = r;
        break;
      }
    }
    if (sel === -1) continue;
    [rows[pivotRow], rows[sel]] = [rows[sel], rows[pivotRow]];
    const pivot = rows[pivotRow];
    const inv = pivot.coef[col];
    for (let c = 0; c < nVars; c++) pivot.coef[c] = div(pivot.coef[c], inv);
    pivot.rhs = div(pivot.rhs, inv);
    for (let r = 0; r < rows.length; r++) {
      if (r === pivotRow || isZero(rows[r].coef[col])) continue;
      const factor = rows[r].coef[col];
      for (let c = 0; c < nVars; c++) rows[r].coef[c] = sub(rows[r].coef[c], mul(factor, pivot.coef[c]));
      rows[r].rhs = sub(rows[r].rhs, mul(factor, pivot.rhs));
    }
    pivotRow++;
  }
}

/** Bound argument on each reduced row → forced cells. Returns whether it changed. */
function deduceFromRows(k: Knowledge, rows: Row[], vars: number[]): boolean {
  let progressed = false;
  for (const row of rows) {
    let upper = ZERO;
    let lower = ZERO;
    let nonzero = 0;
    for (const c of row.coef) {
      if (isPos(c)) upper = add(upper, c);
      else if (isNeg(c)) lower = add(lower, c);
      if (!isZero(c)) nonzero++;
    }
    if (nonzero === 0) continue;
    const atMax = eq(row.rhs, upper);
    const atMin = eq(row.rhs, lower);
    if (!atMax && !atMin) continue;
    for (let j = 0; j < row.coef.length; j++) {
      const c = row.coef[j];
      if (isZero(c)) continue;
      // atMax: +coef ⇒ mine, −coef ⇒ safe. atMin: the reverse.
      const isMine = atMax ? isPos(c) : isNeg(c);
      const cell = vars[j];
      if (!isUnknown(k, cell)) continue;
      if (isMine) markMine(k, cell);
      else reveal(k, cell);
      progressed = true;
    }
  }
  return progressed;
}

function solve(board: Board, origin: number): SolverReport {
  const t0 = now();
  const k = createKnowledge(board, undefined, true);
  reveal(k, origin);
  const techniques = { count: 0, linear: 0 };
  let steps = 0;

  for (;;) {
    if (singlePointStep(k)) {
      techniques.count++;
      steps++;
      continue;
    }
    const constraints = buildConstraints(k);
    if (constraints.length === 0) break;
    const vars = [...new Set(constraints.flatMap((c) => c.cells))];
    const posOf = new Map(vars.map((v, i) => [v, i]));
    const rows: Row[] = constraints.map((c) => {
      const coef: Frac[] = vars.map(() => ZERO);
      for (const cell of c.cells) coef[posOf.get(cell)!] = frac(1);
      return { coef, rhs: frac(c.mines) };
    });
    rowReduce(rows, vars.length);
    if (deduceFromRows(k, rows, vars)) {
      techniques.linear++;
      steps++;
      continue;
    }
    break;
  }

  return report(k, "linear-algebra", techniques, steps, now() - t0);
}

export const linearAlgebraSolver: Solver = {
  id: "linear-algebra",
  name: "Linear Algebra",
  tagline: "Gaussian elimination on the clue matrix",
  description:
    "Treats the clues as a linear system A·x = b over {0,1} mine indicators and row-reduces it. Each reduced row is a new combination of clues; a min/max bound argument then pins cells that no single subset comparison would reveal. Polynomial, but the linear relaxation alone can't always decide every cell.",
  capabilities: {
    complete: false,
    provesNoGuess: false,
    givesProbabilities: false,
    suggestsGuess: false,
  },
  solve,
};
