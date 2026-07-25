import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useTranslation } from "@/hooks/useTranslation";
import ScrambleText from "@/components/ScrambleText";
import { STATS_INTERVAL } from "../constants";
import type { CAParams, CASnapshot } from "../types";
import { createSimulator, type CASimulator } from "../simulation";

interface Props {
  params: CAParams;
  running: boolean;
  /** Bumping this reseeds the field with random noise at params.reseedDensity. */
  reseedKey: number;
  /** Bumping this wipes the field to all-dead. */
  clearKey: number;
  onStats: (s: CASnapshot) => void;
}

export interface CAHandle {
  /** Reseed the field with random noise at the current density. */
  reseed: () => void;
  /** Wipe the field to all-dead. */
  clear: () => void;
  /** Advance the field one generation (used while paused). */
  step: () => void;
  /** Save the current frame as a PNG download. */
  exportPng: () => void;
}

const CACanvas = forwardRef<CAHandle, Props>(function CACanvas(
  { params, running, reseedKey, clearKey, onStats },
  ref,
) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [glFailed, setGlFailed] = useState(false);

  const simRef = useRef<CASimulator | null>(null);
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
      generation: sim.generation,
      ...field,
    });
  }, []);

  const renderOnce = useCallback(() => {
    const p = propsRef.current.params;
    simRef.current?.render(p.genome, p.palette);
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
    if (run) sim.step(p.genome, p.boundary, p.stepsPerFrame);
    sim.render(p.genome, p.palette);
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

  // Map a client point to grid uv-space and paint/erase there.
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
      const p = propsRef.current.params;
      sim.splat(u, v, p.brushRadius, p.brushMode);
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
    // Record the cell size before the first resize allocates the grid.
    sim.setCellSize(propsRef.current.params.cellSize);
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
      // resize() preserves the field across size changes (nearest rescale); it
      // only seeds when the grid is first created.
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

  // Reseed with random noise on reseedKey bumps.
  useEffect(() => {
    if (reseedKey === 0) return;
    simRef.current?.reseed(propsRef.current.params.reseedDensity);
    wake();
    emitStats(true);
  }, [reseedKey, wake, emitStats]);

  // Wipe to all-dead on clearKey bumps.
  useEffect(() => {
    if (clearKey === 0) return;
    simRef.current?.clear();
    wake();
    emitStats(true);
  }, [clearKey, wake, emitStats]);

  // Rebuild the grid when the cell size changes (preserves the field via rescale).
  useEffect(() => {
    simRef.current?.setCellSize(params.cellSize);
    wake();
    emitStats(true);
  }, [params.cellSize, wake, emitStats]);

  // Start/stop the loop with the transport.
  useEffect(() => {
    wake();
    if (!running) emitStats(true);
  }, [running, wake, emitStats]);

  // Repaint when look params change while parked.
  useEffect(() => {
    if (!running) renderOnce();
  }, [params.palette, params.genome, running, renderOnce]);

  useEffect(() => {
    return () => {
      if (loopRef.current !== 0) cancelAnimationFrame(loopRef.current);
    };
  }, []);

  // --- Pointer: brush --------------------------------------------------------
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
      reseed() {
        simRef.current?.reseed(propsRef.current.params.reseedDensity);
        wake();
      },
      clear() {
        simRef.current?.clear();
        wake();
      },
      step() {
        const sim = simRef.current;
        if (!sim) return;
        const p = propsRef.current.params;
        sim.step(p.genome, p.boundary, 1);
        sim.render(p.genome, p.palette);
        emitStats(true);
      },
      exportPng() {
        const sim = simRef.current;
        const canvas = canvasRef.current;
        if (!sim || !canvas) return;
        const p = propsRef.current.params;
        // Repaint first so the saved buffer is the current field.
        sim.render(p.genome, p.palette);
        canvas.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "cellular-automata.png";
          a.click();
          URL.revokeObjectURL(url);
        });
      },
    }),
    [wake, emitStats],
  );

  return (
    <div className="ca-stage" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        className="ca-canvas"
        aria-label={t("experiments.cellular-automata.canvas_aria")}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
      />
      {glFailed && (
        <div className="ca-fallback" role="alert">
          <ScrambleText text={t("experiments.cellular-automata.webgl_fallback")} duration={600} />
        </div>
      )}
    </div>
  );
});

export default CACanvas;
