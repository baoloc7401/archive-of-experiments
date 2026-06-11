import { useTranslation } from "react-i18next";
import ScrambleText from "../../../components/ScrambleText";
import { Button, ControlBar, Panel, Slider } from "../../../components/ui";
import type { Integrator, NBodyParams } from "../types";
import {
  MAX_COUNT,
  MAX_GRAVITY,
  MAX_SOFTENING,
  MAX_THETA,
  MIN_GRAVITY,
  MIN_SOFTENING,
} from "../constants";
import { PRESETS, presetById } from "../presets";
import SegRow from "./SegRow";

interface Props {
  running: boolean;
  params: NBodyParams;
  onPlayPause: () => void;
  onStep: () => void;
  onReset: () => void;
  onChange: (p: Partial<NBodyParams>) => void;
}

const INTEGRATORS: Integrator[] = ["leapfrog", "euler"];

export default function Controls({
  running,
  params,
  onPlayPause,
  onStep,
  onReset,
  onChange,
}: Props) {
  const { t } = useTranslation();
  const def = presetById(params.preset);

  return (
    <>
      <Panel>
        <ControlBar
          playing={running}
          onPlayPause={onPlayPause}
          playLabel={t("experiments.n-body.run")}
          pauseLabel={t("experiments.n-body.pause")}
          onStep={onStep}
          stepLabel={t("experiments.n-body.step")}
          stepHint={t("experiments.n-body.step_hint")}
          onReset={onReset}
          resetLabel={t("experiments.n-body.reset")}
          resetHint={t("experiments.n-body.reset_hint")}
        />
      </Panel>

      <Panel title={t("experiments.n-body.presets")}>
        <div className="nb-presets">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`nb-chip${preset.id === params.preset ? " nb-chip--on" : ""}`}
              aria-pressed={preset.id === params.preset}
              onClick={() =>
                // Reset substep first so scenes that do not set one fall back
                // to the default rather than inheriting the previous scene's.
                onChange({ preset: preset.id, count: preset.count, substep: undefined, ...preset.overrides })
              }
            >
              <ScrambleText text={t(`experiments.n-body.preset_${preset.id}`)} duration={400} />
            </button>
          ))}
        </div>
      </Panel>

      <Panel title={t("experiments.n-body.sim_title")} collapsible={false}>
        <Slider
          label={t("experiments.n-body.bodies")}
          value={def.locked ? def.count : params.count}
          min={def.minCount}
          max={MAX_COUNT}
          step={100}
          display={(def.locked ? def.count : params.count).toLocaleString()}
          disabled={def.locked}
          onChange={(v) => onChange({ count: v })}
          hint={t("experiments.n-body.bodies_hint")}
        />
        <Slider
          label={t("experiments.n-body.gravity")}
          value={params.gravity}
          min={MIN_GRAVITY}
          max={MAX_GRAVITY}
          step={0.1}
          display={`${params.gravity.toFixed(1)}×`}
          onChange={(v) => onChange({ gravity: v })}
          hint={t("experiments.n-body.gravity_hint")}
        />
        <Slider
          label={t("experiments.n-body.softening")}
          value={params.softening}
          min={MIN_SOFTENING}
          max={MAX_SOFTENING}
          step={0.002}
          display={params.softening.toFixed(3)}
          onChange={(v) => onChange({ softening: v })}
          hint={t("experiments.n-body.softening_hint")}
        />
        <Slider
          label={t("experiments.n-body.theta")}
          value={params.theta}
          min={0}
          max={MAX_THETA}
          step={0.05}
          display={params.theta === 0 ? t("experiments.n-body.theta_exact") : params.theta.toFixed(2)}
          onChange={(v) => onChange({ theta: v })}
          hint={t("experiments.n-body.theta_hint")}
        />
        <div className="nb-field">
          <SegRow
            label={t("experiments.n-body.integrator")}
            prefix="experiments.n-body.integrator_"
            value={params.integrator}
            options={INTEGRATORS}
            onSelect={(v) => onChange({ integrator: v })}
          />
          <p className="nb-field-hint">
            <ScrambleText text={t("experiments.n-body.integrator_hint")} duration={600} />
          </p>
          <div className="nb-actions">
            <Button
              variant={params.merging ? "accent" : "ghost"}
              size="sm"
              onClick={() => onChange({ merging: !params.merging })}
              aria-pressed={params.merging}
              tooltip={t("experiments.n-body.merging_hint")}
            >
              <ScrambleText text={t("experiments.n-body.merging")} duration={400} />
            </Button>
          </div>
        </div>
      </Panel>
    </>
  );
}
