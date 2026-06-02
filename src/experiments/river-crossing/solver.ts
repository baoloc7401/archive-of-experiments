import type {
  Config,
  Load,
  Move,
  PuzzleState,
  SearchAlgo,
  SearchResult,
  Side,
} from "./types";

export function other(side: Side): Side {
  return side === "L" ? "R" : "L";
}

export function rightBank(cfg: Config, s: PuzzleState): { m: number; c: number } {
  return { m: cfg.m - s.ml, c: cfg.c - s.cl };
}

/**
 * A state is legal when, on each bank, cannibals never outnumber missionaries
 * *while missionaries are present*. An all-cannibal bank is always fine.
 */
export function isValid(cfg: Config, s: PuzzleState): boolean {
  const { ml, cl } = s;
  if (ml < 0 || cl < 0 || ml > cfg.m || cl > cfg.c) return false;
  const mr = cfg.m - ml;
  const cr = cfg.c - cl;
  if (ml > 0 && cl > ml) return false;
  if (mr > 0 && cr > mr) return false;
  return true;
}

export function isGoal(s: PuzzleState): boolean {
  return s.ml === 0 && s.cl === 0 && s.boat === "R";
}

export function stateKey(s: PuzzleState): string {
  return `${s.ml},${s.cl},${s.boat}`;
}

export function startState(cfg: Config): PuzzleState {
  return { ml: cfg.m, cl: cfg.c, boat: "L" };
}

/** Every passenger combination the boat could carry: 1..k people total. */
export function boatLoads(k: number): Load[] {
  const out: Load[] = [];
  for (let m = 0; m <= k; m++) {
    for (let c = 0; c <= k; c++) {
      const total = m + c;
      if (total >= 1 && total <= k) out.push({ m, c });
    }
  }
  return out;
}

/**
 * Move `load` people off the docked bank and across. Ignores the safety rule —
 * used for the manual game where an illegal crossing is allowed (and promptly
 * declared a loss). Boarding already keeps the load within the docked bank's
 * supply, so counts stay in bounds.
 */
export function rawApply(cfg: Config, s: PuzzleState, load: Load): PuzzleState {
  const sign = s.boat === "L" ? -1 : 1;
  return {
    ml: s.ml + sign * load.m,
    cl: s.cl + sign * load.c,
    boat: other(s.boat),
  };
}

/** Legal successors only: in bounds, enough passengers, resulting state valid. */
export function successors(
  cfg: Config,
  s: PuzzleState
): { state: PuzzleState; move: Move }[] {
  const res: { state: PuzzleState; move: Move }[] = [];
  for (const load of boatLoads(cfg.k)) {
    const next = rawApply(cfg, s, load);
    if (next.ml < 0 || next.cl < 0 || next.ml > cfg.m || next.cl > cfg.c) continue;
    if (!isValid(cfg, next)) continue;
    res.push({ state: next, move: { m: load.m, c: load.c, from: s.boat } });
  }
  return res;
}

/**
 * Admissible lower bound on remaining crossings: everyone still on the left
 * bank must be ferried over, and a single trip carries at most `k` people, so
 * at least `ceil(peopleLeft / k)` forward crossings remain. Never overestimates,
 * so A* stays optimal.
 */
function heuristic(cfg: Config, s: PuzzleState): number {
  return Math.ceil((s.ml + s.cl) / cfg.k);
}

interface Came {
  parent: PuzzleState;
  move: Move;
}

function reconstruct(
  came: Map<string, Came>,
  goal: PuzzleState
): { path: PuzzleState[]; moves: Move[] } {
  const path: PuzzleState[] = [];
  const moves: Move[] = [];
  let cur: PuzzleState | undefined = goal;
  while (cur) {
    path.push(cur);
    const c: Came | undefined = came.get(stateKey(cur));
    if (!c) break;
    moves.push(c.move);
    cur = c.parent;
  }
  path.reverse();
  moves.reverse();
  return { path, moves };
}

function unsolved(
  start: PuzzleState,
  expanded: number,
  discovered: number,
  frontierPeak: number
): SearchResult {
  return { solvable: false, path: [start], moves: [], expanded, discovered, frontierPeak };
}

/**
 * Search the state space from `from` to the goal. BFS guarantees the fewest
 * crossings; DFS returns any solution; A* is guided by `heuristic`. Returns the
 * path, the moves, and search-cost telemetry for the panel.
 */
export function solveFrom(
  cfg: Config,
  from: PuzzleState,
  algo: SearchAlgo
): SearchResult {
  if (isGoal(from)) {
    return { solvable: true, path: [from], moves: [], expanded: 0, discovered: 1, frontierPeak: 1 };
  }

  const came = new Map<string, Came>();
  const discovered = new Set<string>([stateKey(from)]);
  let expanded = 0;
  let frontierPeak = 1;

  if (algo === "astar") {
    // tiny state space → a linear-scan priority queue is plenty.
    const g = new Map<string, number>([[stateKey(from), 0]]);
    const open: { state: PuzzleState; f: number }[] = [
      { state: from, f: heuristic(cfg, from) },
    ];
    while (open.length) {
      frontierPeak = Math.max(frontierPeak, open.length);
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
      const { state: s } = open.splice(bi, 1)[0];
      expanded++;
      if (isGoal(s)) {
        const { path, moves } = reconstruct(came, s);
        return { solvable: true, path, moves, expanded, discovered: discovered.size, frontierPeak };
      }
      const gs = g.get(stateKey(s)) ?? 0;
      for (const { state: ns, move } of successors(cfg, s)) {
        const nk = stateKey(ns);
        const tentative = gs + 1;
        if (tentative < (g.get(nk) ?? Infinity)) {
          g.set(nk, tentative);
          came.set(nk, { parent: s, move });
          discovered.add(nk);
          open.push({ state: ns, f: tentative + heuristic(cfg, ns) });
        }
      }
    }
    return unsolved(from, expanded, discovered.size, frontierPeak);
  }

  // BFS (queue) and DFS (stack) share everything but the frontier discipline.
  const frontier: PuzzleState[] = [from];
  let head = 0; // queue read cursor for BFS
  while (head < frontier.length) {
    const s = algo === "dfs" ? frontier.pop()! : frontier[head++];
    expanded++;
    if (isGoal(s)) {
      const { path, moves } = reconstruct(came, s);
      return { solvable: true, path, moves, expanded, discovered: discovered.size, frontierPeak };
    }
    for (const { state: ns, move } of successors(cfg, s)) {
      const nk = stateKey(ns);
      if (discovered.has(nk)) continue;
      discovered.add(nk);
      came.set(nk, { parent: s, move });
      frontier.push(ns);
    }
    const size = algo === "dfs" ? frontier.length : frontier.length - head;
    frontierPeak = Math.max(frontierPeak, size);
  }
  return unsolved(from, expanded, discovered.size, frontierPeak);
}

export function loadLabel(load: Load): string {
  const parts: string[] = [];
  if (load.m) parts.push(`${load.m}M`);
  if (load.c) parts.push(`${load.c}C`);
  return parts.join("+") || "—";
}

export function moveArrow(from: Side): string {
  return from === "L" ? "→" : "←";
}
