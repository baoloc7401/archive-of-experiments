import { useTranslation } from "@/hooks/useTranslation";
import { Panel, Stat, StatGrid } from "@/components/ui";
import type { LSnapshot } from "../types";

interface Props {
  snap: LSnapshot | null;
}

export default function Stats({ snap }: Props) {
  const { t } = useTranslation();
  return (
    <Panel title={t("experiments.l-system.telemetry")} collapsible={false}>
      <StatGrid columns={2}>
        <Stat
          label={t("experiments.l-system.stat_symbols")}
          value={snap ? snap.symbolCount.toLocaleString() : "-"}
          highlight
        />
        <Stat
          label={t("experiments.l-system.stat_segments")}
          value={snap ? snap.segments.toLocaleString() : "-"}
        />
        <Stat label={t("experiments.l-system.stat_depth")} value={snap ? snap.maxDepth : "-"} />
        <Stat label={t("experiments.l-system.stat_fps")} value={snap ? Math.round(snap.fps) : "-"} />
      </StatGrid>
    </Panel>
  );
}
