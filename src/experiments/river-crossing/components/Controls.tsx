import ScrambleText from "../../../components/ScrambleText";
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
  const banner =
    status === "won"
      ? `✓ all across, safe — ${moveCount} crossings`
      : status === "lost"
        ? "✖ missionaries outnumbered — someone got eaten"
        : seats === 0
          ? "tap people to load the boat"
          : `${seats}/${capacity} aboard — ready to cross`;

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
          ⛴ cross river
        </button>
        <button type="button" className="rc-btn" onClick={onUndo} disabled={!canUndo}>
          ↩ undo
        </button>
        <button type="button" className="rc-btn rc-btn--accent" onClick={onReset}>
          ↺ reset
        </button>
      </div>

      <div className="rc-speed">
        <span className="rc-speed-label">speed</span>
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
