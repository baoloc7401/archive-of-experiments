import { useTranslation } from "react-i18next";
import ScrambleText from "../../../components/ScrambleText";
import { ControlBar, Panel, Slider } from "../../../components/ui";
import type { RDParams } from "../types";
import {
  FEED_STEP,
  KILL_STEP,
  MAX_BRUSH,
  MAX_DT,
  MAX_DU,
  MAX_DV,
  MAX_FEED,
  MAX_KILL,
  MAX_STEPS,
  MIN_BRUSH,
  MIN_DT,
  MIN_DU,
  MIN_DV,
  MIN_FEED,
  MIN_KILL,
  MIN_STEPS,
} from "../constants";
import { PRESETS, matchPreset } from "../presets";

interface Props {
  running: boolean;
  params: RDParams;
  onPlayPause: () => void;
  onStep: () => void;
  onReset: () => void;
  onChange: (p: Partial<RDParams>) => void;
  /** Apply a preset's f/k AND re-seed, so each preset shows its own pattern. */
  onPreset: (feed: number, kill: number) => void;
}

export default function Controls({
  running,
  params,
  onPlayPause,
  onStep,
  onReset,
  onChange,
  onPreset,
}: Props) {
  const { t } = useTranslation();
  const active = matchPreset(params.feed, params.kill);

  return (
    <>
      <Panel>
        <ControlBar
          playing={running}
          onPlayPause={onPlayPause}
          playLabel={t("experiments.reaction-diffusion.run")}
          pauseLabel={t("experiments.reaction-diffusion.pause")}
          onStep={onStep}
          stepLabel={t("experiments.reaction-diffusion.step")}
          stepHint={t("experiments.reaction-diffusion.step_hint")}
          onReset={onReset}
          resetLabel={t("experiments.reaction-diffusion.reset")}
          resetHint={t("experiments.reaction-diffusion.reset_hint")}
        />
      </Panel>

      <Panel title={t("experiments.reaction-diffusion.patterns")}>
        <div className="rd-presets">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`rd-chip${preset.id === active ? " rd-chip--on" : ""}`}
              aria-pressed={preset.id === active}
              onClick={() => onPreset(preset.feed, preset.kill)}
            >
              <ScrambleText
                text={t(`experiments.reaction-diffusion.preset_${preset.id}`)}
                duration={400}
              />
            </button>
          ))}
        </div>
      </Panel>

      <Panel title={t("experiments.reaction-diffusion.reaction_title")} collapsible={false}>
        <Slider
          label={t("experiments.reaction-diffusion.feed")}
          value={params.feed}
          min={MIN_FEED}
          max={MAX_FEED}
          step={FEED_STEP}
          display={params.feed.toFixed(4)}
          onChange={(v) => onChange({ feed: v })}
          hint={t("experiments.reaction-diffusion.feed_hint")}
        />
        <Slider
          label={t("experiments.reaction-diffusion.kill")}
          value={params.kill}
          min={MIN_KILL}
          max={MAX_KILL}
          step={KILL_STEP}
          display={params.kill.toFixed(4)}
          onChange={(v) => onChange({ kill: v })}
          hint={t("experiments.reaction-diffusion.kill_hint")}
        />
        <Slider
          label={t("experiments.reaction-diffusion.brush")}
          value={params.brushSize}
          min={MIN_BRUSH}
          max={MAX_BRUSH}
          step={1}
          display={`${params.brushSize}`}
          onChange={(v) => onChange({ brushSize: v })}
          hint={t("experiments.reaction-diffusion.brush_hint")}
        />
        <Slider
          label={t("experiments.reaction-diffusion.speed")}
          value={params.stepsPerFrame}
          min={MIN_STEPS}
          max={MAX_STEPS}
          step={1}
          display={`${params.stepsPerFrame}×`}
          onChange={(v) => onChange({ stepsPerFrame: v })}
          hint={t("experiments.reaction-diffusion.speed_hint")}
        />
      </Panel>

      <Panel title={t("experiments.reaction-diffusion.advanced_title")} defaultOpen={false}>
        <Slider
          label={t("experiments.reaction-diffusion.du")}
          value={params.du}
          min={MIN_DU}
          max={MAX_DU}
          step={0.02}
          display={params.du.toFixed(2)}
          onChange={(v) => onChange({ du: v })}
          hint={t("experiments.reaction-diffusion.du_hint")}
        />
        <Slider
          label={t("experiments.reaction-diffusion.dv")}
          value={params.dv}
          min={MIN_DV}
          max={MAX_DV}
          step={0.02}
          display={params.dv.toFixed(2)}
          onChange={(v) => onChange({ dv: v })}
          hint={t("experiments.reaction-diffusion.dv_hint")}
        />
        <Slider
          label={t("experiments.reaction-diffusion.dt")}
          value={params.dt}
          min={MIN_DT}
          max={MAX_DT}
          step={0.05}
          display={params.dt.toFixed(2)}
          onChange={(v) => onChange({ dt: v })}
          hint={t("experiments.reaction-diffusion.dt_hint")}
        />
      </Panel>
    </>
  );
}
