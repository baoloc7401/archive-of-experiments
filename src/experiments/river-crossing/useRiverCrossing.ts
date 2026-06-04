import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Config,
  DebugEntry,
  DebugKind,
  Load,
  Move,
  PuzzleState,
  SearchAlgo,
  SearchResult,
  SearchStep,
  StateGraph,
  Status,
} from "./types";
import {
  isGoal,
  isValid,
  loadLabel,
  moveArrow,
  rawApply,
  reachableGraph,
  rightBank,
  searchSteps,
  startState,
  stateKey,
} from "./solver";
import {
  DEFAULT_CONFIG,
  DEFAULT_SPEED_INDEX,
  PLAY_GAP,
  randomShoutIndex,
  SPEED_PRESETS,
} from "./constants";

const NO_LOAD: Load = { m: 0, c: 0 };

export interface RiverCrossing {
  cfg: Config;
  state: PuzzleState;
  board: Load;
  status: Status;
  /** index into the i18n death-shout list (set on defeat, cleared otherwise) */
  deathShoutIndex: number | null;
  crossing: boolean;
  /** which bank the boat sits at right now (origin while crossing) */
  dock: PuzzleState["boat"];
  /** where the boat is drawn — flips to the destination during a crossing */
  boatSide: PuzzleState["boat"];
  /** people standing on each bank, minus anyone already aboard */
  leftBank: Load;
  rightBank: Load;
  /** moves the player has actually made */
  moveLog: Move[];
  /** the solver's continuation from the *current* state, under the chosen algorithm */
  solution: SearchResult;
  /** the reachable state graph for the current config (for the search view) */
  graph: StateGraph;
  /** the materialized search trace from the current state (one frame per expansion) */
  searchTrace: SearchStep[];
  /** identity of the current search — change it to remount/reset the search view */
  searchKey: string;
  /** remaining moves of the plan currently being followed (empty when idle) */
  plan: Move[];
  algo: SearchAlgo;
  speedIndex: number;
  /** current crossing animation duration in ms (matches the boat glide) */
  crossMs: number;
  /** auto-solver is actively running */
  isPlaying: boolean;
  seats: number;
  canCross: boolean;
  canUndo: boolean;
  /** chronological debug events across the whole session */
  log: DebugEntry[];

  boardPerson: (kind: "m" | "c") => void;
  unboard: (kind: "m" | "c") => void;
  cross: () => void;
  undo: () => void;
  reset: () => void;
  setConfig: (patch: Partial<Config>) => void;
  setAlgo: (a: SearchAlgo) => void;
  setSpeedIndex: (i: number) => void;
  step: () => void;
  play: () => void;
  pause: () => void;
  clearLog: () => void;
  /** assembled on demand — a full, paste-ready snapshot for debugging */
  buildReport: () => string;
}

export function useRiverCrossing(): RiverCrossing {
  const [cfg, setCfg] = useState<Config>(DEFAULT_CONFIG);
  const [state, setState] = useState<PuzzleState>(() => startState(DEFAULT_CONFIG));
  const [board, setBoard] = useState<Load>(NO_LOAD);
  const [status, setStatus] = useState<Status>("playing");
  /** which death-shout to show; non-null only while `status === "lost"` */
  const [deathShoutIndex, setDeathShoutIndex] = useState<number | null>(null);
  const [crossing, setCrossing] = useState(false);
  const [history, setHistory] = useState<PuzzleState[]>([]);
  const [moveLog, setMoveLog] = useState<Move[]>([]);
  const [algo, setAlgo] = useState<SearchAlgo>("bfs");
  const [speedIndex, setSpeedIndex] = useState(DEFAULT_SPEED_INDEX);
  const [playIntent, setPlayIntent] = useState(false);
  /** the remaining moves of a committed solver plan being followed move-by-move.
   *  Snapshotted once (NOT recomputed each step) so non-optimal algorithms like
   *  DFS — whose path isn't progress-monotonic — don't oscillate forever. */
  const [plan, setPlan] = useState<Move[]>([]);
  const [log, setLog] = useState<DebugEntry[]>([]);

  /** in-flight crossing: where it came from, where it lands, who's aboard */
  const pending = useRef<{ from: PuzzleState; to: PuzzleState; load: Load } | null>(null);
  const logId = useRef(0);
  /** crossings committed so far — mirrors moveLog.length, readable inside timers */
  const playedRef = useRef(0);

  const pushLog = useCallback((kind: DebugKind, text: string, n: number | null = null) => {
    setLog((l) => [...l, { id: logId.current++, kind, n, text }]);
  }, []);

  const crossMs = SPEED_PRESETS[speedIndex].ms;

  // One generator run feeds both the answer and the animated trace, so the
  // step-by-step view can never disagree with the plan the solver hands back.
  const trace = useMemo(() => {
    const steps: SearchStep[] = [];
    const gen = searchSteps(cfg, state, algo);
    let r = gen.next();
    while (!r.done) {
      steps.push(r.value);
      r = gen.next();
    }
    return { steps, result: r.value };
  }, [cfg, state, algo]);
  const solution = trace.result;
  const graph = useMemo(() => reachableGraph(cfg), [cfg]);
  const searchKey = `${cfg.m}-${cfg.c}-${cfg.k}-${algo}-${stateKey(state)}`;

  const dock = state.boat;
  const right = rightBank(cfg, state);
  const fromBoardM = dock === "L" ? board.m : 0;
  const fromBoardC = dock === "L" ? board.c : 0;
  const leftBank: Load = { m: state.ml - fromBoardM, c: state.cl - fromBoardC };
  const rightBankShown: Load = {
    m: right.m - (dock === "R" ? board.m : 0),
    c: right.c - (dock === "R" ? board.c : 0),
  };

  const seats = board.m + board.c;
  const canCross = !crossing && status === "playing" && seats >= 1;
  const canUndo = !crossing && history.length > 0;
  const isPlaying = playIntent && status === "playing" && plan.length > 0;

  // ── crossing animation → commit ────────────────────────────────────────────
  // While `crossing` is true the boat glides; once the timer fires we land the
  // passengers, flip the boat, and judge the resulting banks. setState happens
  // inside the timeout (an event), never synchronously in the effect body.
  useEffect(() => {
    if (!crossing) return;
    const id = window.setTimeout(() => {
      const p = pending.current;
      pending.current = null;
      setCrossing(false);
      if (!p) return;
      setHistory((h) => [...h, p.from]);
      setMoveLog((l) => [...l, { m: p.load.m, c: p.load.c, from: p.from.boat }]);
      setBoard(NO_LOAD);
      setState(p.to);
      const won = isGoal(p.to);
      const legal = isValid(cfg, p.to);
      setStatus(won ? "won" : legal ? "playing" : "lost");
      setDeathShoutIndex(won || legal ? null : randomShoutIndex());

      const n = (playedRef.current += 1);
      const r = rightBank(cfg, p.to);
      const verdict = won ? "GOAL" : legal ? "ok" : "ILLEGAL — someone eaten";
      pushLog(
        won ? "win" : legal ? "cross" : "lost",
        `${moveArrow(p.from.boat)} ${loadLabel(p.load)} ⇒ L:${p.to.ml}M${p.to.cl}C` +
          ` R:${r.m}M${r.c}C boat@${p.to.boat} (${verdict})`,
        n
      );
    }, crossMs);
    return () => window.clearTimeout(id);
  }, [crossing, crossMs, cfg, pushLog]);

  const beginCross = useCallback(
    (load: Load) => {
      if (crossing || status !== "playing" || load.m + load.c < 1) return;
      const to = rawApply(cfg, state, load);
      pending.current = { from: state, to, load };
      setBoard(load);
      setCrossing(true);
    },
    [crossing, status, cfg, state]
  );

  // ── auto-play loop ─────────────────────────────────────────────────────────
  // Walks the committed `plan` one move at a time. Only ever *schedules* the
  // next step (no synchronous state writes in the effect body); the move is read
  // from the closure so it's never recomputed from an intermediate state.
  useEffect(() => {
    if (!isPlaying || crossing || plan.length === 0) return;
    const id = window.setTimeout(() => {
      beginCross(plan[0]);
      setPlan((p) => p.slice(1));
    }, PLAY_GAP);
    return () => window.clearTimeout(id);
  }, [isPlaying, crossing, plan, beginCross]);

  const boardPerson = useCallback(
    (kind: "m" | "c") => {
      if (crossing || status !== "playing") return;
      setBoard((b) => {
        if (b.m + b.c >= cfg.k) return b;
        const availM = (dock === "L" ? state.ml : right.m) - b.m;
        const availC = (dock === "L" ? state.cl : right.c) - b.c;
        if (kind === "m" && availM <= 0) return b;
        if (kind === "c" && availC <= 0) return b;
        return { m: b.m + (kind === "m" ? 1 : 0), c: b.c + (kind === "c" ? 1 : 0) };
      });
    },
    [crossing, status, cfg.k, dock, state.ml, state.cl, right.m, right.c]
  );

  const unboard = useCallback(
    (kind: "m" | "c") => {
      if (crossing || status !== "playing") return;
      setBoard((b) => ({
        m: b.m - (kind === "m" && b.m > 0 ? 1 : 0),
        c: b.c - (kind === "c" && b.c > 0 ? 1 : 0),
      }));
    },
    [crossing, status]
  );

  // A manual crossing abandons any committed solver plan — the player deviated.
  const cross = useCallback(() => {
    setPlayIntent(false);
    setPlan([]);
    beginCross(board);
  }, [beginCross, board]);

  // One coherent step: follow the committed plan if present, otherwise seed it
  // from the current solution and take its first move (and keep the rest).
  const step = useCallback(() => {
    const next = plan.length > 0 ? plan : solution.moves;
    if (next.length === 0) return;
    setPlayIntent(false);
    pushLog("solver", `hint step (${algo})`);
    beginCross(next[0]);
    setPlan(next.slice(1));
  }, [plan, solution, algo, beginCross, pushLog]);

  const play = useCallback(() => {
    if (!solution.solvable || solution.moves.length === 0) return;
    setPlan(solution.moves);
    pushLog("solver", `auto-solve started (${algo}, ${solution.moves.length} crossings)`);
    setPlayIntent(true);
  }, [solution, algo, pushLog]);
  const pause = useCallback(() => setPlayIntent(false), []);

  // Switching algorithm invalidates any plan snapshotted under the old one.
  const changeAlgo = useCallback((a: SearchAlgo) => {
    setAlgo(a);
    setPlan([]);
    setPlayIntent(false);
  }, []);

  const undo = useCallback(() => {
    if (crossing || history.length === 0) return;
    const prev = history[history.length - 1];
    setPlayIntent(false);
    setPlan([]);
    setHistory((h) => h.slice(0, -1));
    setMoveLog((l) => l.slice(0, -1));
    setBoard(NO_LOAD);
    setState(prev);
    setStatus("playing");
    setDeathShoutIndex(null);
    playedRef.current = Math.max(0, playedRef.current - 1);
    pushLog("undo", "undo last crossing");
  }, [crossing, history, pushLog]);

  const applyConfig = useCallback(
    (next: Config, reason: "reset" | "config") => {
      pending.current = null;
      playedRef.current = 0;
      setPlayIntent(false);
      setPlan([]);
      setCrossing(false);
      setCfg(next);
      setState(startState(next));
      setBoard(NO_LOAD);
      setStatus("playing");
      setDeathShoutIndex(null);
      setHistory([]);
      setMoveLog([]);
      pushLog(
        "setup",
        `${reason === "reset" ? "reset" : "config"} → ${next.m}M ${next.c}C · boat ${next.k}`
      );
    },
    [pushLog]
  );

  const clearLog = useCallback(() => setLog([]), []);

  const reset = useCallback(() => applyConfig(cfg, "reset"), [applyConfig, cfg]);

  const setConfig = useCallback(
    (patch: Partial<Config>) => applyConfig({ ...cfg, ...patch }, "config"),
    [applyConfig, cfg]
  );

  const buildReport = useCallback(() => {
    const r = rightBank(cfg, state);
    const lines: string[] = [
      "river crossing — debug report",
      `generated: ${new Date().toISOString()}`,
      `config: ${cfg.m} missionaries · ${cfg.c} cannibals · boat seats ${cfg.k}`,
      "─".repeat(46),
      `status: ${status}${crossing ? " (mid-crossing)" : ""}`,
      `boat docked: ${state.boat === "L" ? "left" : "right"} bank`,
      `left  bank: ${state.ml}M ${state.cl}C`,
      `right bank: ${r.m}M ${r.c}C`,
      `aboard now: ${board.m}M ${board.c}C  (${board.m + board.c}/${cfg.k} seats)`,
      "",
      `solver [${algo}] from current state:`,
      `  solvable: ${solution.solvable}`,
      `  optimal crossings remaining: ${solution.solvable ? solution.moves.length : "—"}`,
      `  nodes expanded: ${solution.expanded} · discovered: ${solution.discovered} · frontier peak: ${solution.frontierPeak}`,
    ];
    if (algo === "ucs" && solution.solvable) {
      lines.push(`  least path cost (people ferried): ${solution.cost}`);
    }
    if (solution.solvable && solution.moves.length > 0) {
      lines.push(
        `  optimal plan: ${solution.moves
          .map((mv) => `${moveArrow(mv.from)}${loadLabel(mv)}`)
          .join("  ")}`
      );
    }

    lines.push("", `moves played: ${moveLog.length}`);
    let s = startState(cfg);
    moveLog.forEach((mv, i) => {
      const next = rawApply(cfg, s, { m: mv.m, c: mv.c });
      const rr = rightBank(cfg, next);
      const verdict = isGoal(next) ? "GOAL" : isValid(cfg, next) ? "ok" : "ILLEGAL";
      lines.push(
        `  #${i + 1} ${moveArrow(mv.from)} ${loadLabel(mv).padEnd(5)} => ` +
          `L(${next.ml}M,${next.cl}C) R(${rr.m}M,${rr.c}C) boat@${next.boat}  ${verdict}`
      );
      s = next;
    });

    if (log.length > 0) {
      lines.push("", "events:");
      log.forEach((e) =>
        lines.push(`  ${e.n != null ? `#${e.n}`.padStart(4) : "    "} [${e.kind}] ${e.text}`)
      );
    }
    return lines.join("\n");
  }, [cfg, state, status, crossing, board, algo, solution, moveLog, log]);

  return {
    cfg,
    state,
    board,
    status,
    deathShoutIndex,
    crossing,
    dock,
    boatSide: crossing ? (dock === "L" ? "R" : "L") : dock,
    leftBank,
    rightBank: rightBankShown,
    moveLog,
    solution,
    graph,
    searchTrace: trace.steps,
    searchKey,
    plan,
    algo,
    speedIndex,
    crossMs,
    isPlaying,
    seats,
    canCross,
    canUndo,
    log,
    boardPerson,
    unboard,
    cross,
    undo,
    reset,
    setConfig,
    setAlgo: changeAlgo,
    setSpeedIndex,
    step,
    play,
    pause,
    clearLog,
    buildReport,
  };
}
