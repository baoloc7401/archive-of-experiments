import { useTranslation } from '@/hooks/useTranslation';
import ScrambleText from '@/components/ScrambleText';
import type { GameMode } from '../types';

interface Props {
  mode: GameMode;
  isGameOver: boolean;
  paused: boolean;
  thinking: boolean;
  onReset: () => void;
  onModeBack: () => void;
  onPauseToggle: () => void;
  onStep: () => void;
}

export function GameControls({ mode, isGameOver, paused, thinking, onReset, onModeBack, onPauseToggle, onStep }: Props) {
  const { t } = useTranslation();
  return (
    <>
      {mode === 'ava' && !isGameOver && (
        <div className="chess-ava-controls">
          <button
            className={`chess-btn chess-btn--ava ${paused ? 'chess-btn--play' : 'chess-btn--pause'}`}
            onClick={onPauseToggle}
          >
            <ScrambleText text={paused ? t('chess.resume') : t('chess.pause')} duration={600} />
          </button>
          {paused && (
            <button
              className="chess-btn chess-btn--step"
              onClick={onStep}
              disabled={thinking}
            >
              <ScrambleText text={t('chess.step')} duration={600} />
            </button>
          )}
        </div>
      )}
      <div className="chess-controls">
        <button className="chess-btn" onClick={onReset}><ScrambleText text={t('chess.reset')} duration={600} /></button>
        <button className="chess-btn chess-btn--dim" onClick={onModeBack}>
          <ScrambleText text={t('chess.mode_back')} duration={600} />
        </button>
      </div>
    </>
  );
}
