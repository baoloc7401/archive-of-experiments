import { useTranslation } from 'react-i18next';
import type { Color, GameStatus } from '../types';

interface Props {
  status: GameStatus;
  turn: Color;
  thinking: boolean;
  isGameOver: boolean;
  drawLine: string;
}

export function PlayerStatus({ status, turn, thinking, isGameOver, drawLine }: Props) {
  const { t } = useTranslation();
  return (
    <div className="chess-players">
      {(['b', 'w'] as const).map(color => {
        const isActive = !isGameOver && turn === color;
        const won     = isGameOver && status === 'checkmate' && turn !== color;
        const lost    = isGameOver && status === 'checkmate' && turn === color;
        const checked = !isGameOver && status === 'check' && turn === color;
        return (
          <div key={color} className={`chess-player${isActive ? ' chess-player--active' : ''}`}>
            <div className={`chess-player-swatch chess-player-swatch--${color}`} />
            <span className="chess-player-name">{color === 'w' ? t('chess.white') : t('chess.black')}</span>
            {isActive && thinking && (
              <span className="chess-thinking-dots">
                <span /><span /><span />
              </span>
            )}
            {checked && <span className="chess-badge chess-badge--check">{t('chess.check_badge')}</span>}
            {won   && <span className="chess-badge chess-badge--win">{t('chess.win_badge')}</span>}
            {lost  && <span className="chess-badge chess-badge--lose">{t('chess.loss_badge')}</span>}
          </div>
        );
      })}
      {isGameOver && status !== 'checkmate' && (
        <div className="chess-draw-line">{drawLine}</div>
      )}
    </div>
  );
}
