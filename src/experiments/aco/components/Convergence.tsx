import { useEffect, useRef } from "react";
import ScrambleText from "../../../components/ScrambleText";
import type { Theme } from "../../../hooks/useTheme";

interface Props {
  history: number[]; // best-so-far length per iteration
  theme: Theme;
}

// A compact sparkline of the best-so-far tour length over iterations — the
// textbook ACO convergence curve, dropping fast then plateauing.
export default function Convergence({ history, theme }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cs = getComputedStyle(document.documentElement);
    const accent = cs.getPropertyValue("--accent").trim() || "#00f5c4";
    const dim = cs.getPropertyValue("--text-dim").trim() || "#464f6a";

    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const w = rect.width;
    const h = rect.height;
    const pad = 4;

    if (history.length < 2) {
      ctx.fillStyle = dim;
      ctx.font = "10px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("convergence curve", w / 2, h / 2);
      return;
    }

    const max = Math.max(...history);
    const min = Math.min(...history);
    const span = max - min || 1;
    const n = history.length;

    const xAt = (i: number) => pad + (i / (n - 1)) * (w - pad * 2);
    const yAt = (v: number) => pad + (1 - (v - min) / span) * (h - pad * 2);

    // Area fill under the curve.
    ctx.beginPath();
    ctx.moveTo(xAt(0), h - pad);
    for (let i = 0; i < n; i++) ctx.lineTo(xAt(i), yAt(history[i]));
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
      const y = yAt(history[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.stroke();

    // Marker on the latest point.
    ctx.beginPath();
    ctx.arc(xAt(n - 1), yAt(history[n - 1]), 2.4, 0, Math.PI * 2);
    ctx.fillStyle = accent;
    ctx.fill();
  }, [history, theme]);

  return (
    <div className="aco-conv">
      <div className="aco-conv-label">
        <ScrambleText text="best tour length →" duration={500} />
      </div>
      <canvas ref={ref} className="aco-conv-canvas" />
    </div>
  );
}
