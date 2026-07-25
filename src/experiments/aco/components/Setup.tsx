import { useTranslation } from "@/hooks/useTranslation";
import ScrambleText from "@/components/ScrambleText";
import { Button, Panel, Slider, Tooltip } from "@/components/ui";
import type { LayoutId } from "../types";
import { LAYOUTS, MIN_CITIES, MAX_CITIES } from "../constants";

interface Props {
  layout: LayoutId;
  count: number;
  onLayout: (id: LayoutId) => void;
  onCount: (n: number) => void;
  onScatter: () => void;
  onClear: () => void;
}

export default function Setup({
  layout,
  count,
  onLayout,
  onCount,
  onScatter,
  onClear,
}: Props) {
  const { t } = useTranslation();
  return (
    <Panel title={t("experiments.aco.cities")}>
      <div className="aco-layout-row">
        {LAYOUTS.map((l) => (
          <Tooltip key={l.id} label={t(`experiments.aco.layout.${l.id}_hint`)}>
            <button
              className={`aco-chip${layout === l.id ? " aco-chip--on" : ""}`}
              onClick={() => onLayout(l.id)}
            >
              <ScrambleText text={t(`experiments.aco.layout.${l.id}`)} duration={500} />
            </button>
          </Tooltip>
        ))}
      </div>

      <Slider
        stacked
        label={t("experiments.aco.count")}
        hint={t("experiments.aco.count_hint")}
        value={count}
        min={MIN_CITIES}
        max={MAX_CITIES}
        display={count}
        onChange={onCount}
      />

      <div className="aco-setup-btns">
        <Button onClick={onScatter}>
          <ScrambleText text={t("experiments.aco.scatter")} duration={500} />
        </Button>
        <Button onClick={onClear} tooltip={t("experiments.aco.clear_hint")}>
          <ScrambleText text={t("experiments.aco.clear")} duration={500} />
        </Button>
      </div>
    </Panel>
  );
}
