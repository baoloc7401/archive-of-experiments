import { useTranslation } from "@/hooks/useTranslation";
import ScrambleText from "@/components/ScrambleText";
import { Tooltip } from "@/components/ui";
import type { GenStats } from "../types";

interface Props {
  stats: GenStats | null;
  /** Forge a field around the centre and open it, to study generation. */
  onInspect: () => void;
}

export default function GenStats({ stats, onInspect }: Props) {
  const { t } = useTranslation();
  const k = (key: string) => `experiments.minesweeper.gen.${key}`;

  return (
    <div className="ms-genstats">
      <Tooltip label={t(k("inspect_hint"))} block>
        <button className="ms-btn ms-inspect" onClick={onInspect}>
          <ScrambleText text={t(k("inspect"))} duration={500} />
        </button>
      </Tooltip>

      {!stats ? (
        <div className="ms-genstats-empty">
          <ScrambleText text={t(k("empty"))} duration={500} />
        </div>
      ) : (
        <>
          <div className={`ms-verdict ms-verdict--${stats.solved ? "ok" : "bad"}`}>
            <ScrambleText text={t(stats.solved ? k("verdict_ok") : k("verdict_bad"))} duration={500} />
          </div>

          <div className="ms-rating">
            <div className="ms-rating-head">
              <span className="ms-rating-label">
                <ScrambleText text={t(k("difficulty"))} duration={500} />
              </span>
              <span className="ms-rating-tier">
                <ScrambleText text={t(k(`tiers.${stats.tier}`))} duration={500} />
              </span>
            </div>
            <div className="ms-rating-track">
              <div className="ms-rating-fill" style={{ width: `${stats.rating}%` }} />
            </div>
          </div>

          <Tooltip label={t(k(`tech_hint.${stats.hardest}`))} block>
            <div className="ms-hardest">
              <ScrambleText text={t(k("hardest"))} duration={500} /> <strong>{t(k(`tech.${stats.hardest}`))}</strong>
            </div>
          </Tooltip>

          <div className="ms-stat-grid">
            <Stat label={t(k("stats.count"))} value={stats.techniques.count} hint={t(k("stat_hint.count"))} />
            <Stat label={t(k("stats.subset"))} value={stats.techniques.subset} hint={t(k("stat_hint.subset"))} />
            <Stat label={t(k("stats.enumerate"))} value={stats.techniques.enumerate} hint={t(k("stat_hint.enumerate"))} />
            <Stat label={t(k("stats.threebv"))} value={stats.threeBV} hint={t(k("stat_hint.threebv"))} />
            <Stat label={t(k("stats.density"))} value={`${(stats.density * 100).toFixed(1)}%`} hint={t(k("stat_hint.density"))} />
            <Stat label={t(k("stats.attempts"))} value={stats.attempts} hint={t(k("stat_hint.attempts"))} />
            <Stat label={t(k("stats.swaps"))} value={stats.swaps} hint={t(k("stat_hint.swaps"))} />
            <Stat label={t(k("stats.time"))} value={`${stats.ms}ms`} hint={t(k("stat_hint.time"))} />
            <Stat label={t(k("stats.seed"))} value={stats.seed} hint={t(k("stat_hint.seed"))} />
          </div>

          {!stats.solved && (
            <div className="ms-guesspts">{t(k("guess_points"), { count: stats.undecided.length })}</div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <Tooltip label={hint} block>
      <div className="ms-stat">
        <span className="ms-stat-label">{label}</span>
        <span className="ms-stat-val">{value}</span>
      </div>
    </Tooltip>
  );
}
