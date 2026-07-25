import { useTranslation } from "@/hooks/useTranslation";
import { Panel, Stat, StatGrid } from "@/components/ui";
import type { Theme } from "@/hooks/useTheme";
import type { BoidSnapshot } from "../types";
import OrderChart from "./OrderChart";

interface Props {
  snap: BoidSnapshot | null;
  history: number[];
  theme: Theme;
}

export default function Stats({ snap, history, theme }: Props) {
  const { t } = useTranslation();
  return (
    <Panel title={t("experiments.boids.telemetry")} collapsible={false}>
      <StatGrid columns={2}>
        <Stat label={t("experiments.boids.stat_count")} value={snap ? snap.count : "-"} />
        <Stat label={t("experiments.boids.stat_fps")} value={snap ? Math.round(snap.fps) : "-"} />
        <Stat
          label={t("experiments.boids.stat_speed")}
          value={snap ? snap.avgSpeed.toFixed(1) : "-"}
        />
        <Stat
          label={t("experiments.boids.stat_order")}
          value={snap ? snap.order.toFixed(2) : "-"}
          highlight
        />
      </StatGrid>
      <OrderChart history={history} theme={theme} />
    </Panel>
  );
}
