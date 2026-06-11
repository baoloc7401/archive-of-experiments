import { useTranslation } from "react-i18next";
import ScrambleText from "../../../components/ScrambleText";
import { Button, Panel, Slider } from "../../../components/ui";
import type { ColorMode, NBodyParams } from "../types";
import { MAX_TIME_SCALE, MAX_TRAILS, MIN_TIME_SCALE } from "../constants";
import SegRow from "./SegRow";

interface Props {
  params: NBodyParams;
  onChange: (p: Partial<NBodyParams>) => void;
  onExport: () => void;
}

const COLOR_MODES: ColorMode[] = ["speed", "mass", "mono"];

/**
 * Presentation controls that persist across reloads and scene switches
 * (colour, trails, time scale, auto-spin) plus the PNG export. Lives just
 * below the display so the quick visual tweaks sit next to what they change.
 */
export default function Look({ params, onChange, onExport }: Props) {
  const { t } = useTranslation();
  return (
    <Panel title={t("experiments.n-body.look_title")}>
      <div className="nb-field">
        <SegRow
          label={t("experiments.n-body.color")}
          prefix="experiments.n-body.color_"
          value={params.colorMode}
          options={COLOR_MODES}
          onSelect={(v) => onChange({ colorMode: v })}
        />
      </div>
      <Slider
        label={t("experiments.n-body.time_scale")}
        value={params.timeScale}
        min={MIN_TIME_SCALE}
        max={MAX_TIME_SCALE}
        step={0.1}
        display={`${params.timeScale.toFixed(1)}×`}
        onChange={(v) => onChange({ timeScale: v })}
        hint={t("experiments.n-body.time_scale_hint")}
      />
      <Slider
        label={t("experiments.n-body.trails")}
        value={params.trails}
        min={0}
        max={MAX_TRAILS}
        step={0.5}
        display={
          params.trails === 0 ? t("experiments.n-body.trails_off") : `${params.trails.toFixed(1)}s`
        }
        onChange={(v) => onChange({ trails: v })}
        hint={t("experiments.n-body.trails_hint")}
      />
      <div className="nb-actions">
        <Button
          variant={params.spin ? "accent" : "ghost"}
          size="sm"
          onClick={() => onChange({ spin: !params.spin })}
          aria-pressed={params.spin}
          tooltip={t("experiments.n-body.spin_hint")}
        >
          <ScrambleText text={t("experiments.n-body.spin")} duration={400} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onExport}
          tooltip={t("experiments.n-body.export_hint")}
        >
          <ScrambleText text={t("experiments.n-body.export")} duration={400} />
        </Button>
      </div>
    </Panel>
  );
}
