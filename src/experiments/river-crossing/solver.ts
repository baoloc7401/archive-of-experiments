import type {
  Config,
  Load,
  Move,
  PuzzleState,
  SearchAlgo,
  SearchResult,
  SearchStep,
  Side,
  StateGraph,
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
 * Move `load` people off the docked bank and across. Ignores the safety rule -
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
 * so A* (and greedy's guidance) stays sound.
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

function parseKey(k: string): PuzzleState {
  const [ml, cl, boat] = k.split(",");
  return { ml: Number(ml), cl: Number(cl), boat: boat as Side };
}

function pathCost(moves: Move[], edgeCost: (mv: Move) => number): number {
  return moves.reduce((sum, mv) => sum + edgeCost(mv), 0);
}

function unsolved(
  start: PuzzleState,
  expanded: number,
  discovered: number,
  frontierPeak: number
): SearchResult {
  return { solvable: false, path: [start], moves: [], expanded, discovered, frontierPeak, cost: 0 };
}

// ── edge cost / heuristic kits per algorithm ─────────────────────────────────
const unitCost = () => 1;
const peopleCost = (mv: Move) => mv.m + mv.c;
const zeroH = () => 0;

interface OpenNode {
  state: PuzzleState;
  g: number;
  prio: number;
}

interface FrontierOpts {
  /** index of the next node to pull off `open` (FIFO/LIFO/least-priority) */
  pick: (open: OpenNode[]) => number;
  /** true → A-star / Dijkstra `g`-relaxation; false → discover-once graph search */
  relax: boolean;
  edgeCost: (mv: Move) => number;
  h: (s: PuzzleState) => number;
}

function argminPrio(open: OpenNode[]): number {
  let bi = 0;
  for (let i = 1; i < open.length; i++) if (open[i].prio < open[bi].prio) bi = i;
  return bi;
}

function frontierOpts(cfg: Config, algo: SearchAlgo): FrontierOpts {
  switch (algo) {
    case "dfs":
      return { pick: (o) => o.length - 1, relax: false, edgeCost: unitCost, h: zeroH };
    case "greedy":
      return { pick: argminPrio, relax: false, edgeCost: unitCost, h: (s) => heuristic(cfg, s) };
    case "astar":
      return { pick: argminPrio, relax: true, edgeCost: unitCost, h: (s) => heuristic(cfg, s) };
    case "ucs":
      return { pick: argminPrio, relax: true, edgeCost: peopleCost, h: zeroH };
    case "bfs":
    default:
      return { pick: () => 0, relax: false, edgeCost: unitCost, h: zeroH };
  }
}

function snapshot(
  expandedState: PuzzleState | null,
  discovered: Set<string>,
  closed: Set<string>,
  expandedCount: number,
  frontierPeak: number,
  limit?: number
): SearchStep {
  const frontier: string[] = [];
  for (const k of discovered) if (!closed.has(k)) frontier.push(k);
  return {
    expanded: expandedState,
    frontier,
    closed: [...closed],
    discovered: [...discovered],
    expandedCount,
    frontierPeak,
    limit,
  };
}

/**
 * The single-frontier searches (BFS / DFS / greedy / A* / UCS) as one generator,
 * yielding a snapshot after every expansion. They differ only in `frontierOpts`:
 * which node comes off next, whether `g` is relaxed, and the edge cost / heuristic.
 */
function* frontierSearch(
  cfg: Config,
  from: PuzzleState,
  algo: SearchAlgo
): Generator<SearchStep, SearchResult> {
  const o = frontierOpts(cfg, algo);
  const open: OpenNode[] = [{ state: from, g: 0, prio: o.h(from) }];
  const gScore = new Map<string, number>([[stateKey(from), 0]]);
  const discovered = new Set<string>([stateKey(from)]);
  const closed = new Set<string>();
  const came = new Map<string, Came>();
  let expanded = 0;
  let frontierPeak = 1;

  yield snapshot(null, discovered, closed, expanded, frontierPeak);

  while (open.length) {
    frontierPeak = Math.max(frontierPeak, open.length);
    const node = open.splice(o.pick(open), 1)[0];
    const sk = stateKey(node.state);
    if (closed.has(sk)) continue; // stale duplicate left by a relaxation
    expanded++;
    closed.add(sk);

    if (isGoal(node.state)) {
      const { path, moves } = reconstruct(came, node.state);
      yield snapshot(node.state, discovered, closed, expanded, frontierPeak);
      return {
        solvable: true,
        path,
        moves,
        expanded,
        discovered: discovered.size,
        frontierPeak,
        cost: pathCost(moves, o.edgeCost),
      };
    }

    for (const { state: ns, move } of successors(cfg, node.state)) {
      const nk = stateKey(ns);
      if (o.relax) {
        const tentative = node.g + o.edgeCost(move);
        if (tentative < (gScore.get(nk) ?? Infinity)) {
          gScore.set(nk, tentative);
          came.set(nk, { parent: node.state, move });
          discovered.add(nk);
          open.push({ state: ns, g: tentative, prio: tentative + o.h(ns) });
        }
      } else if (!discovered.has(nk)) {
        discovered.add(nk);
        came.set(nk, { parent: node.state, move });
        open.push({ state: ns, g: node.g + o.edgeCost(move), prio: o.h(ns) });
      }
    }
    yield snapshot(node.state, discovered, closed, expanded, frontierPeak);
  }
  return unsolved(from, expanded, discovered.size, frontierPeak);
}

/** Count the states reachable from `from` - bounds how deep IDDFS ever needs to go. */
function floodCount(cfg: Config, from: PuzzleState): number {
  const seen = new Set<string>([stateKey(from)]);
  const q: PuzzleState[] = [from];
  let h = 0;
  while (h < q.length) {
    for (const { state: ns } of successors(cfg, q[h++])) {
      const k = stateKey(ns);
      if (!seen.has(k)) {
        seen.add(k);
        q.push(ns);
      }
    }
  }
  return seen.size;
}

/**
 * Iterative-deepening DFS: depth-limited DFS in a loop with a rising limit, so
 * the first limit that reaches the goal yields a BFS-optimal depth while holding
 * only the current path in memory. Within each iteration a state is (re)expanded
 * only when reached at a strictly *shallower* depth (`seenDepth`) - this keeps
 * the shortest route open (preserving optimality) while preventing the
 * exponential re-enumeration of paths that a pure per-path cycle check suffers on
 * a graph this cyclic. The limit is capped at the reachable-node count.
 */
function* iddfsSteps(cfg: Config, from: PuzzleState): Generator<SearchStep, SearchResult> {
  const limitMax = floodCount(cfg, from);
  let expanded = 0;
  let frontierPeak = 1;
  let lastDiscovered = 1;

  for (let limit = 0; limit <= limitMax; limit++) {
    const came = new Map<string, Came>();
    const seenDepth = new Map<string, number>([[stateKey(from), 0]]);
    const discovered = new Set<string>([stateKey(from)]);
    const closed = new Set<string>([stateKey(from)]);
    const pathKeys: string[] = [stateKey(from)];
    interface Frame {
      state: PuzzleState;
      depth: number;
      succ: { state: PuzzleState; move: Move }[];
      i: number;
    }
    const stack: Frame[] = [{ state: from, depth: 0, succ: successors(cfg, from), i: 0 }];
    expanded++;
    yield snapshotPath(from, pathKeys, discovered, closed, expanded, frontierPeak, limit);

    while (stack.length) {
      const top = stack[stack.length - 1];
      if (top.depth >= limit || top.i >= top.succ.length) {
        stack.pop();
        pathKeys.pop();
        continue;
      }
      const { state: ns, move } = top.succ[top.i++];
      const nk = stateKey(ns);
      const childDepth = top.depth + 1;
      const prev = seenDepth.get(nk);
      if (prev !== undefined && prev <= childDepth) continue; // no equal/deeper revisit
      seenDepth.set(nk, childDepth);
      discovered.add(nk);
      closed.add(nk);
      came.set(nk, { parent: top.state, move });
      expanded++;
      stack.push({ state: ns, depth: childDepth, succ: successors(cfg, ns), i: 0 });
      pathKeys.push(nk);
      frontierPeak = Math.max(frontierPeak, stack.length);

      if (isGoal(ns)) {
        const { path, moves } = reconstruct(came, ns);
        yield snapshotPath(ns, pathKeys, discovered, closed, expanded, frontierPeak, limit);
        return {
          solvable: true,
          path,
          moves,
          expanded,
          discovered: discovered.size,
          frontierPeak,
          cost: moves.length,
        };
      }
      yield snapshotPath(ns, pathKeys, discovered, closed, expanded, frontierPeak, limit);
    }
    lastDiscovered = discovered.size;
  }
  return unsolved(from, expanded, lastDiscovered, frontierPeak);
}

/** IDDFS snapshot - the "frontier" is the active DFS path (the recursion stack). */
function snapshotPath(
  expandedState: PuzzleState,
  pathKeys: string[],
  discovered: Set<string>,
  closed: Set<string>,
  expandedCount: number,
  frontierPeak: number,
  limit: number
): SearchStep {
  return {
    expanded: expandedState,
    frontier: [...pathKeys],
    closed: [...closed],
    discovered: [...discovered],
    expandedCount,
    frontierPeak,
    limit,
  };
}

function reverseMove(mv: Move): Move {
  return { m: mv.m, c: mv.c, from: other(mv.from) };
}

/** Stitch the forward (start→meet) and backward (meet→goal) halves into one path. */
function assembleBidir(
  cameF: Map<string, Came>,
  cameB: Map<string, Came>,
  meetKey: string
): { path: PuzzleState[]; moves: Move[] } {
  const fwd = reconstruct(cameF, parseKey(meetKey));
  const path = [...fwd.path];
  const moves = [...fwd.moves];
  let curKey = meetKey;
  // cameB stores backward edges (closer-to-goal → child); reverse them to walk
  // forward from the meeting node out to the goal.
  while (cameB.has(curKey)) {
    const c = cameB.get(curKey)!;
    moves.push(reverseMove(c.move));
    path.push(c.parent);
    curKey = stateKey(c.parent);
  }
  return { path, moves };
}

/**
 * Bidirectional BFS: grow a frontier forward from the start and another backward
 * from the goal (the graph is undirected - any crossing can be rowed back), and
 * stop when they touch. Expanding the smaller frontier each round, with the
 * `best ≤ depthF + depthB` cutoff, keeps it shortest while exploring a fraction
 * of what a single BFS would.
 */
function* bidirSteps(cfg: Config, from: PuzzleState): Generator<SearchStep, SearchResult> {
  const goal: PuzzleState = { ml: 0, cl: 0, boat: "R" };
  const distF = new Map<string, number>([[stateKey(from), 0]]);
  const distB = new Map<string, number>([[stateKey(goal), 0]]);
  const cameF = new Map<string, Came>();
  const cameB = new Map<string, Came>();
  let frontierF: PuzzleState[] = [from];
  let frontierB: PuzzleState[] = [goal];
  let depthF = 0;
  let depthB = 0;
  let expanded = 0;
  let frontierPeak = 2;
  let best = Infinity;
  let meet: string | null = null;
  const discovered = new Set<string>([stateKey(from), stateKey(goal)]);
  const closed = new Set<string>();

  // If the goal itself is illegal (cannibals outnumber missionaries once everyone
  // is across - i.e. C > M), it can never be legally occupied. Edges *out of* it
  // aren't real reverse edges, so a backward search would falsely connect; bail.
  if (!isValid(cfg, goal)) {
    yield snapshot(null, discovered, closed, expanded, frontierPeak);
    return unsolved(from, expanded, discovered.size, frontierPeak);
  }

  const rescan = () => {
    for (const [k, df] of distF) {
      const db = distB.get(k);
      if (db !== undefined && df + db < best) {
        best = df + db;
        meet = k;
      }
    }
  };

  yield snapshot(null, discovered, closed, expanded, frontierPeak);

  while (frontierF.length && frontierB.length && best > depthF + depthB) {
    const fwd = frontierF.length <= frontierB.length;
    const frontier = fwd ? frontierF : frontierB;
    const dist = fwd ? distF : distB;
    const came = fwd ? cameF : cameB;
    const next: PuzzleState[] = [];
    for (const s of frontier) {
      expanded++;
      closed.add(stateKey(s));
      const ds = dist.get(stateKey(s))!;
      for (const { state: ns, move } of successors(cfg, s)) {
        const nk = stateKey(ns);
        if (!dist.has(nk)) {
          dist.set(nk, ds + 1);
          came.set(nk, { parent: s, move });
          discovered.add(nk);
          next.push(ns);
        }
      }
      frontierPeak = Math.max(frontierPeak, frontierF.length + frontierB.length);
      yield snapshot(s, discovered, closed, expanded, frontierPeak);
    }
    if (fwd) {
      frontierF = next;
      depthF++;
    } else {
      frontierB = next;
      depthB++;
    }
    rescan();
  }

  if (meet) {
    const { path, moves } = assembleBidir(cameF, cameB, meet);
    yield snapshot(parseKey(meet), discovered, closed, expanded, frontierPeak);
    return {
      solvable: true,
      path,
      moves,
      expanded,
      discovered: discovered.size,
      frontierPeak,
      cost: moves.length,
    };
  }
  return unsolved(from, expanded, discovered.size, frontierPeak);
}

function* goalTrivial(from: PuzzleState): Generator<SearchStep, SearchResult> {
  const seen = new Set<string>([stateKey(from)]);
  yield snapshot(from, seen, seen, 0, 1);
  return { solvable: true, path: [from], moves: [], expanded: 0, discovered: 1, frontierPeak: 1, cost: 0 };
}

/**
 * The search as a step-by-step generator: it yields a {@link SearchStep} after
 * each node expansion and finally returns the full {@link SearchResult}. The
 * visualization replays the yielded steps; {@link solveFrom} just drains it.
 */
export function searchSteps(
  cfg: Config,
  from: PuzzleState,
  algo: SearchAlgo
): Generator<SearchStep, SearchResult> {
  if (isGoal(from)) return goalTrivial(from);
  if (algo === "iddfs") return iddfsSteps(cfg, from);
  if (algo === "bidir") return bidirSteps(cfg, from);
  return frontierSearch(cfg, from, algo);
}

/**
 * Search the state space from `from` to the goal, returning the path, the moves,
 * and search-cost telemetry. Drains {@link searchSteps} so the one-shot answer
 * and the animated trace come from exactly the same run.
 */
export function solveFrom(
  cfg: Config,
  from: PuzzleState,
  algo: SearchAlgo
): SearchResult {
  const gen = searchSteps(cfg, from, algo);
  let r = gen.next();
  while (!r.done) r = gen.next();
  return r.value;
}

/**
 * The reachable state graph for a config - every state reachable from the start
 * by legal crossings, plus the undirected edges between them. Drawn by the
 * search-graph view; an unsolvable instance simply has the goal in a different
 * (here, absent) component, which is the visual proof of impossibility.
 */
export function reachableGraph(cfg: Config): StateGraph {
  const start = startState(cfg);
  const nodes: PuzzleState[] = [];
  const seen = new Set<string>([stateKey(start)]);
  const edgeSeen = new Set<string>();
  const edges: { a: string; b: string }[] = [];
  const queue: PuzzleState[] = [start];
  let head = 0;
  while (head < queue.length) {
    const s = queue[head++];
    nodes.push(s);
    const a = stateKey(s);
    for (const { state: ns } of successors(cfg, s)) {
      const b = stateKey(ns);
      const ek = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (!edgeSeen.has(ek)) {
        edgeSeen.add(ek);
        edges.push({ a, b });
      }
      if (!seen.has(b)) {
        seen.add(b);
        queue.push(ns);
      }
    }
  }
  // Surface the goal even when it sits outside the reachable component, so an
  // unsolvable instance still shows the unreachable target.
  const goal: PuzzleState = { ml: 0, cl: 0, boat: "R" };
  if (!seen.has(stateKey(goal))) nodes.push(goal);
  return { nodes, edges };
}

export function loadLabel(load: Load): string {
  const parts: string[] = [];
  if (load.m) parts.push(`${load.m}M`);
  if (load.c) parts.push(`${load.c}C`);
  return parts.join("+") || "-";
}

export function moveArrow(from: Side): string {
  return from === "L" ? "→" : "←";
}
