import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import ScrambleText from "../../components/ScrambleText";
import { ExperimentLayout } from "../../components/ui";
import { useTheme } from "../../hooks/useTheme";
import { prefersReducedMotion, useReducedMotion } from "../../hooks/useReducedMotion";
import PacmanCanvas, { type PacmanHandle } from "./components/PacmanCanvas";
import Sidebar from "./components/Sidebar";
import type { PacController } from "./pacai";
import type { GhostId, Snapshot } from "./types";
import "./Pacman.css";

export default function Pacman() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const reduced = useReducedMotion();

  const [running, setRunning] = useState(() => !prefersReducedMotion());
  const [resetKey, setResetKey] = useState(0);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const [showPaths, setShowPaths] = useState(false);
  const [explainMode, setExplainMode] = useState(false);
  const [hoveredId, setHoveredId] = useState<GhostId | null>(null);
  const [enabled, setEnabled] = useState<Record<GhostId, boolean>>({
    blinky: true,
    pinky: true,
    inky: true,
    clyde: true,
    warden: true,
  });
  const [pacController, setPacController] = useState<PacController>("human");
  const [showDanger, setShowDanger] = useState(false);

  const canvasRef = useRef<PacmanHandle>(null);

  const handleSnapshot = useCallback((s: Snapshot) => setSnap(s), []);
  const handleHover = useCallback((id: GhostId | null) => setHoveredId(id), []);
  const toggleGhost = useCallback(
    (id: GhostId) => setEnabled((e) => ({ ...e, [id]: !e[id] })),
    [],
  );
  const takeControl = useCallback(() => setPacController("human"), []);

  function handleReset() {
    setExplainMode(false);
    setRunning(!prefersReducedMotion());
    canvasRef.current?.reset();
    setResetKey((k) => k + 1);
  }

  const status = snap?.status ?? "playing";

  return (
    <ExperimentLayout
      glow="accent2"
      crumbs={[
        { label: t("experiments.pacman.title").toLowerCase(), to: "/experiments/pacman" },
        { label: t("experiments.pacman.subtitle") },
      ]}
      info={
        <>
          <div className="pacman-info-tagline">
            <ScrambleText text={t("experiments.pacman.tagline")} duration={600} />
          </div>
          <div className="pacman-info-desc">
            <ScrambleText text={t("experiments.pacman.intro")} duration={600} />
          </div>
        </>
      }
      sidebar={
        <Sidebar
          snap={snap}
          running={running}
          onPlayPause={() => setRunning((r) => !r)}
          onStep={() => canvasRef.current?.step()}
          onReset={handleReset}
          showOverlay={showOverlay}
          onToggleOverlay={() => setShowOverlay((v) => !v)}
          showPaths={showPaths}
          onTogglePaths={() => setShowPaths((v) => !v)}
          explainMode={explainMode}
          onToggleExplain={() => setExplainMode((v) => !v)}
          hoveredId={hoveredId}
          enabled={enabled}
          onToggleGhost={toggleGhost}
          pacController={pacController}
          onSetController={setPacController}
          showDanger={showDanger}
          onToggleDanger={() => setShowDanger((v) => !v)}
        />
      }
    >
      <div className="pacman-board">
        <PacmanCanvas
          ref={canvasRef}
          running={running}
          reduced={reduced}
          theme={theme}
          showOverlay={showOverlay}
          showPaths={showPaths}
          showDanger={showDanger}
          explainMode={explainMode}
          enabled={enabled}
          pacController={pacController}
          resetKey={resetKey}
          onSnapshot={handleSnapshot}
          onHover={handleHover}
          onTakeControl={takeControl}
        />
        {(status === "won" || status === "lost") && (
          <div className="pacman-status" role="status">
            <div className="pacman-status-title">
              <ScrambleText
                text={t(`experiments.pacman.status_${status}`)}
                duration={600}
              />
            </div>
            <div className="pacman-status-sub">
              <ScrambleText
                text={t(`experiments.pacman.status_${status}_sub`)}
                duration={600}
              />
            </div>
          </div>
        )}
      </div>
      <div className="pacman-legend">
        <span className="pacman-legend-item">
          <ScrambleText text={t("experiments.pacman.legend_target")} duration={500} />
        </span>
        <span className="pacman-legend-item">
          <ScrambleText text={t("experiments.pacman.legend_path")} duration={500} />
        </span>
        <span className="pacman-legend-hint">
          <ScrambleText text={t("experiments.pacman.controls_hint")} duration={600} />
        </span>
      </div>
    </ExperimentLayout>
  );
}
