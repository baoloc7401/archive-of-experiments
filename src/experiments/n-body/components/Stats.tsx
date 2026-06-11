import { useTranslation } from "react-i18next";
import ScrambleText from "../../../components/ScrambleText";
import { Panel, Stat, StatGrid } from "../../../components/ui";
import { DRIFT_WARN } from "../constants";
import type { NBodySnapshot } from "../types";

interface Props {
  snap: NBodySnapshot | null;
}

const DASH = "-";

function compact(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(Math.round(n));
}

export default function Stats({ snap }: Props) {
  const { t } = useTranslation();
  const k = (key: string) => t(`experiments.n-body.${key}`);

  const driftPct = snap ? snap.drift * 100 : 0;
  const driftWarn = snap !== null && Math.abs(snap.drift) > DRIFT_WARN;
  const driftValue = snap ? (
    <span className={driftWarn ? "nb-drift-warn" : undefined}>
      {`${driftPct >= 0 ? "+" : ""}${driftPct.toFixed(2)}%`}
    </span>
  ) : (
    DASH
  );

  return (
    <Panel title={k("telemetry")}>
      <StatGrid>
        <Stat label={k("stat_bodies")} value={snap ? snap.count.toLocaleString() : DASH} />
        <Stat label={k("stat_fps")} value={snap ? Math.round(snap.fps) : DASH} />
        <Stat
          label={k("stat_evals")}
          value={snap ? `${compact(snap.evals)} · ${snap.evalsPct.toFixed(1)}%` : DASH}
        />
        <Stat label={k("stat_time")} value={snap ? `${snap.simTime.toFixed(1)}s` : DASH} />
        <Stat label={k("stat_energy")} value={snap ? snap.total.toFixed(3) : DASH} />
        <Stat label={k("stat_drift")} value={driftValue} highlight />
      </StatGrid>
      {snap && snap.follow >= 0 && (
        <div className="nb-follow">
          <span className="nb-follow-label">
            <ScrambleText text={k("followed")} duration={400} />
          </span>
          <span className="nb-follow-val">
            {`m ${snap.followMass.toExponential(1)} · v ${snap.followSpeed.toFixed(2)}`}
          </span>
        </div>
      )}
    </Panel>
  );
}
