import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameMode, SkillLevel } from './types';
import { DEFAULT_SKILL, SKILL_PRESETS } from './ai/skill';
import { useChessGame } from './hooks/useChessGame';
import { useChessAI } from './hooks/useChessAI';
import { Board } from './components/Board';
import { PromotionDialog } from './components/PromotionDialog';
import { PlayerStatus } from './components/PlayerStatus';
import { GameControls } from './components/GameControls';
import { MoveHistory } from './components/MoveHistory';
import { CapturedPieces } from './components/CapturedPieces';
import { ModeScreen } from './components/ModeScreen';
import ThemeToggle from '../../components/ThemeToggle';
import LangToggle from '../../components/LangToggle';
import { useTheme } from '../../hooks/useTheme';
import './Chess.css';
import './chess-board.css';
import './chess-sidebar.css';

export default function ChessGame() {
  const { theme, toggle } = useTheme();
  const { t } = useTranslation();
  const [mode, setMode] = useState<GameMode | null>(null);
  const [whiteSkill, setWhiteSkill] = useState<SkillLevel>(DEFAULT_SKILL);
  const [blackSkill, setBlackSkill] = useState<SkillLevel>(DEFAULT_SKILL);
  const [paused, setPaused] = useState(false);

  const game = useChessGame(mode);
  const { thinking, stepAI, clearAI } = useChessAI({
    mode,
    pos: game.pos,
    status: game.status,
    promotionPending: game.promotionPending,
    paused,
    posHistoryRef: game.posHistoryRef,
    applyGameMove: game.applyGameMove,
    whiteConfig: SKILL_PRESETS[whiteSkill],
    blackConfig: SKILL_PRESETS[blackSkill],
  });

  function handleStart(m: GameMode, w: SkillLevel, b: SkillLevel) {
    setWhiteSkill(w);
    setBlackSkill(b);
    setMode(m);
  }

  if (!mode) return <ModeScreen onStart={handleStart} />;

  function handleReset() {
    game.resetGame();
    clearAI();
    setPaused(false);
  }

  function handleSquareClick(r: number, c: number) {
    if (thinking) return;
    game.handleSquareClick(r, c);
  }

  const statusLine = {
    playing:   '',
    check:     t('chess.status.check'),
    checkmate: game.pos.turn === 'w' ? t('chess.status.black_wins') : t('chess.status.white_wins'),
    stalemate: t('chess.status.stalemate'),
    draw:      game.drawReason === 'repetition' ? t('chess.status.draw_repetition') : t('chess.status.draw_50move'),
  }[game.status];

  return (
    <div className="chess-page">
      <div className="chess-topbar">
        <a href={import.meta.env.BASE_URL} className="chess-back">{t('chess.back')}</a>
        <div className="chess-topbar-title">chess</div>
        <div className="chess-topbar-mode">{t(`chess.modes.${mode}`)}</div>
        <div className="chess-topbar-controls">
          <LangToggle />
          <ThemeToggle theme={theme} onToggle={toggle} />
        </div>
      </div>

      <div className="chess-layout">
        <div className="chess-board-col" ref={game.boardColRef}>
          <div className="chess-board-area">
            <Board
              pos={game.pos}
              selected={game.selected}
              lastMove={game.lastMove}
              moveTos={game.moveTos}
              checkKingSq={game.checkKingSq}
              slideInfo={game.slideInfo}
              castleRookSlide={game.castleRookSlide}
              historyLength={game.history.length}
              boardGridRef={game.boardGridRef}
              onSquareClick={handleSquareClick}
            />
            {game.promotionPending && (
              <PromotionDialog turn={game.pos.turn} onPromote={game.handlePromotion} />
            )}
          </div>

          <div className="chess-anim-overlay">
            {game.flyingPieces.map(fp => (
              <div
                key={fp.id}
                className="chess-flying-piece"
                style={{
                  left: fp.x,
                  top: fp.y,
                  '--fly-dy': `${fp.flyDy}px`,
                  '--fly-size': `${fp.size * 0.78}px`,
                } as React.CSSProperties}
              >
                {fp.symbol}
              </div>
            ))}
          </div>

          <CapturedPieces
            whiteCaptured={game.whiteCaptured}
            blackCaptured={game.blackCaptured}
            materialAdv={game.materialAdv}
          />
        </div>

        <aside className="chess-sidebar">
          <PlayerStatus
            status={game.status}
            turn={game.pos.turn}
            thinking={thinking}
            isGameOver={game.isGameOver}
            drawLine={statusLine}
          />
          <GameControls
            mode={mode}
            isGameOver={game.isGameOver}
            paused={paused}
            thinking={thinking}
            onReset={handleReset}
            onModeBack={() => { handleReset(); setMode(null); }}
            onPauseToggle={() => setPaused(p => !p)}
            onStep={stepAI}
          />
          <MoveHistory
            rounds={game.rounds}
            moveGrades={game.moveGrades}
            copied={game.copied}
            copyGrades={game.copyGrades}
            onToggleCopyGrades={game.setCopyGrades}
            historyRef={game.historyRef}
            onCopy={game.copyHistory}
          />
        </aside>
      </div>
    </div>
  );
}
