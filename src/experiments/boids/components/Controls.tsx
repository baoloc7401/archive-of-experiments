import { useTranslation } from "@/hooks/useTranslation";
import ScrambleText from "@/components/ScrambleText";
import { Button, ControlBar, Panel, Slider } from "@/components/ui";
import type { BoidParams, ColorMode, EdgeMode, PointerMode, PointerTool, SeedMode } from "../types";
import {
  MAX_COUNT,
  MAX_FLOW,
  MAX_FOV,
  MAX_PREDATORS,
  MAX_RADIUS,
  MAX_SPECIES,
  MAX_SPEED,
  MAX_WEIGHT,
  MIN_COUNT,
  MIN_FLOW,
  MIN_FOV,
  MIN_PREDATORS,
  MIN_RADIUS,
  MIN_SPECIES,
  MIN_SPEED,
  MIN_WEIGHT,
  PRESETS,
} from "../constants";

interface Props {
  running: boolean;
  params: BoidParams;
  onPlayPause: () => void;
  onStep: () => void;
  onReset: () => void;
  onChange: (p: Partial<BoidParams>) => void;
  onExport: () => void;
  onClear: () => void;
}

const EDGE_MODES: EdgeMode[] = ["wrap", "bounce", "avoid"];
const POINTER_MODES: PointerMode[] = ["repel", "attract"];
const COLOR_MODES: ColorMode[] = ["heading", "speed", "density"];
const TOOL_MODES: PointerTool[] = ["push", "obstacle", "goal"];
const SEED_MODES: SeedMode[] = ["scatter", "ring", "grid", "clumps", "point"];

interface SegRowProps<T extends string> {
  label: string;
  /** i18n key prefix; option `o` resolves to `${prefix}${o}`. */
  prefix: string;
  value: T;
  options: readonly T[];
  onSelect: (value: T) => void;
}

// A labeled row of mutually-exclusive segmented buttons.
function SegRow<T extends string>({ label, prefix, value, options, onSelect }: SegRowProps<T>) {
  const { t } = useTranslation();
  return (
    <div className="boids-field-row">
      <span className="boids-field-label">
        <ScrambleText text={label} duration={400} />
      </span>
      <div className="boids-seg">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            className={`boids-seg-btn${opt === value ? " boids-seg-btn--on" : ""}`}
            aria-pressed={opt === value}
            onClick={() => onSelect(opt)}
          >
            <ScrambleText text={t(`${prefix}${opt}`)} duration={400} />
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Controls({
  running,
  params,
  onPlayPause,
  onStep,
  onReset,
  onChange,
  onExport,
  onClear,
}: Props) {
  const { t } = useTranslation();

  // A preset is "selected" while every field it sets still matches the live
  // params; dragging any of those sliders deselects it.
  const activePreset =
    PRESETS.find((preset) =>
      (Object.keys(preset.params) as (keyof BoidParams)[]).every(
        (k) => params[k] === preset.params[k],
      ),
    )?.id ?? null;

  return (
    <>
      <Panel>
        <ControlBar
          playing={running}
          onPlayPause={onPlayPause}
          playLabel={t("experiments.boids.run")}
          pauseLabel={t("experiments.boids.pause")}
          onStep={onStep}
          stepLabel={t("experiments.boids.step")}
          stepHint={t("experiments.boids.step_hint")}
          onReset={onReset}
          resetLabel={t("experiments.boids.reset")}
          resetHint={t("experiments.boids.reset_hint")}
        />
      </Panel>

      <Panel title={t("experiments.boids.presets")}>
        <div className="boids-presets">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`boids-chip${preset.id === activePreset ? " boids-chip--on" : ""}`}
              aria-pressed={preset.id === activePreset}
              onClick={() => onChange(preset.params)}
            >
              <ScrambleText text={t(`experiments.boids.preset_${preset.id}`)} duration={400} />
            </button>
          ))}
        </div>
      </Panel>

      <Panel title={t("experiments.boids.rules")} collapsible={false}>
        <Slider
          label={t("experiments.boids.separation")}
          value={params.separation}
          min={MIN_WEIGHT}
          max={MAX_WEIGHT}
          step={0.1}
          display={params.separation.toFixed(1)}
          onChange={(v) => onChange({ separation: v })}
          hint={t("experiments.boids.separation_hint")}
        />
        <Slider
          label={t("experiments.boids.alignment")}
          value={params.alignment}
          min={MIN_WEIGHT}
          max={MAX_WEIGHT}
          step={0.1}
          display={params.alignment.toFixed(1)}
          onChange={(v) => onChange({ alignment: v })}
          hint={t("experiments.boids.alignment_hint")}
        />
        <Slider
          label={t("experiments.boids.cohesion")}
          value={params.cohesion}
          min={MIN_WEIGHT}
          max={MAX_WEIGHT}
          step={0.1}
          display={params.cohesion.toFixed(1)}
          onChange={(v) => onChange({ cohesion: v })}
          hint={t("experiments.boids.cohesion_hint")}
        />
      </Panel>

      <Panel title={t("experiments.boids.flock_title")}>
        <Slider
          label={t("experiments.boids.count")}
          value={params.count}
          min={MIN_COUNT}
          max={MAX_COUNT}
          step={10}
          onChange={(v) => onChange({ count: v })}
          hint={t("experiments.boids.count_hint")}
        />
        <Slider
          label={t("experiments.boids.radius")}
          value={params.radius}
          min={MIN_RADIUS}
          max={MAX_RADIUS}
          step={5}
          display={`${params.radius}px`}
          onChange={(v) => onChange({ radius: v })}
          hint={t("experiments.boids.radius_hint")}
        />
        <Slider
          label={t("experiments.boids.max_speed")}
          value={params.maxSpeed}
          min={MIN_SPEED}
          max={MAX_SPEED}
          step={0.2}
          display={params.maxSpeed.toFixed(1)}
          onChange={(v) => onChange({ maxSpeed: v })}
          hint={t("experiments.boids.max_speed_hint")}
        />
        <Slider
          label={t("experiments.boids.fov")}
          value={params.fov}
          min={MIN_FOV}
          max={MAX_FOV}
          step={10}
          display={`${params.fov}°`}
          onChange={(v) => onChange({ fov: v })}
          hint={t("experiments.boids.fov_hint")}
        />
      </Panel>

      <Panel title={t("experiments.boids.world_title")} defaultOpen={false}>
        <Slider
          label={t("experiments.boids.flow")}
          value={params.flow}
          min={MIN_FLOW}
          max={MAX_FLOW}
          step={0.1}
          display={params.flow.toFixed(1)}
          onChange={(v) => onChange({ flow: v })}
          hint={t("experiments.boids.flow_hint")}
        />
        <Slider
          label={t("experiments.boids.species")}
          value={params.speciesCount}
          min={MIN_SPECIES}
          max={MAX_SPECIES}
          step={1}
          onChange={(v) => onChange({ speciesCount: v })}
          hint={t("experiments.boids.species_hint")}
        />
        <Slider
          label={t("experiments.boids.predators")}
          value={params.predatorCount}
          min={MIN_PREDATORS}
          max={MAX_PREDATORS}
          step={1}
          onChange={(v) => onChange({ predatorCount: v })}
          hint={t("experiments.boids.predators_hint")}
        />
        <div className="boids-field">
          <SegRow
            label={t("experiments.boids.formation")}
            prefix="experiments.boids.formation_"
            value={params.seedMode}
            options={SEED_MODES}
            onSelect={(v) => onChange({ seedMode: v })}
          />
        </div>
      </Panel>

      <Panel title={t("experiments.boids.field_title")} defaultOpen={false}>
        <div className="boids-field">
          <SegRow
            label={t("experiments.boids.edges")}
            prefix="experiments.boids.edges_"
            value={params.edges}
            options={EDGE_MODES}
            onSelect={(v) => onChange({ edges: v })}
          />
          <SegRow
            label={t("experiments.boids.color")}
            prefix="experiments.boids.color_"
            value={params.colorMode}
            options={COLOR_MODES}
            onSelect={(v) => onChange({ colorMode: v })}
          />
          <SegRow
            label={t("experiments.boids.tool")}
            prefix="experiments.boids.tool_"
            value={params.pointerTool}
            options={TOOL_MODES}
            onSelect={(v) => onChange({ pointerTool: v })}
          />
          <SegRow
            label={t("experiments.boids.pointer")}
            prefix="experiments.boids.pointer_"
            value={params.pointerMode}
            options={POINTER_MODES}
            onSelect={(v) => onChange({ pointerMode: v })}
          />
          <div className="boids-actions">
            <Button
              variant={params.trails ? "accent" : "ghost"}
              size="sm"
              onClick={() => onChange({ trails: !params.trails })}
              tooltip={t("experiments.boids.trails_hint")}
            >
              <ScrambleText text={t("experiments.boids.trails")} duration={400} />
            </Button>
            <Button variant="ghost" size="sm" onClick={onClear} tooltip={t("experiments.boids.clear_hint")}>
              <ScrambleText text={t("experiments.boids.clear")} duration={400} />
            </Button>
            <Button variant="ghost" size="sm" onClick={onExport} tooltip={t("experiments.boids.export_hint")}>
              <ScrambleText text={t("experiments.boids.export")} duration={400} />
            </Button>
          </div>
          <p className="boids-field-hint">
            <ScrambleText text={t("experiments.boids.tool_hint")} duration={600} />
          </p>
        </div>
      </Panel>
    </>
  );
}
