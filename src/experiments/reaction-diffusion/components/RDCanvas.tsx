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
import type { RDParams, RDSnapshot } from "../types";
import { createSimulator, type RDSimulator } from "../simulation";

/** Min ms between debug-stat snapshots (readPixels stalls the pipeline). */
const STATS_INTERVAL = 400;

interface Props {
  params: RDParams;
  running: boolean;
  /** Bumping this re-seeds the field. */
  resetKey: number;
  onStats: (s: RDSnapshot) => void;
}

export interface RDHandle {
  /** Re-seed the field to the initial condition plus fresh V blobs. */
  reset: () => void;
  /** Advance the field one Gray-Scott step (used while paused). */
  step: () => void;
  /** Save the current frame as a PNG download. */
  exportPng: () => void;
}

const RDCanvas = forwardRef<RDHandle, Props>(function RDCanvas(
  { params, running, resetKey, onStats },
  ref,
) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [glFailed, setGlFailed] = useState(false);

  const simRef = useRef<RDSimulator | null>(null);
  const loopRef = useRef(0);
  const brushingRef = useRef(false);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const fpsRef = useRef(60);
  const lastTickRef = useRef(0);
  const lastStatsRef = useRef(0);
  // A props snapshot the rAF loop reads, so it never forces a React re-render.
  const propsRef = useRef({ params, running, onStats });
  propsRef.current = { params, running, onStats };

  /** Push a debug snapshot, self-throttled unless forced (readPixels is slow). */
  const emitStats = useCallback((force = false) => {
    const sim = simRef.current;
    if (!sim) return;
    const now = performance.now();
    if (!force && now - lastStatsRef.current < STATS_INTERVAL) return;
    lastStatsRef.current = now;
    const sz = sizeRef.current;
    const field = sim.sampleField();
    propsRef.current.onStats({
      fps: fpsRef.current,
      w: sz.w,
      h: sz.h,
      dpr: sz.dpr,
      simW: sim.width,
      simH: sim.height,
      gpu: sim.gpu,
      floatExt: sim.floatExt,
      steps: sim.steps,
      ...field,
    });
  }, []);

  const renderOnce = useCallback(() => {
    simRef.current?.render(propsRef.current.params);
    emitStats();
  }, [emitStats]);

  const frame = useCallback(() => {
    loopRef.current = 0;
    const sim = simRef.current;
    if (!sim) return;
    const now = performance.now();
    const dt = lastTickRef.current > 0 ? now - lastTickRef.current : 16.7;
    lastTickRef.current = now;
    if (dt > 0) fpsRef.current = fpsRef.current * 0.9 + (1000 / Math.max(dt, 1)) * 0.1;
    const { params: p, running: run } = propsRef.current;
    if (run) sim.step(p, p.stepsPerFrame);
    sim.render(p);
    emitStats();
    if (run) {
      loopRef.current = requestAnimationFrame(frame);
    } else {
      lastTickRef.current = 0;
    }
  }, [emitStats]);

  /** Start the loop if running; otherwise just repaint a static frame. */
  const wake = useCallback(() => {
    if (propsRef.current.running) {
      if (loopRef.current === 0) loopRef.current = requestAnimationFrame(frame);
    } else {
      renderOnce();
    }
  }, [frame, renderOnce]);

  // Map a client point to brush texture space and raise V there.
  const brushAt = useCallback(
    (clientX: number, clientY: number) => {
      const sim = simRef.current;
      const canvas = canvasRef.current;
      if (!sim || !canvas) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const u = (clientX - rect.left) / rect.width;
      // Flip Y: texture/display space has its origin at the bottom-left.
      const v = 1 - (clientY - rect.top) / rect.height;
      sim.splat(u, v, propsRef.current.params.brushSize);
      // While paused there is no loop to show the stroke, so repaint now.
      if (!propsRef.current.running) renderOnce();
    },
    [renderOnce],
  );

  // --- Simulator lifecycle -------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const sim = createSimulator(canvas, (ok) => {
      setGlFailed(!ok);
      if (ok) wake();
    });
    if (!sim) {
      setGlFailed(true);
      return;
    }
    simRef.current = sim;
    // Record the resolution scale before the first resize allocates the grid.
    sim.setResolution(propsRef.current.params.resolution);
    setGlFailed(false);
    return () => {
      if (loopRef.current !== 0) {
        cancelAnimationFrame(loopRef.current);
        loopRef.current = 0;
      }
      sim.dispose();
      simRef.current = null;
    };
  }, [wake]);

  // --- Sizing: keep the grid matched to the canvas backing store -----------
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
      const sim = simRef.current;
      // Skip only when nothing changed AND the sim already holds a grid; a fresh
      // sim (mount / context restore) must still get seeded at the current size.
      if (bw === canvas.width && bh === canvas.height && sim && sim.width !== 0) return;
      canvas.width = bw;
      canvas.height = bh;
      sizeRef.current = { w: bw, h: bh, dpr };
      // resize() preserves the field across size changes (it rescales rather
      // than reseeding); it only seeds when the grid is first created.
      sim?.resize(bw, bh);
      wake();
      emitStats(true);
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
  }, [wake, emitStats]);

  // Re-seed on reset.
  useEffect(() => {
    if (resetKey === 0) return;
    simRef.current?.seed();
    wake();
    emitStats(true);
  }, [resetKey, wake, emitStats]);

  // Rebuild the grid when the resolution scale changes (reseeds a fresh field).
  useEffect(() => {
    simRef.current?.setResolution(params.resolution);
    wake();
    emitStats(true);
  }, [params.resolution, wake, emitStats]);

  // Start/stop the loop with the transport.
  useEffect(() => {
    wake();
    if (!running) emitStats(true);
  }, [running, wake, emitStats]);

  // Repaint when look params change while parked.
  useEffect(() => {
    if (!running) renderOnce();
  }, [params.palette, running, renderOnce]);

  useEffect(() => {
    return () => {
      if (loopRef.current !== 0) cancelAnimationFrame(loopRef.current);
    };
  }, []);

  // --- Pointer: brush ------------------------------------------------------
  const handleDown = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      brushingRef.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      brushAt(e.clientX, e.clientY);
    },
    [brushAt],
  );

  const handleMove = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!brushingRef.current) return;
      brushAt(e.clientX, e.clientY);
    },
    [brushAt],
  );

  const handleUp = useCallback((e: ReactPointerEvent<HTMLCanvasElement>) => {
    brushingRef.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      reset() {
        simRef.current?.seed();
        wake();
      },
      step() {
        const sim = simRef.current;
        if (!sim) return;
        sim.step(propsRef.current.params, 1);
        sim.render(propsRef.current.params);
        emitStats(true);
      },
      exportPng() {
        const sim = simRef.current;
        const canvas = canvasRef.current;
        if (!sim || !canvas) return;
        // Repaint first so the saved buffer is the current field.
        sim.render(propsRef.current.params);
        canvas.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "reaction-diffusion.png";
          a.click();
          URL.revokeObjectURL(url);
        });
      },
    }),
    [wake, emitStats],
  );

  return (
    <div className="rd-stage" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        className="rd-canvas"
        aria-label={t("experiments.reaction-diffusion.canvas_aria")}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
      />
      {glFailed && (
        <div className="rd-fallback" role="alert">
          <ScrambleText text={t("experiments.reaction-diffusion.webgl_fallback")} duration={600} />
        </div>
      )}
    </div>
  );
});

export default RDCanvas;
