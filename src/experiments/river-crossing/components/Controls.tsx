import { useTranslation } from "@/hooks/useTranslation";
import ScrambleText from "@/components/ScrambleText";
import type { Status } from "../types";
import { SPEED_PRESETS } from "../constants";

interface Props {
  status: Status;
  seats: number;
  capacity: number;
  canCross: boolean;
  canUndo: boolean;
  moveCount: number;
  speedIndex: number;
  onCross: () => void;
  onUndo: () => void;
  onReset: () => void;
  onSpeed: (i: number) => void;
}

export default function Controls({
  status,
  seats,
  capacity,
  canCross,
  canUndo,
  moveCount,
  speedIndex,
  onCross,
  onUndo,
  onReset,
  onSpeed,
}: Props) {
  const { t } = useTranslation();
  const banner =
    status === "won"
      ? t("experiments.river-crossing.controls.won", { n: moveCount })
      : status === "lost"
        ? t("experiments.river-crossing.controls.lost")
        : seats === 0
          ? t("experiments.river-crossing.controls.load_prompt")
          : t("experiments.river-crossing.controls.ready", { n: seats, k: capacity });

  return (
    <section className="rc-controls">
      <div className={`rc-banner rc-banner--${status}`} role="status">
        <ScrambleText text={banner} duration={500} />
      </div>

      <div className="rc-ctrl-row">
        <button
          type="button"
          className="rc-btn rc-btn--primary"
          onClick={onCross}
          disabled={!canCross}
        >
          <ScrambleText text={t("experiments.river-crossing.controls.cross")} duration={450} />
        </button>
        <button type="button" className="rc-btn" onClick={onUndo} disabled={!canUndo}>
          <ScrambleText text={t("experiments.river-crossing.controls.undo")} duration={450} />
        </button>
        <button type="button" className="rc-btn rc-btn--accent" onClick={onReset}>
          <ScrambleText text={t("experiments.river-crossing.controls.reset")} duration={450} />
        </button>
      </div>

      <div className="rc-speed">
        <span className="rc-speed-label">{t("experiments.river-crossing.controls.speed")}</span>
        <div className="rc-speed-row">
          {SPEED_PRESETS.map((s, i) => (
            <button
              key={s.label}
              type="button"
              className={`rc-speed-btn${i === speedIndex ? " rc-speed-btn--on" : ""}`}
              onClick={() => onSpeed(i)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
