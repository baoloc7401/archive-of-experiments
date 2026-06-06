import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { Theme } from "../../../hooks/useTheme";
import type { AcoDebug, AcoParams, ColonySnapshot, Point, Tour } from "../types";
import { Colony } from "../aco";
import { MIN_SPEED, MAX_SPEED } from "../constants";

interface Props {
  cities: Point[];
  params: AcoParams;
  running: boolean;
  speed: number;
  /** 0–100: how much of the faint pheromone web to reveal (view-only). */
  trail: number;
  theme: Theme;
  /** Bumping this number forces the colony to restart from scratch. */
  resetKey: number;
  onStats: (s: ColonySnapshot) => void;
  onAddCity: (p: Point) => void;
}

export interface ColonyHandle {
  /** Run exactly one iteration instantly (build + commit), no walk animation. */
  step: () => void;
  /** Snapshot structural runtime state for the copyable debug report. */
  dump: () => AcoDebug;
}

interface Palette {
  accent: string;
  accent2: string;
  textHi: string;
  textDim: string;
  border: string;
  bg: string;
  ant: string;
}

function readPalette(theme: Theme): Palette {
  const cs = getComputedStyle(document.documentElement);
  const get = (v: string) => cs.getPropertyValue(v).trim();
  return {
    accent: get("--accent") || "#00f5c4",
    accent2: get("--accent2") || "#7c6cfa",
    textHi: get("--text-hi") || "#e2e8f8",
    textDim: get("--text-dim") || "#464f6a",
    border: get("--border") || "#1e2130",
    bg: get("--bg") || "#07080d",
    ant: theme === "dark" ? "#ffb454" : "#e06c00",
  };
}

// Parse a hex colour into "r,g,b" for rgba() composition.
function rgb(hex: string): string {
  const h = hex.replace("#", "");
  const v = h.length === 3
    ? h.split("").map((c) => c + c).join("")
    : h.padEnd(6, "0").slice(0, 6);
  const n = parseInt(v, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

const PAD = 26; // inner padding so nodes/labels never clip the canvas edge

const ColonyCanvas = forwardRef<ColonyHandle, Props>(function ColonyCanvas(
  { cities, params, running, speed, trail, theme, resetKey, onStats, onAddCity },
  ref,
) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Mutable simulation state lives in refs so the rAF loop never triggers React
  // re-renders; only the throttled stats snapshot flows up through onStats.
  const colonyRef = useRef<Colony | null>(null);
  const genRef = useRef<Tour[] | null>(null);
  const progressRef = useRef(0);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const paletteRef = useRef<Palette>(readPalette(theme));
  const propsRef = useRef({ params, speed, trail, running, onStats, theme, cities });
  propsRef.current = { params, speed, trail, running, onStats, theme, cities };

  // --- Stats + drawing ---------------------------------------------------
  // These read every live value from refs (theme/cities included, via
  // propsRef), so they stay referentially stable and can sit in effect
  // dependency arrays without forcing those effects to re-run - crucially, the
  // colony is never rebuilt just because the theme flipped.

  const emitStats = useCallback(() => {
    const c = colonyRef.current;
    if (!c) return;
    propsRef.current.onStats({
      iteration: c.iteration,
      bestLength: c.best ? c.best.length : Infinity,
      lastBestLength: c.lastBestLength,
      lastAvgLength: c.lastAvgLength,
      nnLength: c.nnLength,
      history: c.history,
      cities: c.n,
      converged: c.converged,
    });
  }, []);

  // --- Coordinate mapping ------------------------------------------------

  const project = useCallback((p: Point): [number, number] => {
    const { w, h } = sizeRef.current;
    const side = Math.min(w, h) - PAD * 2;
    const ox = (w - side) / 2;
    const oy = (h - side) / 2;
    return [ox + p.x * side, oy + p.y * side];
  }, []);

  // --- Drawing -----------------------------------------------------------

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { w, h, dpr } = sizeRef.current;
    if (w === 0 || h === 0) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const { theme, cities } = propsRef.current;
    const pal = paletteRef.current;
    const colony = colonyRef.current;

    // Pheromone field - each edge is normalised across the *current* min→max
    // pheromone range, then shaped by the "trails" slider. The slider drives a
    // gamma curve + cutoff: low reveals only the strongest trails, high lifts
    // the faint decayed web into view. A near-uniform early field (min ≈ max)
    // is skipped entirely, so there's no n² hairball at the start.
    if (colony) {
      const n = colony.n;
      let minP = Infinity;
      let maxP = 0;
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const v = colony.pheromone[i * n + j];
          if (v < minP) minP = v;
          if (v > maxP) maxP = v;
        }
      }
      const spread = maxP - minP;
      // Only render once trails have differentiated enough to carry structure.
      if (spread > maxP * 0.02) {
        const accentRgb = rgb(pal.accent);
        // trail 0 → harsh (gamma 2.6, high cutoff): only the dominant loop.
        // trail 100 → soft (gamma 0.4, no cutoff): the whole faint web shows.
        const vis = propsRef.current.trail / 100;
        const gamma = 2.6 - vis * 2.2;
        const cutoff = 0.16 * (1 - vis);
        if (theme === "dark") ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < n; i++) {
          const [xi, yi] = project(colony.cities[i]);
          for (let j = i + 1; j < n; j++) {
            const norm = (colony.pheromone[i * n + j] - minP) / spread; // 0..1
            const intensity = Math.pow(norm, gamma); // slider-shaped display intensity
            if (intensity <= cutoff) continue;
            const [xj, yj] = project(colony.cities[j]);
            ctx.strokeStyle = `rgba(${accentRgb},${(0.05 + intensity * 0.6).toFixed(3)})`;
            ctx.lineWidth = 0.4 + intensity * 3.4;
            ctx.beginPath();
            ctx.moveTo(xi, yi);
            ctx.lineTo(xj, yj);
            ctx.stroke();
          }
        }
        ctx.globalCompositeOperation = "source-over";
      }
    }

    // Best-so-far tour - a bright closed loop in the secondary accent.
    if (colony?.best) {
      const p = colony.best.path;
      const accent2Rgb = rgb(pal.accent2);
      ctx.save();
      ctx.shadowColor = pal.accent2;
      ctx.shadowBlur = 10;
      ctx.strokeStyle = `rgba(${accent2Rgb},0.95)`;
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.beginPath();
      for (let k = 0; k <= p.length; k++) {
        const [x, y] = project(colony.cities[p[k % p.length]]);
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Ants - each crawls along the edge of its current tour, with a comet trail.
    const gen = genRef.current;
    if (gen && colony) {
      const prog = progressRef.current;
      const n = colony.n;
      const seg = Math.floor(prog) % n;
      const frac = prog - Math.floor(prog);
      const antRgb = rgb(pal.ant);
      ctx.save();
      if (theme === "dark") ctx.globalCompositeOperation = "lighter";
      for (let k = 0; k < gen.length; k++) {
        const path = gen[k].path;
        const a = path[seg];
        const b = path[(seg + 1) % n];
        const [ax, ay] = project(colony.cities[a]);
        const [bx, by] = project(colony.cities[b]);
        const px = ax + (bx - ax) * frac;
        const py = ay + (by - ay) * frac;
        // Trail behind the ant along the current edge.
        const grad = ctx.createLinearGradient(ax, ay, px, py);
        grad.addColorStop(0, `rgba(${antRgb},0)`);
        grad.addColorStop(1, `rgba(${antRgb},0.5)`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(px, py);
        ctx.stroke();
        // The ant itself.
        ctx.fillStyle = `rgba(${antRgb},0.95)`;
        ctx.beginPath();
        ctx.arc(px, py, 2.1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Cities - drawn last so they sit above every trail.
    const pts = colony ? colony.cities : cities;
    for (let i = 0; i < pts.length; i++) {
      const [x, y] = project(pts[i]);
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = pal.bg;
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = pal.textHi;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, 1.6, 0, Math.PI * 2);
      ctx.fillStyle = pal.textHi;
      ctx.fill();
    }
  }, [project]);

  // (Re)build the colony whenever the city set or reset key changes.
  useEffect(() => {
    if (cities.length < 2) {
      colonyRef.current = null;
      genRef.current = null;
      draw();
      return;
    }
    const colony = new Colony(cities, { ...propsRef.current.params });
    colonyRef.current = colony;
    genRef.current = null;
    progressRef.current = 0;
    emitStats();
    draw();
  }, [cities, resetKey, draw, emitStats]);

  // Keep the live colony's tunables in sync with the sliders.
  useEffect(() => {
    if (colonyRef.current) colonyRef.current.params = { ...params };
  }, [params]);

  // Re-read theme tokens when the theme flips, then repaint.
  useEffect(() => {
    paletteRef.current = readPalette(theme);
    draw();
  }, [theme, draw]);

  // Repaint when the trail-visibility slider moves while paused.
  useEffect(() => {
    if (!propsRef.current.running) draw();
  }, [trail, draw]);

  // --- Animation loop ----------------------------------------------------

  useEffect(() => {
    if (!running) {
      draw();
      return;
    }
    let raf = 0;
    let stopped = false;

    function frame() {
      if (stopped) return;
      const colony = colonyRef.current;
      if (colony && colony.n >= 2) {
        const sp = propsRef.current.speed;
        const norm = (sp - MIN_SPEED) / (MAX_SPEED - MIN_SPEED);
        // edges advanced per frame: a gentle crawl at the low end, up to a few
        // full iterations per frame at the top.
        const edgesPerFrame = 0.08 + Math.pow(norm, 2.2) * colony.n * 3;

        if (!genRef.current) {
          genRef.current = colony.buildGeneration();
          progressRef.current = 0;
        }
        progressRef.current += edgesPerFrame;

        let committed = false;
        let guard = 0;
        while (progressRef.current >= colony.n && guard < 8) {
          colony.commit(genRef.current!);
          genRef.current = colony.buildGeneration();
          progressRef.current -= colony.n;
          committed = true;
          guard++;
        }
        if (committed) emitStats();
      }
      draw();
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
      // Skip no-op resizes so we never write the backing store (and thus never
      // re-touch layout) when nothing actually changed.
      if (bw === canvas.width && bh === canvas.height) return;
      sizeRef.current = { w: r.width, h: r.height, dpr };
      canvas.width = bw;
      canvas.height = bh;
      draw();
    };
    // Defer the measure+resize out of the observer callback to avoid the
    // "ResizeObserver loop" error and any same-frame feedback.
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

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const { w, h } = sizeRef.current;
    const side = Math.min(w, h) - PAD * 2;
    if (side <= 0) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const ox = (w - side) / 2;
    const oy = (h - side) / 2;
    const x = (e.clientX - rect.left - ox) / side;
    const y = (e.clientY - rect.top - oy) / side;
    if (x < -0.02 || x > 1.02 || y < -0.02 || y > 1.02) return;
    onAddCity({ x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) });
  }

  useImperativeHandle(ref, () => ({
    step() {
      const colony = colonyRef.current;
      if (!colony || colony.n < 2) return;
      colony.commit(colony.buildGeneration());
      genRef.current = null;
      progressRef.current = 0;
      emitStats();
      draw();
    },
    dump(): AcoDebug {
      const { w, h, dpr } = sizeRef.current;
      const c = colonyRef.current;
      const base = {
        cities: cities.length,
        canvas: { w: Math.round(w), h: Math.round(h), dpr },
        progress: Number(progressRef.current.toFixed(2)),
        genActive: genRef.current != null,
        cityCoords: cities.map(
          (p) => [Number(p.x.toFixed(3)), Number(p.y.toFixed(3))] as [number, number],
        ),
      };
      if (!c) {
        return {
          ...base,
          iteration: 0,
          bestLength: Infinity,
          lastBestLength: Infinity,
          lastAvgLength: Infinity,
          nnLength: Infinity,
          converged: false,
          tau0: 0,
          pheromone: { min: 0, max: 0, mean: 0, aboveHalf: 0, edges: 0 },
          bestPath: null,
        };
      }
      // Pheromone distribution over the upper triangle (unique edges).
      const n = c.n;
      let mn = Infinity;
      let mx = 0;
      let sum = 0;
      let edges = 0;
      const half = c.maxPheromone * 0.5;
      let aboveHalf = 0;
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const v = c.pheromone[i * n + j];
          if (v < mn) mn = v;
          if (v > mx) mx = v;
          sum += v;
          edges++;
          if (v >= half) aboveHalf++;
        }
      }
      const round = (x: number) => (Number.isFinite(x) ? Number(x.toPrecision(4)) : x);
      return {
        ...base,
        iteration: c.iteration,
        bestLength: round(c.best ? c.best.length : Infinity),
        lastBestLength: round(c.lastBestLength),
        lastAvgLength: round(c.lastAvgLength),
        nnLength: round(c.nnLength),
        converged: c.converged,
        tau0: round(c.tau0),
        pheromone: {
          min: round(edges ? mn : 0),
          max: round(mx),
          mean: round(edges ? sum / edges : 0),
          aboveHalf,
          edges,
        },
        bestPath: c.best ? c.best.path.slice() : null,
      };
    },
  }));

  return (
    <div className="aco-canvas-wrap" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        className="aco-canvas"
        onClick={handleClick}
        aria-label={t("experiments.aco.canvas_aria")}
      />
    </div>
  );
});

export default ColonyCanvas;
