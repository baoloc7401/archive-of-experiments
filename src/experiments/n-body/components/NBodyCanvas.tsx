import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useTranslation } from "react-i18next";
import ScrambleText from "../../../components/ScrambleText";
import type { Theme } from "../../../hooks/useTheme";
import type { NBodyParams, NBodySnapshot, View } from "../types";
import {
  CAM_DIST,
  CAM_FAR,
  CAM_FOV,
  CAM_NEAR,
  ENTRY_MS,
  FOLLOW_LERP,
  INERTIA_DAMPING,
  MAX_COUNT,
  MAX_SUBSTEPS_PER_FRAME,
  MAX_ZOOM,
  MIN_ZOOM,
  PICK_RADIUS,
  PITCH_LIMIT,
  SPIN_RATE,
  STATS_INTERVAL,
  SUBSTEP,
  TRAIL_K,
  TRAIL_SAMPLE_DT,
} from "../constants";
import { mat4, multiply, orbitView, perspective, projectToScreen } from "../mat4";
import {
  advance,
  captureBaseline,
  kineticEnergy,
  makeBodies,
  makeScratch,
  makeSim,
  meanSpeed,
  stepOnce,
  totalEnergy,
  type FollowBox,
} from "../physics";
import { seed } from "../presets";
import { readPalette, type Palette } from "../palette";
import { createRenderer, type NBodyRenderer } from "../renderer";
import { createGpuSolver, type GpuSolver } from "../gpu/solver";

interface Props {
  params: NBodyParams;
  running: boolean;
  reduced: boolean;
  theme: Theme;
  /** Bumping this re-seeds the scene and recenters the camera target. */
  resetKey: number;
  onStats: (s: NBodySnapshot) => void;
}

export interface NBodyHandle {
  /** Advance the simulation exactly one substep (used while paused). */
  step: () => void;
  /** Re-center the orbit camera and release any followed body. */
  resetView: () => void;
  /** Save the current frame as a PNG download. */
  exportPng: () => void;
}

const DEFAULT_VIEW: View = { yaw: 0.55, pitch: 0.28, zoom: 1 };

interface PointerState {
  x: number;
  y: number;
  startX: number;
  startY: number;
  moved: boolean;
}

const NBodyCanvas = forwardRef<NBodyHandle, Props>(function NBodyCanvas(
  { params, running, reduced, theme, resetKey, onStats },
  ref,
) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [glFailed, setGlFailed] = useState(false);

  // All mutable sim state lives in refs so the rAF loop never re-renders
  // React; only the throttled telemetry snapshot flows up via onStats.
  const bodiesRef = useRef(makeBodies(MAX_COUNT));
  const scratchRef = useRef(makeScratch(MAX_COUNT));
  const simRef = useRef(makeSim());
  const rendererRef = useRef<NBodyRenderer | null>(null);
  // WebGPU compute solver (opt-in, big scenes): owns the bodies on the GPU and
  // reads them back into bodiesRef each frame. Null until the async device
  // request resolves, or when WebGPU is unavailable.
  const gpuRef = useRef<GpuSolver | null>(null);
  // Set whenever the GPU buffers need the current CPU bodies re-uploaded (mode
  // switch, reseed, or the device finishing init).
  const gpuNeedsUploadRef = useRef(false);
  const viewRef = useRef<View>({ ...DEFAULT_VIEW });
  const targetRef = useRef({ x: 0, y: 0, z: 0 });
  const followRef = useRef<FollowBox>({ idx: -1 });
  const inertiaRef = useRef({ yaw: 0, pitch: 0 });
  const pointersRef = useRef(new Map<number, PointerState>());
  const pinchRef = useRef<{ d0: number; zoom0: number } | null>(null);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const paletteRef = useRef<Palette>(readPalette());
  const fpsRef = useRef(60);
  const statsAccRef = useRef(0);
  /** Sim time of the newest trail sample. */
  const trailClockRef = useRef(0);
  const entryRef = useRef(0);
  const speedScaleRef = useRef(1);
  const massRangeRef = useRef({ logMin: 0, invRange: 1 });
  const matsRef = useRef({ proj: mat4(), view: mat4(), mvp: mat4(), starView: mat4(), starMvp: mat4() });
  const loopRef = useRef(0);
  const lastRef = useRef(0);
  const propsRef = useRef({ params, running, reduced, theme, onStats });
  propsRef.current = { params, running, reduced, theme, onStats };

  const recomputeMassRange = useCallback(() => {
    const b = bodiesRef.current;
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < b.count; i++) {
      if (b.mass[i] < min) min = b.mass[i];
      if (b.mass[i] > max) max = b.mass[i];
    }
    if (!(min > 0)) min = 1e-9;
    if (!(max > 0)) max = 1;
    const logMin = Math.log(min);
    const range = Math.log(max) - logMin;
    massRangeRef.current = { logMin, invRange: 1 / Math.max(range, 1e-6) };
  }, []);

  /** Entry-fade brightness in 0..1 (1 = settled). */
  const entryEase = useCallback(() => {
    if (propsRef.current.reduced || entryRef.current === 0) return 1;
    const u = Math.min(1, (performance.now() - entryRef.current) / ENTRY_MS);
    if (u >= 1) entryRef.current = 0;
    return 1 - Math.pow(1 - u, 3);
  }, []);

  const draw = useCallback(() => {
    const renderer = rendererRef.current;
    const { w, h, dpr } = sizeRef.current;
    if (!renderer || w === 0 || h === 0) return;
    const { params: p, reduced: red } = propsRef.current;
    const view = viewRef.current;
    const tgt = targetRef.current;
    const mats = matsRef.current;
    const entry = entryEase();
    const dist = (CAM_DIST / view.zoom) * (1 + 0.1 * (1 - entry));
    orbitView(mats.view, view.yaw, view.pitch, dist, tgt.x, tgt.y, tgt.z);
    multiply(mats.mvp, mats.proj, mats.view);
    orbitView(mats.starView, view.yaw, view.pitch, dist, 0, 0, 0);
    multiply(mats.starMvp, mats.proj, mats.starView);

    const b = bodiesRef.current;
    const fi = followRef.current.idx;
    let ring: { x: number; y: number; z: number; sizePx: number; alpha: number } | null = null;
    if (fi >= 0 && fi < b.count) {
      const bodyPx = (0.19 * h * dpr * Math.cbrt(b.mass[fi])) / dist;
      const pulse = red ? 0 : (Math.sin(performance.now() * 0.004) + 1) / 2;
      ring = {
        x: b.x[fi],
        y: b.y[fi],
        z: b.z[fi],
        sizePx: Math.max(bodyPx * 2.4, 26 * dpr) + pulse * 6 * dpr,
        alpha: 0.8 * entry,
      };
    }

    renderer.draw({
      count: b.count,
      mvp: mats.mvp,
      starMvp: mats.starMvp,
      palette: paletteRef.current,
      dark: propsRef.current.theme === "dark",
      colorMode: p.colorMode,
      trailSegs:
        p.trails > 0 ? Math.min(TRAIL_K - 1, Math.round(p.trails / TRAIL_SAMPLE_DT)) : 0,
      brightness: entry,
      speedScale: speedScaleRef.current,
      massLogMin: massRangeRef.current.logMin,
      massLogInvRange: massRangeRef.current.invRange,
      camDist: dist,
      dpr,
      ring,
    });
  }, [entryEase]);

  const emitStats = useCallback(() => {
    const b = bodiesRef.current;
    const s = scratchRef.current;
    const sim = simRef.current;
    const v = viewRef.current;
    const sz = sizeRef.current;
    const fi = followRef.current.idx;
    const ke = kineticEnergy(b);
    const total = totalEnergy(b, s);
    const n = b.count;
    const exact = (n * (n - 1)) / 2;
    const gpu = gpuRef.current;
    const gpuActive = propsRef.current.params.compute === "gpu" && gpu !== null && !gpu.lost;
    // GPU mode sums every pair exactly, so it does the full n^2 work.
    const evals = gpuActive ? exact : s.evals;
    const evalsPct = gpuActive ? 100 : exact > 0 ? (s.evals / exact) * 100 : 0;
    // Smoothed speed normalization for the shader's colour ramp.
    const ms = meanSpeed(b);
    if (ms > 0) {
      const target = 1 / (2.2 * ms);
      speedScaleRef.current += (target - speedScaleRef.current) * 0.25;
    }
    propsRef.current.onStats({
      count: n,
      fps: fpsRef.current,
      evals,
      evalsPct,
      gpuActive,
      kinetic: ke,
      total,
      drift: sim.e0 !== 0 ? (total - sim.e0) / Math.abs(sim.e0) : 0,
      simTime: sim.simTime,
      follow: fi,
      followMass: fi >= 0 && fi < b.count ? b.mass[fi] : 0,
      followSpeed:
        fi >= 0 && fi < b.count
          ? Math.hypot(b.vx[fi], b.vy[fi], b.vz[fi])
          : 0,
      yaw: v.yaw,
      pitch: v.pitch,
      zoom: v.zoom,
      w: sz.w,
      h: sz.h,
      dpr: sz.dpr,
      gpu: rendererRef.current?.gpu ?? "",
    });
  }, []);

  /**
   * Record trail samples on a fixed sim-time cadence so trail length is a
   * span of motion, not of wall clock: paused time leaves trails untouched.
   */
  const sampleTrails = useCallback(() => {
    const sim = simRef.current;
    const renderer = rendererRef.current;
    if (!renderer) return;
    // After a stall (tab hidden, slider drag), skip ahead instead of looping.
    if (sim.simTime - trailClockRef.current > TRAIL_SAMPLE_DT * 4) {
      trailClockRef.current = sim.simTime - TRAIL_SAMPLE_DT;
    }
    while (sim.simTime - trailClockRef.current >= TRAIL_SAMPLE_DT) {
      trailClockRef.current += TRAIL_SAMPLE_DT;
      renderer.pushTrailSample(bodiesRef.current);
    }
  }, []);

  /** Whether anything still animates (the loop parks itself when not). */
  const needsLoop = useCallback(() => {
    const inertia = inertiaRef.current;
    const tgt = targetRef.current;
    const b = bodiesRef.current;
    const fi = followRef.current.idx;
    // The camera target still easing toward its goal (a body, or back home).
    const gx = fi >= 0 && fi < b.count ? b.x[fi] : 0;
    const gy = fi >= 0 && fi < b.count ? b.y[fi] : 0;
    const gz = fi >= 0 && fi < b.count ? b.z[fi] : 0;
    const settling =
      Math.abs(tgt.x - gx) + Math.abs(tgt.y - gy) + Math.abs(tgt.z - gz) > 1e-4;
    return (
      propsRef.current.running ||
      entryRef.current !== 0 ||
      Math.abs(inertia.yaw) + Math.abs(inertia.pitch) > 5e-4 ||
      settling
    );
  }, []);

  const frame = useCallback(
    (now: number) => {
      loopRef.current = 0;
      const dtMs = lastRef.current > 0 ? now - lastRef.current : 16.7;
      lastRef.current = now;
      if (dtMs > 0) fpsRef.current = fpsRef.current * 0.9 + (1000 / Math.max(dtMs, 1)) * 0.1;
      const dt = Math.min(dtMs, 100) / 1000;
      const { params: p, running: run, reduced: red } = propsRef.current;
      const b = bodiesRef.current;

      if (run) {
        const gpu = gpuRef.current;
        if (p.compute === "gpu" && gpu && !gpu.lost) {
          // GPU path: the solver owns the bodies; we just accumulate substeps
          // (mirroring advance()'s timing), step the device, and read back a
          // copy for rendering. No Barnes-Hut, no merging - brute-force leapfrog.
          if (gpuNeedsUploadRef.current) {
            gpu.upload(b);
            gpuNeedsUploadRef.current = false;
          }
          const sim = simRef.current;
          const h = p.substep ?? SUBSTEP;
          sim.acc += Math.min(dtMs, 100) * 0.001 * p.timeScale;
          let steps = 0;
          while (sim.acc >= h && steps < MAX_SUBSTEPS_PER_FRAME) {
            sim.acc -= h;
            steps++;
          }
          let stepH = h;
          if (steps === 0 && sim.acc > 0) {
            // Slow-motion sliver: one sub-substep step so motion stays fluid.
            stepH = sim.acc;
            sim.acc = 0;
            steps = 1;
          } else if (steps === MAX_SUBSTEPS_PER_FRAME && sim.acc > h) {
            sim.acc = 0;
          }
          if (steps > 0) {
            gpu.step(stepH, steps, p.gravity, p.softening * p.softening);
            sim.simTime += stepH * steps;
          }
          if (gpu.readInto(b)) {
            rendererRef.current?.upload(b, false);
            sampleTrails();
          }
        } else {
          const res = advance(b, p, scratchRef.current, simRef.current, dtMs, followRef.current);
          if (res.merged > 0) {
            recomputeMassRange();
            rendererRef.current?.upload(b, true);
          } else if (res.steps > 0) {
            rendererRef.current?.upload(b, false);
          }
          if (res.steps > 0) sampleTrails();
        }
      }

      // Camera transients: auto-spin, drag inertia, follow-target ease.
      const view = viewRef.current;
      const dragging = pointersRef.current.size > 0;
      if (run && p.spin && !red && !dragging) view.yaw += SPIN_RATE * dt;
      const inertia = inertiaRef.current;
      if (!dragging && (inertia.yaw !== 0 || inertia.pitch !== 0)) {
        view.yaw += inertia.yaw * dt;
        view.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, view.pitch + inertia.pitch * dt));
        const damp = Math.exp(-INERTIA_DAMPING * dt);
        inertia.yaw *= damp;
        inertia.pitch *= damp;
        if (Math.abs(inertia.yaw) + Math.abs(inertia.pitch) < 5e-4) {
          inertia.yaw = 0;
          inertia.pitch = 0;
        }
      }
      const fi = followRef.current.idx;
      const tgt = targetRef.current;
      const gx = fi >= 0 && fi < b.count ? b.x[fi] : 0;
      const gy = fi >= 0 && fi < b.count ? b.y[fi] : 0;
      const gz = fi >= 0 && fi < b.count ? b.z[fi] : 0;
      const k = red ? 1 : Math.min(1, FOLLOW_LERP * dt);
      tgt.x += (gx - tgt.x) * k;
      tgt.y += (gy - tgt.y) * k;
      tgt.z += (gz - tgt.z) * k;

      draw();

      statsAccRef.current += dtMs;
      if (statsAccRef.current >= STATS_INTERVAL) {
        statsAccRef.current = 0;
        emitStats();
      }

      if (needsLoop()) {
        loopRef.current = requestAnimationFrame(frame);
      } else {
        lastRef.current = 0;
      }
    },
    [draw, emitStats, needsLoop, recomputeMassRange, sampleTrails],
  );

  /** Start the loop if something now animates; otherwise just repaint once. */
  const wake = useCallback(() => {
    if (needsLoop()) {
      if (loopRef.current === 0) {
        lastRef.current = 0;
        loopRef.current = requestAnimationFrame(frame);
      }
    } else {
      draw();
    }
  }, [needsLoop, frame, draw]);

  const reseed = useCallback(() => {
    const b = bodiesRef.current;
    const p = propsRef.current.params;
    seed(b, p.preset, p.count);
    const sim = simRef.current;
    sim.simTime = 0;
    sim.acc = 0;
    captureBaseline(b, p, scratchRef.current, sim);
    followRef.current.idx = -1;
    targetRef.current = { x: 0, y: 0, z: 0 };
    inertiaRef.current = { yaw: 0, pitch: 0 };
    const ms = meanSpeed(b);
    speedScaleRef.current = ms > 0 ? 1 / (2.2 * ms) : 1;
    recomputeMassRange();
    // The GPU solver holds its own copy of the bodies; a reseed must re-upload.
    gpuNeedsUploadRef.current = true;
    const renderer = rendererRef.current;
    trailClockRef.current = 0;
    if (renderer) {
      renderer.upload(b, true);
      renderer.resetTrails();
      renderer.pushTrailSample(b);
      renderer.clear(paletteRef.current.bg);
    }
    entryRef.current = propsRef.current.reduced ? 0 : performance.now();
    statsAccRef.current = 0;
    emitStats();
    wake();
  }, [recomputeMassRange, emitStats, wake]);

  // --- Renderer lifecycle --------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // The availability callback fires on context loss/restore (possibly long
    // after mount): it swaps the fallback notice in and out, and on restore
    // pushes the scene back into the recreated GPU buffers.
    const renderer = createRenderer(canvas, MAX_COUNT, (ok) => {
      setGlFailed(!ok);
      if (ok) {
        const r = rendererRef.current;
        const b = bodiesRef.current;
        if (r && b.count > 0) {
          r.upload(b, true);
          r.clear(paletteRef.current.bg);
          wake();
        }
      }
    });
    if (!renderer) {
      setGlFailed(true);
      return;
    }
    rendererRef.current = renderer;
    setGlFailed(false);
    // The seeding effect may have run against a dead renderer (StrictMode
    // remount): push the current scene into the fresh GPU buffers.
    const b = bodiesRef.current;
    if (b.count > 0) {
      renderer.upload(b, true);
      renderer.clear(paletteRef.current.bg);
      draw();
    }
    return () => {
      // Cancel the rAF loop before disposing so StrictMode re-mount (and
      // regular unmount) starts fresh rather than leaving a dangling loop that
      // races the new renderer.
      if (loopRef.current !== 0) {
        cancelAnimationFrame(loopRef.current);
        loopRef.current = 0;
      }
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [draw, wake]);

  // --- WebGPU compute solver lifecycle (opt-in) ----------------------------
  useEffect(() => {
    let cancelled = false;
    createGpuSolver(MAX_COUNT, () => {
      // Device lost: drop to the CPU path and let it recompute accelerations.
      gpuRef.current = null;
      simRef.current.accelValid = false;
      wake();
    }).then((solver) => {
      if (cancelled || !solver) {
        solver?.destroy();
        return;
      }
      gpuRef.current = solver;
      gpuNeedsUploadRef.current = true;
      wake();
    });
    return () => {
      cancelled = true;
      gpuRef.current?.destroy();
      gpuRef.current = null;
    };
  }, [wake]);

  // Switching engines: re-upload to the GPU on entering GPU mode, and force the
  // CPU to recompute accelerations on returning (the GPU moved the bodies).
  useEffect(() => {
    if (params.compute === "gpu") gpuNeedsUploadRef.current = true;
    simRef.current.accelValid = false;
    wake();
  }, [params.compute, wake]);

  // Re-seed on mount, on reset, and when the scene or its size changes.
  useEffect(() => {
    reseed();
  }, [resetKey, params.preset, params.count, reseed]);

  // Physics params invalidate cached accelerations (and pair collection).
  useEffect(() => {
    simRef.current.accelValid = false;
  }, [params.gravity, params.softening, params.theta, params.integrator, params.merging]);

  // Re-read theme tokens when the theme flips; clear so trails restain.
  useEffect(() => {
    paletteRef.current = readPalette();
    rendererRef.current?.clear(paletteRef.current.bg);
    draw();
  }, [theme, draw]);

  // Repaint a static frame when look params change while parked.
  useEffect(() => {
    wake();
  }, [params.colorMode, params.trails, reduced, wake]);

  // Start/stop the loop with the transport.
  useEffect(() => {
    wake();
  }, [running, params.spin, params.timeScale, wake]);

  useEffect(() => {
    return () => {
      if (loopRef.current !== 0) cancelAnimationFrame(loopRef.current);
    };
  }, []);

  // --- Pointer: orbit drag, pinch zoom, click-to-follow -------------------
  const handleDown = useCallback((e: ReactPointerEvent<HTMLCanvasElement>) => {
    const map = pointersRef.current;
    map.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    });
    e.currentTarget.setPointerCapture(e.pointerId);
    if (map.size === 2) {
      const [a, c] = [...map.values()];
      pinchRef.current = { d0: Math.hypot(a.x - c.x, a.y - c.y) || 1, zoom0: viewRef.current.zoom };
    }
    inertiaRef.current = { yaw: 0, pitch: 0 };
  }, []);

  const handleMove = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      const map = pointersRef.current;
      const pt = map.get(e.pointerId);
      if (!pt) return;
      const dx = e.clientX - pt.x;
      const dy = e.clientY - pt.y;
      pt.x = e.clientX;
      pt.y = e.clientY;
      if (Math.hypot(pt.x - pt.startX, pt.y - pt.startY) > 6) pt.moved = true;

      if (map.size === 2 && pinchRef.current) {
        const [a, c] = [...map.values()];
        const d = Math.hypot(a.x - c.x, a.y - c.y) || 1;
        viewRef.current.zoom = Math.max(
          MIN_ZOOM,
          Math.min(MAX_ZOOM, pinchRef.current.zoom0 * (d / pinchRef.current.d0)),
        );
      } else if (map.size === 1) {
        const view = viewRef.current;
        view.yaw += dx * 0.01;
        view.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, view.pitch + dy * 0.01));
        // Remember the drag velocity so release carries momentum.
        if (!propsRef.current.reduced) {
          const inertia = inertiaRef.current;
          inertia.yaw = inertia.yaw * 0.4 + dx * 0.01 * 60 * 0.6;
          inertia.pitch = inertia.pitch * 0.4 + dy * 0.01 * 60 * 0.6;
        }
      }
      if (loopRef.current === 0) draw();
    },
    [draw],
  );

  const pick = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      const { w, h } = sizeRef.current;
      const b = bodiesRef.current;
      const m = matsRef.current.mvp;
      const out = { sx: 0, sy: 0, cw: 0 };
      let best = -1;
      let bestD = PICK_RADIUS * PICK_RADIUS;
      for (let i = 0; i < b.count; i++) {
        projectToScreen(m, b.x[i], b.y[i], b.z[i], w, h, out);
        if (out.cw <= 0) continue;
        const dx = out.sx - px;
        const dy = out.sy - py;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD) {
          bestD = d2;
          best = i;
        }
      }
      followRef.current.idx = best;
      if (propsRef.current.reduced && best >= 0) {
        // No lerp under reduced motion: snap the target.
        targetRef.current = { x: b.x[best], y: b.y[best], z: b.z[best] };
      }
      emitStats();
      wake();
    },
    [emitStats, wake],
  );

  const endPointer = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      const map = pointersRef.current;
      const pt = map.get(e.pointerId);
      map.delete(e.pointerId);
      if (map.size < 2) pinchRef.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      if (pt && !pt.moved) {
        inertiaRef.current = { yaw: 0, pitch: 0 };
        pick(e.clientX, e.clientY);
      } else if (pt) {
        wake();
      }
    },
    [pick, wake],
  );

  const cancelPointer = useCallback((e: ReactPointerEvent<HTMLCanvasElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
  }, []);

  // Wheel zoom (native listener so we can preventDefault the page scroll).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const view = viewRef.current;
      const factor = Math.exp(-e.deltaY * 0.0012);
      view.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, view.zoom * factor));
      if (loopRef.current === 0) draw();
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [draw]);

  // --- Sizing ---------------------------------------------------------------
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
      sizeRef.current = { w: r.width, h: r.height, dpr };
      canvas.width = bw;
      canvas.height = bh;
      perspective(matsRef.current.proj, CAM_FOV, bw / Math.max(bh, 1), CAM_NEAR, CAM_FAR);
      // Resizing wipes the drawing buffer, so trails restart from the bg.
      rendererRef.current?.clear(paletteRef.current.bg);
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
        const merged = stepOnce(
          bodiesRef.current,
          propsRef.current.params,
          scratchRef.current,
          simRef.current,
          followRef.current,
        );
        const renderer = rendererRef.current;
        if (renderer) renderer.upload(bodiesRef.current, merged > 0);
        if (merged > 0) recomputeMassRange();
        // A single paused step runs on the CPU even in GPU mode; re-sync the
        // GPU buffers so resuming continues from the stepped state.
        if (propsRef.current.params.compute === "gpu") gpuNeedsUploadRef.current = true;
        sampleTrails();
        emitStats();
        wake();
      },
      resetView() {
        viewRef.current = { ...DEFAULT_VIEW };
        followRef.current.idx = -1;
        inertiaRef.current = { yaw: 0, pitch: 0 };
        if (propsRef.current.reduced) targetRef.current = { x: 0, y: 0, z: 0 };
        emitStats();
        wake();
      },
      exportPng() {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "n-body.png";
          a.click();
          URL.revokeObjectURL(url);
        });
      },
    }),
    [emitStats, recomputeMassRange, sampleTrails, wake],
  );

  // The canvas stays mounted even while GL is unavailable: the notice sits on
  // top of it, so a restored context can resume without a remount.
  return (
    <div className="nb-stage" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        className="nb-canvas"
        aria-label={t("experiments.n-body.canvas_aria")}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={endPointer}
        onPointerCancel={cancelPointer}
      />
      {glFailed && (
        <div className="nb-fallback" role="alert">
          <ScrambleText text={t("experiments.n-body.webgl_fallback")} duration={600} />
        </div>
      )}
    </div>
  );
});

export default NBodyCanvas;
