import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CellView,
  Difficulty,
  FieldConfig,
  GameStatus,
  GenStats,
  LogEntry,
  Minefield,
} from "./types";
import { DEFAULT_CONFIG, DEFAULT_DIFFICULTY, PRESETS } from "./constants";
import { neighbors } from "./grid";
import { prefersReducedMotion } from "../../hooks/useReducedMotion";
import { clampMines, generateField } from "./generator";
import { getSolver } from "./solvers";
import type { SolverAction, SolverId, SolverReport } from "./solvers/types";

/** Auto-solver playback: tick interval, and how many of the solver's moves to
 *  apply per tick (scaled so any board finishes in a roughly constant time). */
const SOLVE_TICK_MS = 70;
const SOLVE_MOVE_STEPS = 60;

function freshView(width: number, height: number): CellView[] {
  return new Array(width * height).fill("hidden");
}

/** Flood-reveal from `start`. Returns the new view + whether a mine was hit.
 *  A zero opens its neighbours; flagged cells block the cascade, as in the game. */
function revealCascade(
  view: CellView[],
  field: Minefield,
  start: number,
): { view: CellView[]; hitMine: boolean } {
  const next = view.slice();
  if (field.cells[start].mine) {
    next[start] = "revealed";
    return { view: next, hitMine: true };
  }
  const { width, height, cells } = field;
  const stack = [start];
  while (stack.length) {
    const i = stack.pop()!;
    if (next[i] !== "hidden") continue;
    next[i] = "revealed";
    if (cells[i].adjacent === 0) {
      for (const n of neighbors(i, width, height)) {
        if (next[n] === "hidden") stack.push(n);
      }
    }
  }
  return { view: next, hitMine: false };
}

function countRevealedSafe(view: CellView[], field: Minefield): number {
  let c = 0;
  for (let i = 0; i < view.length; i++) {
    if (view[i] === "revealed" && !field.cells[i].mine) c++;
  }
  return c;
}

/** Game over: expose every mine (keeping correct flags) and mark the fatal one. */
function revealAllMines(base: CellView[], field: Minefield, detonated: number): CellView[] {
  const next = base.slice();
  for (const m of field.mineIndices) if (next[m] !== "flagged") next[m] = "revealed";
  next[detonated] = "revealed";
  return next;
}

/** Apply a solver's whole move log at once (used under reduced-motion). */
function replayAll(field: Minefield, actions: SolverAction[]): CellView[] {
  let v = freshView(field.width, field.height);
  for (const a of actions) {
    if (a.type === "flag") {
      v = v.slice();
      v[a.cell] = "flagged";
    } else {
      v = revealCascade(v, field, a.cell).view;
    }
  }
  return v;
}

export function useMinesweeper() {
  const [difficulty, setDifficulty] = useState<Difficulty>(DEFAULT_DIFFICULTY);
  const [cfg, setCfg] = useState<FieldConfig>(DEFAULT_CONFIG);
  const [field, setField] = useState<Minefield | null>(null);
  const [view, setView] = useState<CellView[]>(() => freshView(DEFAULT_CONFIG.width, DEFAULT_CONFIG.height));
  const [status, setStatus] = useState<GameStatus>("fresh");
  const [stats, setStats] = useState<GenStats | null>(null);
  const [mineHit, setMineHit] = useState<number | null>(null);
  const [peek, setPeek] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const logId = useRef(0);

  // ── Auto-solver state ──────────────────────────────────────────────────────
  const [solverId, setSolverId] = useState<SolverId>("backtracking");
  const [solverReport, setSolverReport] = useState<SolverReport | null>(null);
  const [solverPlaying, setSolverPlaying] = useState(false);
  /** remaining moves of the running solve, replayed one wave at a time */
  const [solverMoves, setSolverMoves] = useState<SolverAction[]>([]);
  const [solverGuess, setSolverGuess] = useState<number | null>(null);
  const [showOdds, setShowOdds] = useState(false);
  /** report + the field it solved, read inside the playback timer (to cascade). */
  const solverRef = useRef<{ report: SolverReport; field: Minefield } | null>(null);

  const pushLog = useCallback((kind: LogEntry["kind"], text: string) => {
    setLog((prev) => {
      const next = [...prev, { id: ++logId.current, kind, text }];
      return next.length > 400 ? next.slice(-400) : next;
    });
  }, []);

  // Counts derived from the current view - cheap at these board sizes.
  const flagsUsed = useMemo(() => view.filter((v) => v === "flagged").length, [view]);
  const revealedSafe = useMemo(
    () => (field ? countRevealedSafe(view, field) : 0),
    [view, field],
  );
  const minesLeft = field ? field.mineCount - flagsUsed : cfg.mines - flagsUsed;
  const won = status === "won";
  const lost = status === "lost";
  const solverProbs = solverReport?.probabilities ?? null;

  const clearSolver = useCallback(() => {
    solverRef.current = null;
    setSolverPlaying(false);
    setSolverMoves([]);
    setSolverReport(null);
    setSolverGuess(null);
    setShowOdds(false);
  }, []);

  // ── Auto-solver playback ───────────────────────────────────────────────────
  // Replay the move log a wave at a time: each "reveal" is a real click (cascades
  // a region open if it's a 0), each "flag" marks a deduced mine, in deduction
  // order. Each wave only schedules the next; no state writes in the effect body.
  useEffect(() => {
    if (!solverPlaying || solverMoves.length === 0) return;
    const id = window.setTimeout(() => {
      const meta = solverRef.current;
      const total = meta?.report.actions.length ?? solverMoves.length;
      const step = Math.max(1, Math.ceil(total / SOLVE_MOVE_STEPS));
      const batch = solverMoves.slice(0, step);
      const rest = solverMoves.slice(step);
      if (meta) {
        const { field: f } = meta;
        setView((prev) => {
          let v = prev;
          for (const a of batch) {
            if (a.type === "flag") {
              v = v.slice();
              v[a.cell] = "flagged";
            } else {
              v = revealCascade(v, f, a.cell).view; // a real click → cascade
            }
          }
          return v;
        });
      }
      setSolverMoves(rest);
      if (rest.length === 0) {
        setSolverPlaying(false);
        const r = meta?.report;
        if (r?.status === "solved") {
          setStatus("won");
          pushLog("win", `${solverId} cleared the field - no guess`);
        } else if (r) {
          setSolverGuess(r.bestGuess ?? null);
          pushLog("play", `${solverId} stuck - ${r.undecided.length} undecided`);
        }
      }
    }, SOLVE_TICK_MS);
    return () => window.clearTimeout(id);
  }, [solverPlaying, solverMoves, solverId, pushLog]);

  // Reset to a fresh, un-forged board for the current config.
  const reset = useCallback(
    (next: FieldConfig, label: string) => {
      clearSolver();
      setField(null);
      setStats(null);
      setMineHit(null);
      setStatus("fresh");
      setView(freshView(next.width, next.height));
      pushLog("setup", label);
    },
    [pushLog, clearSolver],
  );

  const applyDifficulty = useCallback(
    (d: Difficulty) => {
      setDifficulty(d);
      if (d === "custom") {
        pushLog("setup", "difficulty → custom");
        return;
      }
      const p = PRESETS.find((x) => x.id === d)!;
      const next: FieldConfig = { ...cfg, width: p.width, height: p.height, mines: p.mines };
      setCfg(next);
      reset(next, `difficulty → ${d} · ${p.width}×${p.height} · ${p.mines} mines`);
    },
    [cfg, reset, pushLog],
  );

  const patchConfig = useCallback(
    (patch: Partial<FieldConfig>) => {
      const merged = { ...cfg, ...patch };
      merged.mines = clampMines(merged.width, merged.height, merged.mines, merged.safeRadius);
      setDifficulty("custom");
      setCfg(merged);
      reset(merged, `custom · ${merged.width}×${merged.height} · ${merged.mines} mines`);
    },
    [cfg, reset],
  );

  // Forge the field around `origin` and (optionally) open it there.
  const forgeAt = useCallback(
    (origin: number, autoReveal: boolean) => {
      const { field: f, stats: s } = generateField(cfg, origin);
      setField(f);
      setStats(s);
      setMineHit(null);
      pushLog(
        "gen",
        `forged ${f.width}×${f.height} · ${f.mineCount} mines · ${s.solved ? "no-guess ✓" : `${s.undecided.length} guess pts ✗`} · ${s.hardest} · 3BV ${s.threeBV} · ${s.attempts}a/${s.swaps}s · ${s.ms}ms`,
      );
      if (autoReveal) {
        const { view: v } = revealCascade(freshView(f.width, f.height), f, origin);
        setView(v);
        const allClear = countRevealedSafe(v, f) === f.width * f.height - f.mineCount;
        setStatus(allClear ? "won" : "playing");
        if (allClear) pushLog("win", "field opened completely on the first click");
      } else {
        setView(freshView(f.width, f.height));
        setStatus("playing");
      }
      return f;
    },
    [cfg, pushLog],
  );

  /** Forge around the centre and open it (inspect a generated field). */
  const forgeCenter = useCallback(() => {
    const origin = Math.floor(cfg.height / 2) * cfg.width + Math.floor(cfg.width / 2);
    forgeAt(origin, true);
  }, [cfg, forgeAt]);

  const newField = useCallback(() => {
    reset(cfg, "new field - click to forge");
  }, [cfg, reset]);

  // ── Auto-solver controls ───────────────────────────────────────────────────
  /** Run a solver from the field's safe origin and watch it play out. Forges a
   *  field first if none exists yet. */
  const runSolver = useCallback(
    (id: SolverId) => {
      setSolverId(id);
      let f = field;
      if (!f) {
        const origin = Math.floor(cfg.height / 2) * cfg.width + Math.floor(cfg.width / 2);
        const gen = generateField(cfg, origin);
        f = gen.field;
        setField(gen.field);
        setStats(gen.stats);
        pushLog("gen", `forged ${gen.field.width}×${gen.field.height} · ${gen.field.mineCount} mines for the solver`);
      }
      const report = getSolver(id).solve(f, f.safeOrigin);
      solverRef.current = { report, field: f };
      setSolverReport(report);
      setSolverGuess(null);
      setShowOdds(false);
      setMineHit(null);
      pushLog("play", `${id} → ${report.status}: ${report.safe.length} safe, ${report.mines.length} mines, ${report.undecided.length} undecided`);

      if (prefersReducedMotion()) {
        // No animation: apply the whole solve at once and settle immediately.
        setView(replayAll(f, report.actions));
        setSolverMoves([]);
        setSolverPlaying(false);
        if (report.status === "solved") {
          setStatus("won");
          pushLog("win", `${id} cleared the field - no guess`);
        } else {
          setStatus("playing");
          setSolverGuess(report.bestGuess ?? null);
          pushLog("play", `${id} stuck - ${report.undecided.length} undecided`);
        }
      } else {
        setView(freshView(f.width, f.height));
        setStatus("playing");
        setSolverMoves(report.actions);
        setSolverPlaying(true);
      }
    },
    [field, cfg, pushLog],
  );

  const stopSolver = useCallback(() => {
    setSolverPlaying(false);
    setSolverMoves([]);
  }, []);

  /** Pick an engine without running it - clears any prior run's readout/overlay
   *  so the panel shows a clean "ready to solve" state. */
  const selectSolver = useCallback(
    (id: SolverId) => {
      clearSolver();
      setSolverId(id);
    },
    [clearSolver],
  );

  const revealCell = useCallback(
    (i: number) => {
      if (solverPlaying) return;
      if (status === "won" || status === "lost") return;
      if (view[i] === "flagged") return;

      // First click forges the field around it (true first-click safety).
      if (!field || status === "fresh") {
        const f = forgeAt(i, false);
        const { view: v } = revealCascade(freshView(f.width, f.height), f, i);
        setView(v);
        const allClear = countRevealedSafe(v, f) === f.width * f.height - f.mineCount;
        setStatus(allClear ? "won" : "playing");
        if (allClear) pushLog("win", "cleared in one click");
        return;
      }

      if (view[i] === "revealed") return;
      const { view: v, hitMine } = revealCascade(view, field, i);
      if (hitMine) {
        setView(revealAllMines(v, field, i));
        setMineHit(i);
        setStatus("lost");
        pushLog("loss", `stepped on a mine at ${i % field.width},${(i / field.width) | 0}`);
        return;
      }
      setView(v);
      if (countRevealedSafe(v, field) === field.width * field.height - field.mineCount) {
        setStatus("won");
        pushLog("win", "all safe cells cleared");
      }
    },
    [solverPlaying, status, view, field, forgeAt, pushLog],
  );

  const toggleFlag = useCallback(
    (i: number) => {
      if (solverPlaying || !field || status === "won" || status === "lost") return;
      setView((prev) => {
        if (prev[i] === "revealed") return prev;
        const next = prev.slice();
        next[i] = prev[i] === "flagged" ? "hidden" : "flagged";
        return next;
      });
    },
    [solverPlaying, field, status],
  );

  /** Chord: click a satisfied number to sweep its un-flagged neighbours. */
  const chord = useCallback(
    (i: number) => {
      if (solverPlaying || !field || status !== "playing") return;
      if (view[i] !== "revealed" || field.cells[i].adjacent === 0) return;
      const ns = neighbors(i, field.width, field.height);
      const flags = ns.filter((n) => view[n] === "flagged").length;
      if (flags !== field.cells[i].adjacent) return;
      let v = view;
      let hit = -1;
      for (const n of ns) {
        if (v[n] !== "hidden") continue;
        const r = revealCascade(v, field, n);
        v = r.view;
        if (r.hitMine) hit = n;
      }
      if (hit >= 0) {
        setView(revealAllMines(v, field, hit));
        setMineHit(hit);
        setStatus("lost");
        pushLog("loss", "a chord detonated a misplaced flag");
        return;
      }
      if (v !== view) {
        setView(v);
        if (countRevealedSafe(v, field) === field.width * field.height - field.mineCount) {
          setStatus("won");
          pushLog("win", "all safe cells cleared");
        }
      }
    },
    [solverPlaying, field, status, view, pushLog],
  );

  const buildReport = useCallback((): string => {
    const lines: string[] = [];
    lines.push("minesweeper - minefield generator - debug report");
    lines.push("─".repeat(52));
    lines.push(`[config] ${cfg.width}×${cfg.height} mines=${cfg.mines} safeR=${cfg.safeRadius} seed=${cfg.seed} difficulty=${difficulty}`);
    lines.push(`[game] status=${status} revealedSafe=${revealedSafe} flags=${flagsUsed} minesLeft=${minesLeft} peek=${peek}`);
    if (stats) {
      lines.push("[generation]");
      lines.push(`solved(no-guess)=${stats.solved} rating=${stats.rating}/${stats.tier} hardest=${stats.hardest}`);
      lines.push(`techniques: count=${stats.techniques.count} subset=${stats.techniques.subset} enumerate=${stats.techniques.enumerate}`);
      lines.push(`3BV=${stats.threeBV} density=${(stats.density * 100).toFixed(1)}% attempts=${stats.attempts} swaps=${stats.swaps} seed=${stats.seed} ms=${stats.ms}`);
      if (!stats.solved && stats.undecided.length) {
        lines.push(`[guess points] ${stats.undecided.map((u) => `${u % cfg.width},${(u / cfg.width) | 0}`).join(" ")}`);
      }
    } else {
      lines.push("[generation] (field not forged yet - click a cell)");
    }
    if (field) {
      lines.push(`[mines] ${field.mineIndices.map((m) => `${m % field.width},${(m / field.width) | 0}`).join(" ")}`);
    }
    if (solverReport) {
      const r = solverReport;
      lines.push("[solver]");
      lines.push(`engine=${solverId} status=${r.status} revealed=${r.revealedCount} flagged=${r.identifiedCount} undecided=${r.undecided.length} steps=${r.steps} ms=${r.ms.toFixed(1)}`);
      lines.push(`techniques: ${Object.entries(r.techniques).map(([k, v]) => `${k}=${v}`).join(" ")}`);
      if (r.bestGuess != null) lines.push(`bestGuess=${r.bestGuess % cfg.width},${(r.bestGuess / cfg.width) | 0} p=${r.probabilities?.get(r.bestGuess)?.toFixed(3) ?? "-"}`);
    }
    lines.push("─".repeat(52));
    lines.push(`[events] (${log.length} total, last 40)`);
    for (const e of log.slice(-40)) lines.push(`${e.kind}\t${e.text}`);
    return lines.join("\n");
  }, [cfg, difficulty, status, revealedSafe, flagsUsed, minesLeft, peek, stats, field, log, solverReport, solverId]);

  return {
    difficulty,
    cfg,
    field,
    view,
    status,
    stats,
    mineHit,
    peek,
    log,
    flagsUsed,
    revealedSafe,
    minesLeft,
    won,
    lost,
    applyDifficulty,
    patchConfig,
    forgeCenter,
    newField,
    revealCell,
    toggleFlag,
    chord,
    setPeek,
    // auto-solver
    solverId,
    solverReport,
    solverPlaying,
    solverGuess,
    solverProbs,
    showOdds,
    setShowOdds,
    selectSolver,
    runSolver,
    stopSolver,
    clearLog: useCallback(() => setLog([]), []),
    buildReport,
  };
}
