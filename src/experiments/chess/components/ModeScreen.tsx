import { useTranslation } from 'react-i18next';
import type { GameMode } from '../types';
import LangToggle from '../../../components/LangToggle';
import ThemeToggle from '../../../components/ThemeToggle';
import { useTheme } from '../../../hooks/useTheme';

interface Props {
  onSelect: (mode: GameMode) => void;
}

export function ModeScreen({ onSelect }: Props) {
  const { t } = useTranslation();
  const { theme, toggle } = useTheme();
  return (
    <div className="chess-page">
      <div className="chess-back-row">
        <a href="/" className="chess-back">{t('chess.back')}</a>
        <div className="chess-back-row-controls">
          <LangToggle />
          <ThemeToggle theme={theme} onToggle={toggle} />
        </div>
      </div>
      <div className="chess-mode-screen">
        <div className="chess-mode-title">
          <span className="chess-title-text">chess</span>
          <span className="chess-title-badge">{t('chess.badge')}</span>
        </div>
        <p className="chess-mode-desc">
          {t('chess.desc1')}<br />{t('chess.desc2')}
        </p>
        <div className="chess-mode-buttons">
          {(['hva', 'hvh', 'ava'] as GameMode[]).map(m => (
            <button key={m} className="chess-mode-btn" onClick={() => onSelect(m)}>
              {t(`chess.modes.${m}`)}
            </button>
          ))}
          <button className="chess-mode-btn chess-mode-btn--planned" disabled>
            {t('chess.puzzle_mode')} <span className="chess-planned-tag">{t('chess.planned_tag')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
