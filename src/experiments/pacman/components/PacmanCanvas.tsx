import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useTranslation } from "react-i18next";
import type { Theme } from "../../../hooks/useTheme";
import { COLS, FIXED_DT, ROWS, SNAPSHOT_INTERVAL, TILE_PX } from "../constants";
import { drawScene, readPalette, type Palette } from "../render";
import { computeSnapshot, ghostMode, makeInitialState, step } from "../simulation";
import { closeAudio, playCue, setMuted, setSiren, stopSiren } from "../sound";
import { tileOf } from "../targeting";
import type { PacController } from "../pacai";
import type { SpecialKind } from "../pellets/registry";
import type { Direction, GhostId, PacmanState, SfxCue, Snapshot } from "../types";

interface Props {
  running: boolean;
  reduced: boolean;
  theme: Theme;
  showOverlay: boolean;
  showPaths: boolean;
  showDanger: boolean;
  explainMode: boolean;
  /** Which ghosts are switched on. */
  enabled: Record<GhostId, boolean>;
  /** Which special board-content types are switched on. */
  enabledPellets: Record<SpecialKind, boolean>;
  /** Who drives Pac-Man. */
  pacController: PacController;
  /** Coordinated ghost mode (shared blackboard + role assignment). */
  coordinated: boolean;
  /** Whether sound effects play. */
  soundOn: boolean;
  /** Bumping this rebuilds the board. */
  resetKey: number;
  onSnapshot: (s: Snapshot) => void;
  onHover: (id: GhostId | null) => void;
  /** Pressing a movement key while an AI drives hands control back to the human. */
  onTakeControl: () => void;
}

export interface PacmanHandle {
  step: () => void;
  reset: () => void;
}

const KEY_DIR: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
  W: "up",
  S: "down",
  A: "left",
  D: "right",
};

/** Danger 0..1 for the siren: how close the nearest lethal active ghost is. */
function sirenLevel(s: PacmanState): number {
  if (s.status !== "playing") return 0;
  const px = Math.round(s.pac.x);
  const py = Math.round(s.pac.y);
  let best = Infinity;
  for (const g of s.ghosts) {
    if (!s.enabled[g.id] || g.pen !== "active") continue;
    const em = ghostMode(s, g);
    if (em !== "chase" && em !== "scatter") continue; // ignore frightened / eyes
    let dc = Math.abs(Math.round(g.x) - px);
    dc = Math.min(dc, COLS - dc); // tunnel wrap
    const d = dc + Math.abs(Math.round(g.y) - py);
    if (d < best) best = d;
  }
  if (best === Infinity) return 0;
  return Math.max(0, 1 - best / 8);
}

const PacmanCanvas = forwardRef<PacmanHandle, Props>(function PacmanCanvas(
  {
    running,
    reduced,
    theme,
    showOverlay,
    showPaths,
    showDanger,
    explainMode,
    enabled,
    enabledPellets,
    pacController,
    coordinated,
    soundOn,
    resetKey,
    onSnapshot,
    onHover,
    onTakeControl,
  },
  ref,
) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const stateRef = useRef<PacmanState>(makeInitialState());
  const paletteRef = useRef<Palette>(readPalette());
  const tileRef = useRef(TILE_PX);
  const dprRef = useRef(1);
  const timeRef = useRef(0);
  const hoverRef = useRef<GhostId | null>(null);
  const swipeRef = useRef<{ x: number; y: number } | null>(null);
  const propsRef = useRef({
    running,
    reduced,
    theme,
    showOverlay,
    showPaths,
    showDanger,
    explainMode,
    enabled,
    enabledPellets,
    pacController,
    coordinated,
    soundOn,
    onSnapshot,
    onTakeControl,
  });
  propsRef.current = {
    running,
    reduced,
    theme,
    showOverlay,
    showPaths,
    showDanger,
    explainMode,
    enabled,
    enabledPellets,
    pacController,
    coordinated,
    soundOn,
    onSnapshot,
    onTakeControl,
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const p = propsRef.current;
    // drawScene works in TILE_PX-sized logical units; fold both the on-screen
    // tile scale and the device pixel ratio into one transform so the full
    // backing store is painted (and cleared) every frame.
    const scale = (tileRef.current / TILE_PX) * dprRef.current;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    drawScene(ctx, stateRef.current, {
      palette: paletteRef.current,
      tile: TILE_PX,
      time: timeRef.current,
      reduced: p.reduced,
      showOverlay: p.showOverlay,
      showPaths: p.showPaths,
      showDanger: p.showDanger,
      explainId: p.explainMode ? hoverRef.current : null,
    });
  }, []);

  const emit = useCallback(() => {
    propsRef.current.onSnapshot(computeSnapshot(stateRef.current));
  }, []);

  // Drain the engine's sound cues, playing them when sound is on. Identical cues
  // queued within one frame (e.g. two dots eaten in two substeps) collapse to a
  // single blip so they do not stack at the same instant. Always clears the
  // queue so a muted run does not back up a burst of blips on unmute.
  const drainSfx = useCallback(() => {
    const cues = stateRef.current.sfx;
    if (!cues.length) return;
    if (propsRef.current.soundOn) {
      const seen = new Set<SfxCue>();
      for (const c of cues) {
        if (seen.has(c)) continue;
        seen.add(c);
        playCue(c);
      }
    }
    cues.length = 0;
  }, []);

  // --- Keyboard input ----------------------------------------------------
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const dir = KEY_DIR[e.key];
      if (!dir) return;
      if (e.key.startsWith("Arrow")) e.preventDefault();
      stateRef.current.desired = dir;
      // Grab the stick back from an AI driver the moment the player steers.
      if (propsRef.current.pacController !== "human") propsRef.current.onTakeControl();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // --- Reset on mount / resetKey -----------------------------------------
  useEffect(() => {
    stateRef.current = makeInitialState();
    stateRef.current.enabled = { ...propsRef.current.enabled };
    stateRef.current.enabledPellets = { ...propsRef.current.enabledPellets };
    stateRef.current.pacController = propsRef.current.pacController;
    stateRef.current.coordinated = propsRef.current.coordinated;
    timeRef.current = 0;
    hoverRef.current = null;
    onHover(null);
    emit();
    draw();
  }, [resetKey, emit, draw, onHover]);

  // Live ghost on/off toggles flow straight into the engine state.
  useEffect(() => {
    stateRef.current.enabled = { ...enabled };
    if (!propsRef.current.running || propsRef.current.explainMode) draw();
  }, [enabled, draw]);

  // Live board-content toggles flow straight into the engine state.
  useEffect(() => {
    stateRef.current.enabledPellets = { ...enabledPellets };
    emit();
    if (!propsRef.current.running || propsRef.current.explainMode) draw();
  }, [enabledPellets, emit, draw]);

  // Live driver changes flow into the engine; clear any stale AI plan.
  useEffect(() => {
    stateRef.current.pacController = pacController;
    if (pacController === "human") stateRef.current.pacPlan = null;
    if (!propsRef.current.running || propsRef.current.explainMode) draw();
  }, [pacController, draw]);

  // Live coordinated-mode toggle flows into the engine; clear any stale blackboard.
  useEffect(() => {
    stateRef.current.coordinated = coordinated;
    if (!coordinated) stateRef.current.blackboard = null;
    emit();
    if (!propsRef.current.running || propsRef.current.explainMode) draw();
  }, [coordinated, emit, draw]);

  // Mute/unmute the synth. Unmuting is a user gesture, so the AudioContext can
  // be resumed here without tripping the browser's autoplay policy.
  useEffect(() => {
    setMuted(!soundOn);
  }, [soundOn]);

  // Release the shared AudioContext when leaving the experiment.
  useEffect(() => () => closeAudio(), []);

  // --- Theme repaint -----------------------------------------------------
  useEffect(() => {
    paletteRef.current = readPalette();
    draw();
  }, [theme, draw]);

  // Repaint a static frame when display toggles change while paused.
  useEffect(() => {
    if (!propsRef.current.running) draw();
  }, [showOverlay, showPaths, showDanger, explainMode, reduced, draw]);

  // --- Animation loop ----------------------------------------------------
  useEffect(() => {
    // Freeze the simulation in explain mode (hover to inspect a frozen frame).
    if (!running || explainMode) {
      draw();
      stopSiren(); // no ambient siren while paused / inspecting
      return;
    }
    let raf = 0;
    let stopped = false;
    let last = performance.now();
    let acc = 0;
    let snapAcc = 0;

    function frame(now: number) {
      if (stopped) return;
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.1) dt = 0.1; // avoid spiral of death after a tab switch
      timeRef.current += dt;
      acc += dt;
      while (acc >= FIXED_DT) {
        step(stateRef.current, FIXED_DT);
        acc -= FIXED_DT;
      }
      drainSfx();
      draw();
      const st = stateRef.current;
      if (st.status === "playing") setSiren(sirenLevel(st), st.frightTime > 0);
      else stopSiren();
      snapAcc += dt * 1000;
      if (snapAcc >= SNAPSHOT_INTERVAL) {
        snapAcc = 0;
        emit();
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stopSiren();
    };
  }, [running, explainMode, draw, emit, drainSfx]);

  // --- Sizing ------------------------------------------------------------
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    let pending = 0;
    const apply = () => {
      pending = 0;
      const r = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const tile = Math.max(6, Math.floor(r.width / COLS));
      tileRef.current = tile;
      dprRef.current = dpr;
      const cssW = tile * COLS;
      const cssH = tile * ROWS;
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      // draw() sets its own transform (tile scale * dpr) each frame.
      draw();
    };
    const ro = new ResizeObserver(() => {
      if (pending) return;
      pending = requestAnimationFrame(apply);
    });
    ro.observe(wrap);
    return () => {
      if (pending) cancelAnimationFrame(pending);
      ro.disconnect();
    };
  }, [draw]);

  // --- Pointer (hover for explain + swipe to steer) ----------------------
  const toTile = useCallback((e: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const tile = tileRef.current;
    return {
      col: Math.floor(((e.clientX - rect.left) / rect.width) * COLS),
      row: Math.floor(((e.clientY - rect.top) / rect.height) * ROWS),
      px: e.clientX - rect.left,
      py: e.clientY - rect.top,
      tile,
    };
  }, []);

  const handleMove = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!propsRef.current.explainMode) return;
      const pos = toTile(e);
      if (!pos) return;
      let found: GhostId | null = null;
      let bestD = 1.6 * 1.6;
      for (const g of stateRef.current.ghosts) {
        if (!stateRef.current.enabled[g.id]) continue; // ignore switched-off ghosts
        const gt = tileOf(g);
        const d = (gt.col - pos.col) ** 2 + (gt.row - pos.row) ** 2;
        if (d < bestD) {
          bestD = d;
          found = g.id;
        }
      }
      if (found !== hoverRef.current) {
        hoverRef.current = found;
        onHover(found);
        draw();
      }
    },
    [toTile, onHover, draw],
  );

  const handleLeave = useCallback(() => {
    if (hoverRef.current !== null) {
      hoverRef.current = null;
      onHover(null);
      if (!propsRef.current.running || propsRef.current.explainMode) draw();
    }
  }, [onHover, draw]);

  const handleDown = useCallback((e: ReactPointerEvent<HTMLCanvasElement>) => {
    swipeRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleUp = useCallback((e: ReactPointerEvent<HTMLCanvasElement>) => {
    const start = swipeRef.current;
    swipeRef.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
    const dir: Direction =
      Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
    stateRef.current.desired = dir;
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      step() {
        step(stateRef.current, FIXED_DT);
        timeRef.current += FIXED_DT;
        drainSfx();
        emit();
        draw();
      },
      reset() {
        stateRef.current = makeInitialState();
        stateRef.current.enabled = { ...propsRef.current.enabled };
        stateRef.current.enabledPellets = { ...propsRef.current.enabledPellets };
        stateRef.current.pacController = propsRef.current.pacController;
        stateRef.current.coordinated = propsRef.current.coordinated;
        timeRef.current = 0;
        hoverRef.current = null;
        onHover(null);
        emit();
        draw();
      },
    }),
    [emit, draw, onHover, drainSfx],
  );

  return (
    <div className="pacman-stage" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        className="pacman-canvas"
        aria-label={t("experiments.pacman.canvas_aria")}
        onPointerMove={handleMove}
        onPointerLeave={handleLeave}
        onPointerDown={handleDown}
        onPointerUp={handleUp}
      />
    </div>
  );
});

export default PacmanCanvas;
