import type { SimStatus } from '../types';
import { SPEED_PRESETS } from '../constants';

interface Props {
  status: SimStatus;
  speedIndex: number;
  playDisabled: boolean;
  onSpeedChange: (i: number) => void;
  onPlayPause: () => void;
  onReset: () => void;
  onRandom: () => void;
  onClear: () => void;
}

export default function Controls({
  status, speedIndex, playDisabled, onSpeedChange, onPlayPause, onReset, onRandom, onClear,
}: Props) {
  const isRunning = status === 'running';

  return (
    <div className="elev-controls">
      <div className="elev-ctrl-row">
        <button
          type="button"
          className={`elev-btn elev-btn--primary${isRunning ? ' elev-btn--pause' : ''}`}
          onClick={onPlayPause}
          disabled={playDisabled}
        >
          {isRunning ? '⏸ pause' : '▶ play'}
        </button>
        <button type="button" className="elev-btn" onClick={onReset}>↺ reset</button>
      </div>

      <div className="elev-ctrl-row">
        <button type="button" className="elev-btn elev-btn--accent" onClick={onRandom}>
          ✦ random
        </button>
        <button type="button" className="elev-btn" onClick={onClear}>
          ⌫ clear
        </button>
      </div>

      <div className="elev-speed">
        <span className="elev-speed-label">speed</span>
        <div className="elev-speed-row">
          {SPEED_PRESETS.map((s, i) => (
            <button
              key={s.label}
              type="button"
              className={`elev-speed-btn${i === speedIndex ? ' elev-speed-btn--on' : ''}`}
              onClick={() => onSpeedChange(i)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
