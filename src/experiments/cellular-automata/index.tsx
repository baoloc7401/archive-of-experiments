import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import ScrambleText from "@/components/ScrambleText";
import { ExperimentLayout } from "@/components/ui";
import { prefersReducedMotion } from "@/hooks/useReducedMotion";
import type { CAParams, CASnapshot, PaletteId, RuleGenome } from "./types";
import { CELL_LEVELS, DEFAULT_PARAMS } from "./constants";
import { PALETTE_IDS } from "./palettes";
import type { RulePreset } from "./rules";
import CACanvas, { type CAHandle } from "./components/CACanvas";
import Controls from "./components/Controls";
import RuleEditor from "./components/RuleEditor";
import BreedingLab from "./components/BreedingLab";
import Look from "./components/Look";
import DebugPanel from "./components/DebugPanel";
import "./CellularAutomata.css";

const PALETTE_KEY = "ca-palette";
const CELL_KEY = "ca-cell-size";
/** How many recent population samples DebugPanel's verdict heuristic looks at. */
const HISTORY_LEN = 30;

function loadPalette(): PaletteId {
  try {
    const raw = localStorage.getItem(PALETTE_KEY);
    if (raw && (PALETTE_IDS as string[]).includes(raw)) return raw as PaletteId;
  } catch {
    /* storage blocked */
  }
  return DEFAULT_PARAMS.palette;
}

function loadCellSize(): number {
  try {
    const raw = Number(localStorage.getItem(CELL_KEY));
    if (CELL_LEVELS.some((l) => l.px === raw)) return raw;
  } catch {
    /* storage blocked */
  }
  return DEFAULT_PARAMS.cellSize;
}

export default function CellularAutomata() {
  const { t } = useTranslation();

  const [params, setParams] = useState<CAParams>(() => ({
    ...DEFAULT_PARAMS,
    palette: loadPalette(),
    cellSize: loadCellSize(),
  }));
  // Paused for reduced-motion users; otherwise the field is already evolving
  // by the time the page settles.
  const [running, setRunning] = useState(() => !prefersReducedMotion());
  const [reseedKey, setReseedKey] = useState(0);
  const [clearKey, setClearKey] = useState(0);
  const [snap, setSnap] = useState<CASnapshot | null>(null);
  // Rolling population history for DebugPanel's verdict heuristic, accumulated
  // right alongside `snap` in the same callback - not derived via an effect.
  const [popHistory, setPopHistory] = useState<number[]>([]);

  const canvasRef = useRef<CAHandle>(null);

  const patch = useCallback(
    (p: Partial<CAParams>) => setParams((prev) => ({ ...prev, ...p })),
    [],
  );

  const handleStats = useCallback((s: CASnapshot) => {
    setSnap(s);
    setPopHistory((h) => [...h, s.population].slice(-HISTORY_LEN));
  }, []);

  // Selecting a preset jumps the whole genome AND re-seeds at its recommended
  // density, so each preset reliably shows its own behaviour instead of
  // inheriting whatever pattern was already on screen.
  const selectPreset = useCallback(
    (preset: RulePreset) => {
      patch({
        genome: { birth: preset.birth, survive: preset.survive, states: preset.states },
        reseedDensity: preset.density,
      });
      setReseedKey((k) => k + 1);
    },
    [patch],
  );

  const changeGenome = useCallback((genome: RuleGenome) => patch({ genome }), [patch]);

  // Adopting a breeding-lab offspring both swaps the rule AND re-seeds, same
  // as selecting a preset - a newly adopted rule always starts from a clean
  // field rather than morphing from whatever was mid-simulation.
  const adoptGenome = useCallback(
    (genome: RuleGenome) => {
      patch({ genome });
      setReseedKey((k) => k + 1);
    },
    [patch],
  );

  useEffect(() => {
    try {
      localStorage.setItem(PALETTE_KEY, params.palette);
      localStorage.setItem(CELL_KEY, String(params.cellSize));
    } catch {
      /* storage quota */
    }
  }, [params.palette, params.cellSize]);

  return (
    <ExperimentLayout
      glow="accent"
      crumbs={[
        {
          label: t("experiments.cellular-automata.title").toLowerCase(),
          to: "/experiments/cellular-automata",
        },
        { label: t("experiments.cellular-automata.subtitle") },
      ]}
      info={
        <>
          <div className="ca-info-tagline">
            <ScrambleText text={t("experiments.cellular-automata.tagline")} duration={600} />
          </div>
          <div className="ca-info-desc">
            <ScrambleText text={t("experiments.cellular-automata.intro")} duration={600} />
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
            onReseed={() => setReseedKey((k) => k + 1)}
            onClear={() => setClearKey((k) => k + 1)}
            onChange={patch}
          />
          <RuleEditor genome={params.genome} onChange={changeGenome} onPreset={selectPreset} />
          <BreedingLab genome={params.genome} palette={params.palette} onAdopt={adoptGenome} />
          <Look params={params} onChange={patch} onExport={() => canvasRef.current?.exportPng()} />
          <DebugPanel snap={snap} params={params} running={running} history={popHistory} />
          <div className="ca-hint">
            <ScrambleText text={t("experiments.cellular-automata.hint")} duration={600} />
          </div>
        </>
      }
    >
      <CACanvas
        ref={canvasRef}
        params={params}
        running={running}
        reseedKey={reseedKey}
        clearKey={clearKey}
        onStats={handleStats}
      />
      <div className="ca-legend">
        <ScrambleText text={t("experiments.cellular-automata.legend")} duration={600} />
      </div>
    </ExperimentLayout>
  );
}
