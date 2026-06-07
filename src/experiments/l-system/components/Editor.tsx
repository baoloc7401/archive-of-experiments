import { useTranslation } from "react-i18next";
import ScrambleText from "../../../components/ScrambleText";
import { Button, Panel, Slider } from "../../../components/ui";
import type { ColorMode, LParams } from "../types";
import {
  COLOR_MODES,
  MAX_ANGLE,
  MAX_FOG,
  MAX_ITER,
  MAX_SPIN,
  MAX_TAPER,
  MAX_THICK,
  MIN_ANGLE,
  MIN_FOG,
  MIN_ITER,
  MIN_SPIN,
  MIN_TAPER,
  MIN_THICK,
} from "../constants";

interface Props {
  params: LParams;
  onChange: (p: Partial<LParams>) => void;
  onExport: () => void;
}

/**
 * The grammar editor and look controls. Lives in a horizontal band under the
 * stage (not the sidebar) so the textarea and sliders get the full canvas width.
 */
export default function Editor({ params, onChange, onExport }: Props) {
  const { t } = useTranslation();

  return (
    <>
      <Panel title={t("experiments.l-system.grammar")} collapsible={false}>
        <label className="ls-field">
          <span className="ls-field-label">
            <ScrambleText text={t("experiments.l-system.axiom")} duration={400} />
          </span>
          <input
            className="ls-input"
            type="text"
            spellCheck={false}
            value={params.axiom}
            onChange={(e) => onChange({ axiom: e.target.value })}
          />
        </label>
        <label className="ls-field">
          <span className="ls-field-label">
            <ScrambleText text={t("experiments.l-system.rules")} duration={400} />
          </span>
          <textarea
            className="ls-input ls-textarea"
            spellCheck={false}
            rows={4}
            value={params.rules}
            onChange={(e) => onChange({ rules: e.target.value })}
          />
        </label>
        <p className="ls-field-hint">
          <ScrambleText text={t("experiments.l-system.grammar_hint")} duration={600} />
        </p>
        <Slider
          label={t("experiments.l-system.iterations")}
          value={params.iterations}
          min={MIN_ITER}
          max={MAX_ITER}
          step={1}
          onChange={(v) => onChange({ iterations: v })}
          hint={t("experiments.l-system.iterations_hint")}
        />
        <Slider
          label={t("experiments.l-system.angle")}
          value={params.angle}
          min={MIN_ANGLE}
          max={MAX_ANGLE}
          step={0.5}
          display={`${params.angle}°`}
          onChange={(v) => onChange({ angle: v })}
          hint={t("experiments.l-system.angle_hint")}
        />
      </Panel>

      <Panel title={t("experiments.l-system.look")} collapsible={false}>
        <div className="ls-field-row">
          <span className="ls-field-label">
            <ScrambleText text={t("experiments.l-system.color")} duration={400} />
          </span>
          <div className="ls-seg">
            {COLOR_MODES.map((mode: ColorMode) => (
              <button
                key={mode}
                type="button"
                className={`ls-seg-btn${mode === params.colorMode ? " ls-seg-btn--on" : ""}`}
                aria-pressed={mode === params.colorMode}
                onClick={() => onChange({ colorMode: mode })}
              >
                <ScrambleText text={t(`experiments.l-system.color_${mode}`)} duration={400} />
              </button>
            ))}
          </div>
        </div>
        <Slider
          label={t("experiments.l-system.thickness")}
          value={params.thickness}
          min={MIN_THICK}
          max={MAX_THICK}
          step={0.2}
          display={params.thickness.toFixed(1)}
          onChange={(v) => onChange({ thickness: v })}
          hint={t("experiments.l-system.thickness_hint")}
        />
        <Slider
          label={t("experiments.l-system.taper")}
          value={params.taper}
          min={MIN_TAPER}
          max={MAX_TAPER}
          step={0.05}
          display={params.taper.toFixed(2)}
          onChange={(v) => onChange({ taper: v })}
          hint={t("experiments.l-system.taper_hint")}
        />
        <Slider
          label={t("experiments.l-system.fog")}
          value={params.fog}
          min={MIN_FOG}
          max={MAX_FOG}
          step={0.05}
          display={params.fog.toFixed(2)}
          onChange={(v) => onChange({ fog: v })}
          hint={t("experiments.l-system.fog_hint")}
        />
        <Slider
          label={t("experiments.l-system.spin_speed")}
          value={params.spinSpeed}
          min={MIN_SPIN}
          max={MAX_SPIN}
          step={0.05}
          display={params.spinSpeed.toFixed(2)}
          onChange={(v) => onChange({ spinSpeed: v })}
          hint={t("experiments.l-system.spin_speed_hint")}
        />
        <div className="ls-actions">
          <Button
            variant="ghost"
            size="sm"
            onClick={onExport}
            tooltip={t("experiments.l-system.export_hint")}
          >
            <ScrambleText text={t("experiments.l-system.export")} duration={400} />
          </Button>
        </div>
      </Panel>
    </>
  );
}
