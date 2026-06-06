import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import ScrambleText from "../../../components/ScrambleText";
import type { Theme } from "../../../hooks/useTheme";

interface Props {
  history: number[]; // order parameter per snapshot, each in [0, 1]
  theme: Theme;
}

// A compact sparkline of the Vicsek order parameter over time. Unlike a tour
// length, order has a fixed meaning, so the y-axis is pinned to [0, 1] (with a
// faint 0.5 guide) rather than auto-scaled - the curve's height *is* the
// alignment level.
//
// The canvas is absolutely positioned inside a fixed-size box and we measure the
// *box* (never the canvas's own rect): a replaced element sized from its own
// backing store can otherwise inflate the grid track and grow without bound.
export default function OrderChart({ history, theme }: Props) {
  const { t } = useTranslation();
  const emptyLabel = t("experiments.boids.order_empty");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef(history);
  const emptyRef = useRef(emptyLabel);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const box = boxRef.current;
    if (!canvas || !box) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cs = getComputedStyle(document.documentElement);
    const accent = cs.getPropertyValue("--accent").trim() || "#00f5c4";
    const dim = cs.getPropertyValue("--text-dim").trim() || "#464f6a";

    const w = box.clientWidth;
    const h = box.clientHeight;
    if (w === 0 || h === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const hist = historyRef.current;
    const pad = 4;
    const yAt = (v: number) => pad + (1 - v) * (h - pad * 2); // fixed [0,1] domain

    // Faint 0.5 reference line.
    ctx.strokeStyle = dim + "55";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(pad, yAt(0.5));
    ctx.lineTo(w - pad, yAt(0.5));
    ctx.stroke();
    ctx.setLineDash([]);

    if (hist.length < 2) {
      ctx.fillStyle = dim;
      ctx.font = "10px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(emptyRef.current, w / 2, h / 2);
      return;
    }

    const n = hist.length;
    const xAt = (i: number) => pad + (i / (n - 1)) * (w - pad * 2);

    // Area fill under the curve.
    ctx.beginPath();
    ctx.moveTo(xAt(0), h - pad);
    for (let i = 0; i < n; i++) ctx.lineTo(xAt(i), yAt(hist[i]));
    ctx.lineTo(xAt(n - 1), h - pad);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, accent + "55");
    grad.addColorStop(1, accent + "00");
    ctx.fillStyle = grad;
    ctx.fill();

    // The curve itself.
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = xAt(i);
      const y = yAt(hist[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.stroke();

    // Marker on the latest point.
    ctx.beginPath();
    ctx.arc(xAt(n - 1), yAt(hist[n - 1]), 2.4, 0, Math.PI * 2);
    ctx.fillStyle = accent;
    ctx.fill();
  }, []);

  // Redraw on new data, theme flip, or language change (the empty-state label).
  useEffect(() => {
    historyRef.current = history;
    emptyRef.current = emptyLabel;
    draw();
  }, [history, theme, emptyLabel, draw]);

  // Redraw on container resize, deferred to a frame to avoid the
  // "ResizeObserver loop" error.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    let pending = 0;
    const ro = new ResizeObserver(() => {
      if (pending) return;
      pending = requestAnimationFrame(() => {
        pending = 0;
        draw();
      });
    });
    ro.observe(box);
    return () => {
      if (pending) cancelAnimationFrame(pending);
      ro.disconnect();
    };
  }, [draw]);

  return (
    <div className="boids-chart">
      <div className="boids-chart-label">
        <ScrambleText text={t("experiments.boids.order_label")} duration={500} />
      </div>
      <div className="boids-chart-box" ref={boxRef}>
        <canvas ref={canvasRef} className="boids-chart-canvas" />
      </div>
    </div>
  );
}
