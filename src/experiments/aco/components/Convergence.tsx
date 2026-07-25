import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import ScrambleText from "@/components/ScrambleText";
import type { Theme } from "@/hooks/useTheme";

interface Props {
  history: number[]; // best-so-far length per iteration
  theme: Theme;
}

// A compact sparkline of the best-so-far tour length over iterations - the
// textbook ACO convergence curve, dropping fast then plateauing.
//
// The canvas is absolutely positioned inside a fixed-size box and we measure
// the *box* (never the canvas's own rect): a replaced element sized from its
// own backing-store dimensions can otherwise inflate a `1fr` grid track and
// grow without bound on every redraw.
export default function Convergence({ history, theme }: Props) {
  const { t } = useTranslation();
  const emptyLabel = t("experiments.aco.conv_empty");
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

    if (hist.length < 2) {
      ctx.fillStyle = dim;
      ctx.font = "10px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(emptyRef.current, w / 2, h / 2);
      return;
    }

    const max = Math.max(...hist);
    const min = Math.min(...hist);
    const span = max - min || 1;
    const n = hist.length;

    const xAt = (i: number) => pad + (i / (n - 1)) * (w - pad * 2);
    const yAt = (v: number) => pad + (1 - (v - min) / span) * (h - pad * 2);

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

  // Redraw on container resize (decoupled from the data stream). The work is
  // deferred to a frame to avoid the "ResizeObserver loop" error.
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
    <div className="aco-conv">
      <div className="aco-conv-label">
        <ScrambleText text={t("experiments.aco.conv_label")} duration={500} />
      </div>
      <div className="aco-conv-box" ref={boxRef}>
        <canvas ref={canvasRef} className="aco-conv-canvas" />
      </div>
    </div>
  );
}
