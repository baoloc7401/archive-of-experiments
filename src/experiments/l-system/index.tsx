import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import ScrambleText from "../../components/ScrambleText";
import { ExperimentLayout } from "../../components/ui";
import { useTheme } from "../../hooks/useTheme";
import { prefersReducedMotion } from "../../hooks/useReducedMotion";
import type { LParams, LSnapshot } from "./types";
import { DEFAULT_PARAMS } from "./constants";
import LCanvas, { type LHandle } from "./components/LCanvas";
import Controls from "./components/Controls";
import Editor from "./components/Editor";
import Stats from "./components/Stats";
import DebugPanel from "./components/DebugPanel";
import "./LSystem.css";

export default function LSystem() {
  const { t } = useTranslation();
  const { theme } = useTheme();

  // Auto-spin and grow-in greet you on load, unless reduced motion is asked for.
  const [params, setParams] = useState<LParams>(() => ({
    ...DEFAULT_PARAMS,
    grow: !prefersReducedMotion(),
  }));
  const [running, setRunning] = useState(() => !prefersReducedMotion());
  const [resetKey, setResetKey] = useState(0);
  const [snap, setSnap] = useState<LSnapshot | null>(null);

  const canvasRef = useRef<LHandle>(null);

  const patch = useCallback(
    (p: Partial<LParams>) => setParams((prev) => ({ ...prev, ...p })),
    [],
  );

  const handleStats = useCallback((s: LSnapshot) => setSnap(s), []);

  return (
    <ExperimentLayout
      glow="accent2"
      crumbs={[
        { label: t("experiments.l-system.title").toLowerCase(), to: "/experiments/l-system" },
        { label: t("experiments.l-system.subtitle") },
      ]}
      info={
        <>
          <div className="ls-info-tagline">
            <ScrambleText text={t("experiments.l-system.tagline")} duration={600} />
          </div>
          <div className="ls-info-desc">
            <ScrambleText text={t("experiments.l-system.intro")} duration={600} />
          </div>
        </>
      }
      sidebar={
        <>
          <Controls
            running={running}
            params={params}
            onPlayPause={() => setRunning((r) => !r)}
            onResetView={() => {
              canvasRef.current?.resetView();
              setResetKey((k) => k + 1);
            }}
            onToggleGrow={() => {
              // Enabling growth previews it immediately on the current model.
              if (!params.grow) canvasRef.current?.grow();
              patch({ grow: !params.grow });
            }}
            onReplay={() => canvasRef.current?.grow()}
            onChange={patch}
          />
          <DebugPanel snap={snap} params={params} running={running} theme={theme} />
          <div className="ls-hint">
            <ScrambleText text={t("experiments.l-system.hint")} duration={600} />
          </div>
        </>
      }
    >
      <LCanvas
        ref={canvasRef}
        params={params}
        running={running}
        theme={theme}
        resetKey={resetKey}
        onStats={handleStats}
      />
      <div className="ls-underbar">
        <Editor params={params} onChange={patch} onExport={() => canvasRef.current?.exportPng()} />
        <Stats snap={snap} />
      </div>
    </ExperimentLayout>
  );
}
