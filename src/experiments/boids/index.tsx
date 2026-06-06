import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import ScrambleText from "../../components/ScrambleText";
import { ExperimentLayout } from "../../components/ui";
import { useTheme } from "../../hooks/useTheme";
import { prefersReducedMotion, useReducedMotion } from "../../hooks/useReducedMotion";
import type { BoidParams, BoidSnapshot } from "./types";
import { DEFAULT_PARAMS, ORDER_HISTORY_MAX } from "./constants";
import BoidsCanvas, { type BoidsHandle } from "./components/BoidsCanvas";
import Controls from "./components/Controls";
import Stats from "./components/Stats";
import "./Boids.css";

export default function Boids() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const reduced = useReducedMotion();

  const [params, setParams] = useState<BoidParams>(DEFAULT_PARAMS);
  // Paused-by-default for reduced-motion users; otherwise the flock greets you in flight.
  const [running, setRunning] = useState(() => !prefersReducedMotion());
  const [resetKey, setResetKey] = useState(0);
  const [snap, setSnap] = useState<BoidSnapshot | null>(null);
  const [history, setHistory] = useState<number[]>([]);

  const canvasRef = useRef<BoidsHandle>(null);

  const patch = useCallback(
    (p: Partial<BoidParams>) => setParams((prev) => ({ ...prev, ...p })),
    [],
  );

  const handleStats = useCallback((s: BoidSnapshot) => {
    setSnap(s);
    setHistory((prev) => {
      const next = [...prev, s.order];
      return next.length > ORDER_HISTORY_MAX ? next.slice(-ORDER_HISTORY_MAX) : next;
    });
  }, []);

  function handleReset() {
    setRunning(false);
    setSnap(null);
    setHistory([]);
    setResetKey((k) => k + 1);
  }

  return (
    <ExperimentLayout
      glow="accent"
      crumbs={[
        { label: t("experiments.boids.title").toLowerCase(), to: "/experiments/boids" },
        { label: t("experiments.boids.subtitle") },
      ]}
      info={
        <>
          <div className="boids-info-tagline">
            <ScrambleText text={t("experiments.boids.tagline")} duration={600} />
          </div>
          <div className="boids-info-desc">
            <ScrambleText text={t("experiments.boids.intro")} duration={600} />
          </div>
        </>
      }
      sidebar={
        <>
          <Controls
            running={running}
            params={params}
            onPlayPause={() => setRunning((r) => !r)}
            onStep={() => canvasRef.current?.step()}
            onReset={handleReset}
            onChange={patch}
            onExport={() => canvasRef.current?.exportPng()}
            onClear={() => canvasRef.current?.clearMarks()}
          />
          <Stats snap={snap} history={history} theme={theme} />
          <div className="boids-hint">
            <ScrambleText text={t("experiments.boids.hint")} duration={600} />
          </div>
        </>
      }
    >
      <BoidsCanvas
        ref={canvasRef}
        params={params}
        running={running}
        reduced={reduced}
        theme={theme}
        resetKey={resetKey}
        onStats={handleStats}
      />
      <div className="boids-legend">
        <span className="boids-lg">
          <i className="boids-lg-dot boids-lg--sep" />
          <ScrambleText text={t("experiments.boids.separation")} duration={500} />
        </span>
        <span className="boids-lg">
          <i className="boids-lg-dot boids-lg--ali" />
          <ScrambleText text={t("experiments.boids.alignment")} duration={500} />
        </span>
        <span className="boids-lg">
          <i className="boids-lg-dot boids-lg--coh" />
          <ScrambleText text={t("experiments.boids.cohesion")} duration={500} />
        </span>
        <span className="boids-lg">
          <i className="boids-lg-dot boids-lg--sum" />
          <ScrambleText text={t("experiments.boids.resultant")} duration={500} />
        </span>
        <span className="boids-legend-hint">
          <ScrambleText text={t("experiments.boids.hover_hint")} duration={600} />
        </span>
      </div>
    </ExperimentLayout>
  );
}
