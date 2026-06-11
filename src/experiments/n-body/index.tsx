import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import ScrambleText from "../../components/ScrambleText";
import { ExperimentLayout } from "../../components/ui";
import { useTheme } from "../../hooks/useTheme";
import { prefersReducedMotion, useReducedMotion } from "../../hooks/useReducedMotion";
import type { ColorMode, NBodyParams, NBodySnapshot } from "./types";
import { DEFAULT_PARAMS } from "./constants";
import NBodyCanvas, { type NBodyHandle } from "./components/NBodyCanvas";
import Controls from "./components/Controls";
import Look from "./components/Look";
import Stats from "./components/Stats";
import DebugPanel from "./components/DebugPanel";
import "./NBody.css";

const LOOK_KEY = "nbody-look";

interface SavedLook {
  colorMode?: ColorMode;
  trails?: number;
  spin?: boolean;
  timeScale?: number;
}

function loadLook(): SavedLook {
  try {
    const raw = localStorage.getItem(LOOK_KEY);
    return raw ? (JSON.parse(raw) as SavedLook) : {};
  } catch {
    return {};
  }
}

export default function NBody() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const reduced = useReducedMotion();

  const [params, setParams] = useState<NBodyParams>(() => ({
    ...DEFAULT_PARAMS,
    ...loadLook(),
  }));
  // Paused-by-default for reduced-motion users; otherwise the galaxies are
  // already falling toward each other when the page settles.
  const [running, setRunning] = useState(() => !prefersReducedMotion());
  const [resetKey, setResetKey] = useState(0);
  const [snap, setSnap] = useState<NBodySnapshot | null>(null);

  const canvasRef = useRef<NBodyHandle>(null);

  const patch = useCallback(
    (p: Partial<NBodyParams>) => setParams((prev) => ({ ...prev, ...p })),
    [],
  );

  useEffect(() => {
    try {
      const look: SavedLook = {
        colorMode: params.colorMode,
        trails: params.trails,
        spin: params.spin,
        timeScale: params.timeScale,
      };
      localStorage.setItem(LOOK_KEY, JSON.stringify(look));
    } catch { /* storage quota */ }
  }, [params.colorMode, params.trails, params.spin, params.timeScale]);

  const handleStats = useCallback((s: NBodySnapshot) => setSnap(s), []);

  return (
    <ExperimentLayout
      glow="accent2"
      crumbs={[
        { label: t("experiments.n-body.title").toLowerCase(), to: "/experiments/n-body" },
        { label: t("experiments.n-body.subtitle") },
      ]}
      info={
        <>
          <div className="nb-info-tagline">
            <ScrambleText text={t("experiments.n-body.tagline")} duration={600} />
          </div>
          <div className="nb-info-desc">
            <ScrambleText text={t("experiments.n-body.intro")} duration={600} />
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
            onReset={() => setResetKey((k) => k + 1)}
            onChange={patch}
          />
          <DebugPanel snap={snap} params={params} running={running} theme={theme} reduced={reduced} />
          <div className="nb-hint">
            <ScrambleText text={t("experiments.n-body.hint")} duration={600} />
          </div>
        </>
      }
    >
      <NBodyCanvas
        ref={canvasRef}
        params={params}
        running={running}
        reduced={reduced}
        theme={theme}
        resetKey={resetKey}
        onStats={handleStats}
      />
      <div className="nb-legend">
        <span className="nb-lg">
          <i className={`nb-lg-bar nb-lg-bar--${params.colorMode}`} />
          <ScrambleText text={t(`experiments.n-body.legend_${params.colorMode}`)} duration={500} />
        </span>
        <span className="nb-legend-hint">
          <ScrambleText text={t("experiments.n-body.legend_controls")} duration={600} />
        </span>
      </div>
      <div className="nb-below">
        <Look params={params} onChange={patch} onExport={() => canvasRef.current?.exportPng()} />
        <Stats snap={snap} />
      </div>
    </ExperimentLayout>
  );
}
