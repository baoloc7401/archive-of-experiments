import ScrambleText from "../../../components/ScrambleText";
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
  const best = snap?.bestLength ?? Infinity;
  const nn = snap?.nnLength ?? Infinity;
  // How much shorter the colony's best tour is than the greedy NN baseline.
  const gain =
    Number.isFinite(best) && Number.isFinite(nn) && nn > 0
      ? ((nn - best) / nn) * 100
      : null;

  return (
    <div className="aco-stats">
      <div className="aco-panel-title aco-stats-title">
        <ScrambleText text="colony" duration={500} />
        {snap?.converged && (
          <span className="aco-converged">
            <ScrambleText text="converged" duration={500} />
          </span>
        )}
      </div>

      <div className="aco-stat-grid">
        <div className="aco-stat">
          <span className="aco-stat-label"><ScrambleText text="iteration" duration={500} /></span>
          <span className="aco-stat-val">{snap ? snap.iteration.toLocaleString() : "—"}</span>
        </div>
        <div className="aco-stat aco-stat--hi">
          <span className="aco-stat-label"><ScrambleText text="best tour" duration={500} /></span>
          <span className="aco-stat-val">{fmt(best)}</span>
        </div>
        <div className="aco-stat">
          <span className="aco-stat-label"><ScrambleText text="gen avg" duration={500} /></span>
          <span className="aco-stat-val">{fmt(snap?.lastAvgLength ?? Infinity)}</span>
        </div>
        <div className="aco-stat">
          <span className="aco-stat-label"><ScrambleText text="greedy (NN)" duration={500} /></span>
          <span className="aco-stat-val">{fmt(nn)}</span>
        </div>
      </div>

      <div className={`aco-gain${gain != null && gain > 0 ? " aco-gain--good" : ""}`}>
        {gain != null ? (
          <ScrambleText
            text={`${gain >= 0 ? "▼" : "▲"} ${Math.abs(gain).toFixed(1)}% vs greedy baseline`}
            duration={500}
          />
        ) : (
          <ScrambleText text="run to beat the greedy tour" duration={500} />
        )}
      </div>

      <Convergence history={snap?.history ?? []} theme={theme} />
    </div>
  );
}
