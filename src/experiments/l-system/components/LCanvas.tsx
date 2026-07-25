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
import type { Theme } from "@/hooks/useTheme";
import type { LModel, LParams, LSnapshot } from "../types";
import { GROW_MAX_MS, GROW_MIN_MS, STATS_INTERVAL } from "../constants";
import { expand, parseRules } from "../lsystem";
import { interpret } from "../turtle";
import { readPalette, type Palette } from "../palette";
import { drawScene, type View } from "../render";

interface Props {
  params: LParams;
  running: boolean;
  theme: Theme;
  /** Bumping this re-centres the camera. */
  resetKey: number;
  onStats: (s: LSnapshot) => void;
}

export interface LHandle {
  /** Re-centre the orbit camera to the default angle. */
  resetView: () => void;
  /** Replay the stroke-by-stroke growth reveal of the current model. */
  grow: () => void;
  /** Save the current canvas as a PNG download. */
  exportPng: () => void;
}

const DEFAULT_VIEW: View = { yaw: 0.6, pitch: 0.25, zoom: 1 };

function build(params: LParams): LModel {
  const rules = parseRules(params.rules);
  const str = expand(params.axiom.trim(), rules, params.iterations);
  return interpret(str, params.angle);
}

const LCanvas = forwardRef<LHandle, Props>(function LCanvas(
  { params, running, theme, resetKey, onStats },
  ref,
) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const modelRef = useRef<LModel>(build(params));
  const viewRef = useRef<View>({ ...DEFAULT_VIEW });
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const paletteRef = useRef<Palette>(readPalette());
  const fpsRef = useRef(60);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  // Progressive-growth reveal: 0..1 fraction of strokes drawn (1 = complete).
  const revealRef = useRef(1);
  const growingRef = useRef(false);
  const growDurRef = useRef(GROW_MIN_MS);
  const [growActive, setGrowActive] = useState(false);
  const propsRef = useRef({ params, running, onStats });
  propsRef.current = { params, running, onStats };

  // Restart the reveal from scratch; the animation loop advances revealRef.
  const startGrowth = useCallback(() => {
    const n = modelRef.current.segments.length;
    if (n === 0) return;
    revealRef.current = 0;
    growingRef.current = true;
    growDurRef.current = Math.min(GROW_MAX_MS, GROW_MIN_MS + n * 0.4);
    setGrowActive(true);
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
      model: modelRef.current,
      view: viewRef.current,
      reveal: revealRef.current,
    });
  }, []);

  const emitStats = useCallback(() => {
    const m = modelRef.current;
    const v = viewRef.current;
    const sz = sizeRef.current;
    propsRef.current.onStats({
      symbolCount: m.symbolCount,
      segments: m.segments.length,
      maxDepth: m.maxDepth,
      fps: fpsRef.current,
      size: m.size,
      yaw: v.yaw,
      pitch: v.pitch,
      zoom: v.zoom,
      reveal: revealRef.current,
      w: sz.w,
      h: sz.h,
      dpr: sz.dpr,
    });
  }, []);

  // Rebuild the geometry whenever the grammar or angle changes.
  useEffect(() => {
    modelRef.current = build(propsRef.current.params);
    emitStats();
    if (propsRef.current.params.grow) {
      startGrowth();
    } else {
      revealRef.current = 1;
      growingRef.current = false;
      if (!propsRef.current.running) draw();
    }
  }, [params.axiom, params.rules, params.iterations, params.angle, emitStats, draw, startGrowth]);

  // Re-centre the camera on reset.
  useEffect(() => {
    viewRef.current = { ...DEFAULT_VIEW };
    if (!propsRef.current.running) draw();
  }, [resetKey, draw]);

  // Re-read theme tokens after a flip, then repaint if idle.
  useEffect(() => {
    paletteRef.current = readPalette();
    if (!propsRef.current.running) draw();
  }, [theme, draw]);

  // Repaint a static frame when look/colour params change while paused.
  useEffect(() => {
    if (!propsRef.current.running) draw();
  }, [params.thickness, params.taper, params.fog, params.colorMode, draw]);

  // --- Orbit drag --------------------------------------------------------
  const handleDown = useCallback((e: ReactPointerEvent<HTMLCanvasElement>) => {
    dragRef.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const handleMove = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      drag.x = e.clientX;
      drag.y = e.clientY;
      const view = viewRef.current;
      view.yaw += dx * 0.01;
      view.pitch = Math.max(-1.45, Math.min(1.45, view.pitch + dy * 0.01));
      if (!propsRef.current.running) draw();
    },
    [draw],
  );

  const endDrag = useCallback((e: ReactPointerEvent<HTMLCanvasElement>) => {
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  // Wheel zoom (native listener so we can preventDefault the page scroll).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const view = viewRef.current;
      const factor = Math.exp(-e.deltaY * 0.0012);
      view.zoom = Math.max(0.3, Math.min(5, view.zoom * factor));
      if (!propsRef.current.running) draw();
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [draw]);

  // --- Animation loop (auto-spin and/or progressive growth) --------------
  useEffect(() => {
    if (!running && !growActive) {
      draw();
      return;
    }
    let raf = 0;
    let stopped = false;
    let last = performance.now();
    let acc = 0;

    const frame = (now: number) => {
      if (stopped) return;
      const dt = now - last;
      last = now;
      if (dt > 0) fpsRef.current = fpsRef.current * 0.9 + (1000 / dt) * 0.1;
      // Advance the growth reveal until it completes.
      if (growingRef.current) {
        revealRef.current += dt / growDurRef.current;
        if (revealRef.current >= 1) {
          revealRef.current = 1;
          growingRef.current = false;
          setGrowActive(false);
        }
      }
      // Spin unless the user is actively dragging.
      if (running && !dragRef.current) {
        viewRef.current.yaw += (dt / 1000) * propsRef.current.params.spinSpeed;
      }
      draw();
      acc += dt;
      if (acc >= STATS_INTERVAL) {
        acc = 0;
        emitStats();
      }
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, [running, growActive, draw, emitStats]);

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
      sizeRef.current = { w: r.width, h: r.height, dpr };
      canvas.width = bw;
      canvas.height = bh;
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
      resetView() {
        viewRef.current = { ...DEFAULT_VIEW };
        if (!propsRef.current.running) draw();
      },
      grow() {
        startGrowth();
      },
      exportPng() {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "l-system.png";
          a.click();
          URL.revokeObjectURL(url);
        });
      },
    }),
    [draw, startGrowth],
  );

  return (
    <div className="ls-stage" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        className="ls-canvas"
        aria-label={t("experiments.l-system.canvas_aria")}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      />
    </div>
  );
});

export default LCanvas;
