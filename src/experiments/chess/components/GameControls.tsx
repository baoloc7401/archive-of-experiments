import { useTranslation } from 'react-i18next';
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
            {paused ? t('chess.resume') : t('chess.pause')}
          </button>
          {paused && (
            <button
              className="chess-btn chess-btn--step"
              onClick={onStep}
              disabled={thinking}
            >
              {t('chess.step')}
            </button>
          )}
        </div>
      )}
      <div className="chess-controls">
        <button className="chess-btn" onClick={onReset}>{t('chess.reset')}</button>
        <button className="chess-btn chess-btn--dim" onClick={onModeBack}>
          {t('chess.mode_back')}
        </button>
      </div>
    </>
  );
}
