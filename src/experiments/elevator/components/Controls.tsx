import { useTranslation } from '@/hooks/useTranslation';
import ScrambleText from '@/components/ScrambleText';
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
  const { t } = useTranslation();
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
          <ScrambleText
            text={isRunning ? t('experiments.elevator.pause') : t('experiments.elevator.play')}
            duration={600}
          />
        </button>
        <button type="button" className="elev-btn" onClick={onReset}>
          <ScrambleText text={t('experiments.elevator.reset')} duration={600} />
        </button>
      </div>

      <div className="elev-ctrl-row">
        <button type="button" className="elev-btn elev-btn--accent" onClick={onRandom}>
          <ScrambleText text={t('experiments.elevator.random')} duration={600} />
        </button>
        <button type="button" className="elev-btn" onClick={onClear}>
          <ScrambleText text={t('experiments.elevator.clear')} duration={600} />
        </button>
      </div>

      <div className="elev-speed">
        <span className="elev-speed-label">
          <ScrambleText text={t('experiments.elevator.speed')} duration={600} />
        </span>
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
