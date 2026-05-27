import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameMode, SkillLevel } from '../types';
import { DEFAULT_SKILL, SKILL_LEVELS, SKILL_PIECES } from '../ai/skill';
import LangToggle from '../../../components/LangToggle';
import ThemeToggle from '../../../components/ThemeToggle';
import { useTheme } from '../../../hooks/useTheme';

interface Props {
  onStart: (mode: GameMode, whiteSkill: SkillLevel, blackSkill: SkillLevel) => void;
}

export function ModeScreen({ onStart }: Props) {
  const { t } = useTranslation();
  const { theme, toggle } = useTheme();
  const [pickedMode, setPickedMode] = useState<GameMode | null>(null);
  const [whiteSkill, setWhiteSkill] = useState<SkillLevel>(DEFAULT_SKILL);
  const [blackSkill, setBlackSkill] = useState<SkillLevel>(DEFAULT_SKILL);

  function handleModeClick(m: GameMode) {
    if (m === 'hvh') {
      onStart(m, DEFAULT_SKILL, DEFAULT_SKILL);
      return;
    }
    setPickedMode(m);
  }

  function handleStart() {
    if (!pickedMode) return;
    // For HVA the human plays white, AI plays black — only the black side's
    // skill is consulted by useChessAI, but we still pass both for symmetry.
    onStart(pickedMode, whiteSkill, blackSkill);
  }

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

        {!pickedMode && (
          <div className="chess-mode-buttons">
            {(['hva', 'hvh', 'ava'] as GameMode[]).map(m => (
              <button key={m} className="chess-mode-btn" onClick={() => handleModeClick(m)}>
                {t(`chess.modes.${m}`)}
              </button>
            ))}
            <button className="chess-mode-btn chess-mode-btn--planned" disabled>
              {t('chess.puzzle_mode')} <span className="chess-planned-tag">{t('chess.planned_tag')}</span>
            </button>
          </div>
        )}

        {pickedMode && (
          <div className="chess-skill-picker">
            <div className="chess-skill-picker-mode">
              {t(`chess.modes.${pickedMode}`)}
            </div>

            {pickedMode === 'hva' && (
              <SkillRow
                label={t('chess.skill.title')}
                value={blackSkill}
                onChange={setBlackSkill}
              />
            )}

            {pickedMode === 'ava' && (
              <>
                <SkillRow
                  label={t('chess.skill.white')}
                  value={whiteSkill}
                  onChange={setWhiteSkill}
                />
                <SkillRow
                  label={t('chess.skill.black')}
                  value={blackSkill}
                  onChange={setBlackSkill}
                />
              </>
            )}

            <div className="chess-skill-actions">
              <button className="chess-mode-btn chess-mode-btn--primary" onClick={handleStart}>
                {t('chess.skill.start')}
              </button>
              <button
                className="chess-mode-btn chess-mode-btn--dim"
                onClick={() => setPickedMode(null)}
              >
                {t('chess.skill.back')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface SkillRowProps {
  label: string;
  value: SkillLevel;
  onChange: (s: SkillLevel) => void;
}

function SkillRow({ label, value, onChange }: SkillRowProps) {
  const { t } = useTranslation();
  const selectedIdx = SKILL_LEVELS.indexOf(value);
  // Position the sliding indicator under the selected piece. Each piece cell
  // is 1fr in a 5-column grid, so the indicator's left edge is at idx/5 of
  // the row width and its width is 1/5.
  const indicatorStyle: React.CSSProperties = {
    left:  `calc(${selectedIdx} * (100% / 5))`,
    width: `calc(100% / 5)`,
  };
  return (
    <div className="chess-skill-row">
      <div className="chess-skill-row-header">
        <span className="chess-skill-row-label">{label}</span>
        <span className="chess-skill-row-value">{t(`chess.skill.${value}`)}</span>
      </div>
      <div className="chess-skill-pieces" role="radiogroup" aria-label={label}>
        <span className="chess-skill-pieces-indicator" style={indicatorStyle} aria-hidden="true" />
        {SKILL_LEVELS.map(s => {
          const active = s === value;
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={t(`chess.skill.${s}`)}
              className={`chess-skill-piece${active ? ' chess-skill-piece--active' : ''}`}
              onClick={() => onChange(s)}
            >
              {SKILL_PIECES[s]}
            </button>
          );
        })}
      </div>
      <p className="chess-skill-row-desc">{t(`chess.skill.desc.${value}`)}</p>
    </div>
  );
}
