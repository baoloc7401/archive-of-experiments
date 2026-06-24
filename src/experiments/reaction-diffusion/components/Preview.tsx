import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import ScrambleText from "../../../components/ScrambleText";
import type { RDParams } from "../types";
import { createSimulator, type RDSimulator } from "../simulation";

interface Props {
  params: RDParams;
}

/** Steps run per preview frame: high so the regime settles within a second. */
const PREVIEW_STEPS = 16;

/**
 * A small, independent Gray-Scott sim showing the regime for the current
 * feed/kill (and palette) without disturbing the main canvas. It owns its own
 * GL context, runs a continuous loop, and re-seeds whenever the reaction
 * parameters change so the new pattern forms from scratch.
 */
export default function Preview({ params }: Props) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<RDSimulator | null>(null);
  const loopRef = useRef(0);
  // The rAF loop reads the latest params through a ref synced after each render.
  const paramsRef = useRef(params);
  useEffect(() => {
    paramsRef.current = params;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = Math.round(canvas.clientWidth * dpr) || 128;
    canvas.width = size;
    canvas.height = size;
    const sim = createSimulator(canvas);
    if (!sim) return;
    simRef.current = sim;
    sim.resize(size, size);

    const frame = () => {
      const s = simRef.current;
      if (!s) return;
      const p = paramsRef.current;
      s.step(p, PREVIEW_STEPS);
      s.render(p);
      loopRef.current = requestAnimationFrame(frame);
    };
    loopRef.current = requestAnimationFrame(frame);

    return () => {
      if (loopRef.current !== 0) {
        cancelAnimationFrame(loopRef.current);
        loopRef.current = 0;
      }
      sim.dispose();
      simRef.current = null;
    };
  }, []);

  // Re-seed when the reaction parameters change so the regime forms fresh.
  useEffect(() => {
    simRef.current?.seed();
  }, [params.feed, params.kill, params.du, params.dv, params.dt]);

  return (
    <div className="rd-preview">
      <span className="rd-preview-label">
        <ScrambleText text={t("experiments.reaction-diffusion.preview")} duration={500} />
      </span>
      <canvas ref={canvasRef} className="rd-preview-canvas" aria-hidden="true" />
    </div>
  );
}
