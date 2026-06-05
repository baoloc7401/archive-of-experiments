import { useTranslation } from "react-i18next";
import ScrambleText from "../../../components/ScrambleText";
import { Panel, Stat, StatGrid } from "../../../components/ui";
import type { ColonySnapshot } from "../types";
import Convergence from "./Convergence";
import type { Theme } from "../../../hooks/useTheme";

interface Props {
  snap: ColonySnapshot | null;
  theme: Theme;
}

function fmt(n: number): string {
  return Number.isFinite(n) ? Math.round(n).toLocaleString() : "—";
}

export default function Stats({ snap, theme }: Props) {
  const { t } = useTranslation();
  const best = snap?.bestLength ?? Infinity;
  const nn = snap?.nnLength ?? Infinity;
  // How much shorter the colony's best tour is than the greedy NN baseline.
  const gain =
    Number.isFinite(best) && Number.isFinite(nn) && nn > 0
      ? ((nn - best) / nn) * 100
      : null;

  const converged = snap?.converged ? (
    <span className="aco-converged">
      <ScrambleText text={t("experiments.aco.converged")} duration={500} />
    </span>
  ) : undefined;

  return (
    <Panel title={t("experiments.aco.colony")} collapsible={false} aside={converged}>
      <StatGrid>
        <Stat
          label={t("experiments.aco.iteration")}
          value={snap ? snap.iteration.toLocaleString() : "—"}
        />
        <Stat label={t("experiments.aco.best_tour")} value={fmt(best)} highlight />
        <Stat label={t("experiments.aco.gen_avg")} value={fmt(snap?.lastAvgLength ?? Infinity)} />
        <Stat label={t("experiments.aco.greedy")} value={fmt(nn)} />
      </StatGrid>

      <div className={`aco-gain${gain != null && gain > 0 ? " aco-gain--good" : ""}`}>
        {gain != null ? (
          <ScrambleText
            text={t("experiments.aco.gain", {
              arrow: gain >= 0 ? "▼" : "▲",
              pct: Math.abs(gain).toFixed(1),
            })}
            duration={500}
          />
        ) : (
          <ScrambleText text={t("experiments.aco.gain_prompt")} duration={500} />
        )}
      </div>

      <Convergence history={snap?.history ?? []} theme={theme} />
    </Panel>
  );
}
