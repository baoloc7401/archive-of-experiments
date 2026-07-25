import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useTranslation } from "@/hooks/useTranslation";
import type { Theme } from "@/hooks/useTheme";
import type { BoidParams, BoidSnapshot, Flock, Pointer, World } from "../types";
import { FLOW_DRIFT, FOCUS_PICK_RADIUS, MAX_COUNT, OBSTACLE_RADIUS, STATS_INTERVAL, TWO_PI } from "../constants";
import { makeFlock, placeFormation, setVelocity } from "../flock";
import { readPalette, type Palette } from "../palette";
import {
  computeSnapshot,
  makeScratch,
  stepBoids,
  wrapDelta,
  type Scratch,
} from "../simulation";
import { drawScene } from "../render";

interface Props {
  params: BoidParams;
  running: boolean;
  reduced: boolean;
  theme: Theme;
  /** Bumping this re-scatters the flock and clears the world. */
  resetKey: number;
  onStats: (s: BoidSnapshot) => void;
}

export interface BoidsHandle {
  /** Advance the simulation exactly one frame (used while paused). */
  step: () => void;
  /** Save the current canvas as a PNG download. */
  exportPng: () => void;
  /** Remove all obstacles and goal waypoints. */
  clearMarks: () => void;
}

const BoidsCanvas = forwardRef<BoidsHandle, Props>(function BoidsCanvas(
  { params, running, reduced, theme, resetKey, onStats },
  ref,
) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // All mutable sim state lives in refs so the rAF loop never re-renders React;
  // only the throttled telemetry snapshot flows up via onStats.
  const flockRef = useRef<Flock>(makeFlock(MAX_COUNT));
  const scratchRef = useRef<Scratch>(makeScratch(MAX_COUNT));
  const worldRef = useRef<World>({ obstacles: [], goals: [], goalIndex: 0, predators: [] });
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const paletteRef = useRef<Palette>(readPalette());
  const fpsRef = useRef(60);
  const timeRef = useRef(0);
  const focusRef = useRef(-1);
  const pointerRef = useRef<Pointer>({ x: 0, y: 0, active: false });
  const propsRef = useRef({ params, running, reduced, theme, onStats });
  propsRef.current = { params, running, reduced, theme, onStats };

  const seed = useCallback((count: number) => {
    const flock = flockRef.current;
    const n = Math.min(count, flock.capacity);
    const pr = propsRef.current.params;
    const { w, h } = sizeRef.current;
    for (let i = 0; i < n; i++) {
      setVelocity(flock, i, pr.maxSpeed);
      flock.species[i] = i % pr.speciesCount;
    }
    flock.count = n;
    placeFormation(flock, pr.seedMode, w || 800, h || 600);
  }, []);

  const syncCount = useCallback((count: number) => {
    const flock = flockRef.current;
    const n = Math.min(count, flock.capacity);
    if (n > flock.count) {
      const pr = propsRef.current.params;
      const { w, h } = sizeRef.current;
      const ww = w || 800;
      const hh = h || 600;
      for (let i = flock.count; i < n; i++) {
        setVelocity(flock, i, pr.maxSpeed);
        flock.x[i] = Math.random() * ww;
        flock.y[i] = Math.random() * hh;
        flock.species[i] = i % pr.speciesCount;
      }
    }
    flock.count = n;
  }, []);

  const syncPredators = useCallback((count: number) => {
    const world = worldRef.current;
    const { w, h } = sizeRef.current;
    const ms = propsRef.current.params.maxSpeed;
    while (world.predators.length < count) {
      const a = Math.random() * TWO_PI;
      world.predators.push({
        x: Math.random() * (w || 800),
        y: Math.random() * (h || 600),
        vx: Math.cos(a) * ms,
        vy: Math.sin(a) * ms,
      });
    }
    if (world.predators.length > count) world.predators.length = count;
  }, []);

  const emitStats = useCallback(() => {
    propsRef.current.onStats(computeSnapshot(flockRef.current, fpsRef.current));
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { w, h, dpr } = sizeRef.current;
    if (w === 0 || h === 0) return;
    drawScene({
      ctx,
      w,
      h,
      dpr,
      palette: paletteRef.current,
      params: propsRef.current.params,
      reduced: propsRef.current.reduced,
      theme: propsRef.current.theme,
      flock: flockRef.current,
      density: scratchRef.current.density,
      world: worldRef.current,
      pointer: pointerRef.current,
      focusIdx: focusRef.current,
    });
  }, []);

  const toCanvas = useCallback((e: ReactPointerEvent<HTMLCanvasElement>): [number, number] | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const { w, h } = sizeRef.current;
    if (w === 0 || h === 0) return null;
    const rect = canvas.getBoundingClientRect();
    return [((e.clientX - rect.left) / rect.width) * w, ((e.clientY - rect.top) / rect.height) * h];
  }, []);

  const handleMove = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      const pt = toCanvas(e);
      if (!pt) return;
      const [px, py] = pt;
      const ptr = pointerRef.current;
      ptr.x = px;
      ptr.y = py;
      // Pin the nearest boid for the rule overlay.
      const { w, h } = sizeRef.current;
      const flock = flockRef.current;
      const { x, y } = flock;
      let best = -1;
      let bestD = FOCUS_PICK_RADIUS * FOCUS_PICK_RADIUS;
      for (let i = 0; i < flock.count; i++) {
        const dx = wrapDelta(x[i] - px, w);
        const dy = wrapDelta(y[i] - py, h);
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD) {
          bestD = d2;
          best = i;
        }
      }
      focusRef.current = best;
      if (!propsRef.current.running) draw();
    },
    [toCanvas, draw],
  );

  const handleDown = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      const pt = toCanvas(e);
      if (!pt) return;
      const [px, py] = pt;
      const tool = propsRef.current.params.pointerTool;
      const world = worldRef.current;
      if (tool === "push") {
        const ptr = pointerRef.current;
        ptr.x = px;
        ptr.y = py;
        ptr.active = true;
        e.currentTarget.setPointerCapture(e.pointerId);
      } else if (tool === "obstacle") {
        // Click an existing obstacle to remove it, else drop a new one.
        const hit = world.obstacles.findIndex((o) => Math.hypot(o.x - px, o.y - py) < o.r);
        if (hit >= 0) world.obstacles.splice(hit, 1);
        else world.obstacles.push({ x: px, y: py, r: OBSTACLE_RADIUS });
      } else {
        world.goals.push({ x: px, y: py });
      }
      if (!propsRef.current.running) draw();
    },
    [toCanvas, draw],
  );

  const endPointer = useCallback(() => {
    const ptr = pointerRef.current;
    if (ptr.active) {
      ptr.active = false;
      if (!propsRef.current.running) draw();
    }
  }, [draw]);

  const handleLeave = useCallback(() => {
    pointerRef.current.active = false;
    if (focusRef.current !== -1) focusRef.current = -1;
    if (!propsRef.current.running) draw();
  }, [draw]);

  // Re-scatter the flock and clear the world on mount and on reset.
  useEffect(() => {
    const world = worldRef.current;
    world.obstacles = [];
    world.goals = [];
    world.goalIndex = 0;
    world.predators = [];
    seed(propsRef.current.params.count);
    syncPredators(propsRef.current.params.predatorCount);
    emitStats();
    draw();
  }, [resetKey, seed, syncPredators, emitStats, draw]);

  // Re-seed when the formation changes.
  useEffect(() => {
    seed(propsRef.current.params.count);
    emitStats();
    draw();
  }, [params.seedMode, seed, emitStats, draw]);

  // Match the count slider without disturbing the rest.
  useEffect(() => {
    syncCount(params.count);
    if (!propsRef.current.running) draw();
  }, [params.count, syncCount, draw]);

  // Reassign factions when the species count changes.
  useEffect(() => {
    const flock = flockRef.current;
    for (let i = 0; i < flock.count; i++) flock.species[i] = i % params.speciesCount;
    if (!propsRef.current.running) draw();
  }, [params.speciesCount, draw]);

  // Spawn/trim predators to match the slider.
  useEffect(() => {
    syncPredators(params.predatorCount);
    if (!propsRef.current.running) draw();
  }, [params.predatorCount, syncPredators, draw]);

  // Re-read theme tokens when the theme flips, then repaint if idle.
  useEffect(() => {
    paletteRef.current = readPalette();
    if (!propsRef.current.running) draw();
  }, [theme, draw]);

  // Repaint a static frame when params or reduced-motion change while paused.
  useEffect(() => {
    if (!propsRef.current.running) draw();
  }, [params, reduced, draw]);

  // --- Animation loop ----------------------------------------------------
  useEffect(() => {
    if (!running) {
      draw();
      return;
    }
    let raf = 0;
    let stopped = false;
    let last = performance.now();
    let acc = 0;

    function frame(now: number) {
      if (stopped) return;
      const dt = now - last;
      last = now;
      if (dt > 0) fpsRef.current = fpsRef.current * 0.9 + (1000 / dt) * 0.1;
      timeRef.current += (dt / 1000) * FLOW_DRIFT;
      const { w, h } = sizeRef.current;
      if (w > 0 && h > 0) {
        stepBoids(flockRef.current, propsRef.current.params, w, h, pointerRef.current, scratchRef.current, worldRef.current, timeRef.current);
      }
      draw();
      acc += dt;
      if (acc >= STATS_INTERVAL) {
        acc = 0;
        emitStats();
      }
      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, [running, draw, emitStats]);

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
      const bw = Math.round(r.width * dpr);
      const bh = Math.round(r.height * dpr);
      if (bw === canvas.width && bh === canvas.height) return;
      const hadSize = sizeRef.current.w > 0;
      sizeRef.current = { w: r.width, h: r.height, dpr };
      canvas.width = bw;
      canvas.height = bh;
      // First real measurement: lay the flock out in its formation at true size.
      if (!hadSize) placeFormation(flockRef.current, propsRef.current.params.seedMode, r.width, r.height);
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

  useImperativeHandle(
    ref,
    () => ({
      step() {
        const { w, h } = sizeRef.current;
        timeRef.current += 0.016 * FLOW_DRIFT;
        if (w > 0 && h > 0) {
          stepBoids(flockRef.current, propsRef.current.params, w, h, pointerRef.current, scratchRef.current, worldRef.current, timeRef.current);
        }
        emitStats();
        draw();
      },
      exportPng() {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "boids.png";
          a.click();
          URL.revokeObjectURL(url);
        });
      },
      clearMarks() {
        const world = worldRef.current;
        world.obstacles = [];
        world.goals = [];
        world.goalIndex = 0;
        if (!propsRef.current.running) draw();
      },
    }),
    [emitStats, draw],
  );

  return (
    <div className="boids-stage" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        className="boids-canvas"
        aria-label={t("experiments.boids.canvas_aria")}
        onPointerMove={handleMove}
        onPointerDown={handleDown}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onPointerLeave={handleLeave}
      />
    </div>
  );
});

export default BoidsCanvas;
