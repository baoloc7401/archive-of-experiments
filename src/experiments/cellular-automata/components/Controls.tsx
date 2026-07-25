import { useTranslation } from "@/hooks/useTranslation";
import ScrambleText from "@/components/ScrambleText";
import { Button, ControlBar, Panel, Slider } from "@/components/ui";
import type { BoundaryMode, BrushMode, CAParams } from "../types";
import {
  MAX_BRUSH,
  MAX_DENSITY,
  MAX_STEPS,
  MIN_BRUSH,
  MIN_DENSITY,
  MIN_STEPS,
} from "../constants";

interface Props {
  running: boolean;
  params: CAParams;
  onPlayPause: () => void;
  onStep: () => void;
  /** Fills the field with random noise at the current density. */
  onReseed: () => void;
  /** Wipes the field to all-dead - distinct from reseed, since a blank grid is
   *  genuinely useful for hand-drawing gliders/oscillators. */
  onClear: () => void;
  onChange: (p: Partial<CAParams>) => void;
}

const BOUNDARY_MODES: BoundaryMode[] = ["wrap", "void"];
const BRUSH_MODES: BrushMode[] = ["paint", "erase"];

export default function Controls({
  running,
  params,
  onPlayPause,
  onStep,
  onReseed,
  onClear,
  onChange,
}: Props) {
  const { t } = useTranslation();

  return (
    <>
      <Panel>
        <ControlBar
          playing={running}
          onPlayPause={onPlayPause}
          playLabel={t("experiments.cellular-automata.run")}
          pauseLabel={t("experiments.cellular-automata.pause")}
          onStep={onStep}
          stepLabel={t("experiments.cellular-automata.step")}
          stepHint={t("experiments.cellular-automata.step_hint")}
          onReset={onReseed}
          resetLabel={t("experiments.cellular-automata.reseed")}
          resetHint={t("experiments.cellular-automata.reseed_hint")}
        >
          <Slider
            label={t("experiments.cellular-automata.density")}
            value={params.reseedDensity}
            min={MIN_DENSITY}
            max={MAX_DENSITY}
            step={0.01}
            display={`${Math.round(params.reseedDensity * 100)}%`}
            onChange={(v) => onChange({ reseedDensity: v })}
            hint={t("experiments.cellular-automata.density_hint")}
          />
          <div className="ca-actions">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              tooltip={t("experiments.cellular-automata.clear_hint")}
            >
              <ScrambleText text={t("experiments.cellular-automata.clear")} duration={400} />
            </Button>
          </div>
        </ControlBar>
      </Panel>

      <Panel title={t("experiments.cellular-automata.session_title")} collapsible={false}>
        <div className="ca-look-field">
          <span className="ca-look-label">
            <ScrambleText text={t("experiments.cellular-automata.boundary")} duration={400} />
          </span>
          <div className="ca-presets">
            {BOUNDARY_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                className={`ca-chip${mode === params.boundary ? " ca-chip--on" : ""}`}
                aria-pressed={mode === params.boundary}
                onClick={() => onChange({ boundary: mode })}
              >
                <ScrambleText
                  text={t(`experiments.cellular-automata.boundary_${mode}`)}
                  duration={400}
                />
              </button>
            ))}
          </div>
        </div>

        <div className="ca-look-field">
          <span className="ca-look-label">
            <ScrambleText text={t("experiments.cellular-automata.brush_mode")} duration={400} />
          </span>
          <div className="ca-presets">
            {BRUSH_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                className={`ca-chip${mode === params.brushMode ? " ca-chip--on" : ""}`}
                aria-pressed={mode === params.brushMode}
                onClick={() => onChange({ brushMode: mode })}
              >
                <ScrambleText
                  text={t(`experiments.cellular-automata.brush_${mode}`)}
                  duration={400}
                />
              </button>
            ))}
          </div>
        </div>

        <Slider
          label={t("experiments.cellular-automata.brush_radius")}
          value={params.brushRadius}
          min={MIN_BRUSH}
          max={MAX_BRUSH}
          step={1}
          display={`${params.brushRadius}`}
          onChange={(v) => onChange({ brushRadius: v })}
          hint={t("experiments.cellular-automata.brush_radius_hint")}
        />

        <Slider
          label={t("experiments.cellular-automata.speed")}
          value={params.stepsPerFrame}
          min={MIN_STEPS}
          max={MAX_STEPS}
          step={1}
          display={`${params.stepsPerFrame}×`}
          onChange={(v) => onChange({ stepsPerFrame: v })}
          hint={t("experiments.cellular-automata.speed_hint")}
        />
      </Panel>
    </>
  );
}
