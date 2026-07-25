import { useTranslation } from "@/hooks/useTranslation";
import ScrambleText from "@/components/ScrambleText";
import { Panel, Slider, Tooltip } from "@/components/ui";
import type { AcoParams } from "../types";
import { PARAM_RANGES } from "../constants";

interface Props {
  params: AcoParams;
  onChange: (patch: Partial<AcoParams>) => void;
}

export default function Params({ params, onChange }: Props) {
  const { t } = useTranslation();
  return (
    <Panel title={t("experiments.aco.params")}>
      {PARAM_RANGES.map((r) => {
        const value = params[r.key];
        const display = r.key === "ants" ? String(value) : value.toFixed(r.step < 0.1 ? 2 : 1);
        return (
          <Slider
            key={r.key}
            stacked
            label={t(`experiments.aco.param.${r.key}`)}
            hint={t(`experiments.aco.param.${r.key}_hint`)}
            value={value}
            min={r.min}
            max={r.max}
            step={r.step}
            display={display}
            onChange={(v) => onChange({ [r.key]: v })}
          />
        );
      })}

      <Tooltip label={t("experiments.aco.elitist_hint")} block>
        <button
          className={`aco-toggle${params.elitist ? " aco-toggle--on" : ""}`}
          onClick={() => onChange({ elitist: !params.elitist })}
          role="switch"
          aria-checked={params.elitist}
        >
          <span className="aco-toggle-dot" aria-hidden="true" />
          <ScrambleText text={t("experiments.aco.elitist")} duration={500} />
        </button>
      </Tooltip>
    </Panel>
  );
}
