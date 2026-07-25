import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import ScrambleText from "@/components/ScrambleText";
import { ExperimentLayout } from "@/components/ui";
import { prefersReducedMotion } from "@/hooks/useReducedMotion";
import type { PaletteId, RDParams, RDSnapshot } from "./types";
import { DEFAULT_PARAMS, RES_LEVELS } from "./constants";
import { PALETTE_IDS } from "./palettes";
import RDCanvas, { type RDHandle } from "./components/RDCanvas";
import Controls from "./components/Controls";
import Look from "./components/Look";
import Preview from "./components/Preview";
import DebugPanel from "./components/DebugPanel";
import "./ReactionDiffusion.css";

const PALETTE_KEY = "rd-palette";
const RES_KEY = "rd-resolution";

function loadPalette(): PaletteId {
  try {
    const raw = localStorage.getItem(PALETTE_KEY);
    if (raw && (PALETTE_IDS as string[]).includes(raw)) return raw as PaletteId;
  } catch {
    /* storage blocked */
  }
  return DEFAULT_PARAMS.palette;
}

function loadResolution(): number {
  try {
    const raw = Number(localStorage.getItem(RES_KEY));
    if (RES_LEVELS.some((l) => l.scale === raw)) return raw;
  } catch {
    /* storage blocked */
  }
  return DEFAULT_PARAMS.resolution;
}

export default function ReactionDiffusion() {
  const { t } = useTranslation();

  const [params, setParams] = useState<RDParams>(() => ({
    ...DEFAULT_PARAMS,
    palette: loadPalette(),
    resolution: loadResolution(),
  }));
  // Paused for reduced-motion users; otherwise the field is already evolving
  // by the time the page settles.
  const [running, setRunning] = useState(() => !prefersReducedMotion());
  const [resetKey, setResetKey] = useState(0);
  const [snap, setSnap] = useState<RDSnapshot | null>(null);

  const canvasRef = useRef<RDHandle>(null);

  const patch = useCallback(
    (p: Partial<RDParams>) => setParams((prev) => ({ ...prev, ...p })),
    [],
  );

  const handleStats = useCallback((s: RDSnapshot) => setSnap(s), []);

  // Selecting a preset jumps f/k AND re-seeds, so each preset reliably shows its
  // own pattern instead of morphing (and often dying) from the previous field.
  const selectPreset = useCallback(
    (feed: number, kill: number) => {
      patch({ feed, kill });
      setResetKey((k) => k + 1);
    },
    [patch],
  );

  useEffect(() => {
    try {
      localStorage.setItem(PALETTE_KEY, params.palette);
      localStorage.setItem(RES_KEY, String(params.resolution));
    } catch {
      /* storage quota */
    }
  }, [params.palette, params.resolution]);

  return (
    <ExperimentLayout
      glow="accent2"
      crumbs={[
        {
          label: t("experiments.reaction-diffusion.title").toLowerCase(),
          to: "/experiments/reaction-diffusion",
        },
        { label: t("experiments.reaction-diffusion.subtitle") },
      ]}
      info={
        <>
          <div className="rd-info-tagline">
            <ScrambleText text={t("experiments.reaction-diffusion.tagline")} duration={600} />
          </div>
          <div className="rd-info-desc">
            <ScrambleText text={t("experiments.reaction-diffusion.intro")} duration={600} />
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
            onPreset={selectPreset}
          />
          <Preview params={params} />
          <Look params={params} onChange={patch} onExport={() => canvasRef.current?.exportPng()} />
          <DebugPanel snap={snap} params={params} running={running} />
          <div className="rd-hint">
            <ScrambleText text={t("experiments.reaction-diffusion.hint")} duration={600} />
          </div>
        </>
      }
    >
      <RDCanvas
        ref={canvasRef}
        params={params}
        running={running}
        resetKey={resetKey}
        onStats={handleStats}
      />
      <div className="rd-legend">
        <ScrambleText text={t("experiments.reaction-diffusion.legend")} duration={600} />
      </div>
    </ExperimentLayout>
  );
}
