import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
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
import ExperimentHeader from '../../components/ExperimentHeader';
import './Chess.css';
import './chess-board.css';
import './chess-sidebar.css';

const GAME_MODES: GameMode[] = ['hvh', 'hva', 'ava'];
const isGameMode = (m: string | undefined): m is GameMode =>
  m !== undefined && (GAME_MODES as string[]).includes(m);

export default function ChessGame() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { mode: modeParam } = useParams();
  const mode: GameMode | null = isGameMode(modeParam) ? modeParam : null;
  const [whiteSkill, setWhiteSkill] = useState<SkillLevel>(DEFAULT_SKILL);
  const [blackSkill, setBlackSkill] = useState<SkillLevel>(DEFAULT_SKILL);
  const [paused, setPaused] = useState(false);

  const {
    pos, status, selected, lastMove, history,
    promotionPending, drawReason, moveGrades, slideInfo, castleRookSlide,
    flyingPieces, copied, copyGrades, setCopyGrades,
    historyRef, posHistoryRef, boardGridRef, boardColRef,
    moveTos, checkKingSq, isGameOver, rounds,
    whiteCaptured, blackCaptured, materialAdv,
    handleSquareClick: selectSquare, handlePromotion, resetGame, applyGameMove, copyHistory,
  } = useChessGame(mode);
  const { thinking, stepAI, clearAI } = useChessAI({
    mode,
    pos,
    status,
    promotionPending,
    paused,
    posHistoryRef,
    applyGameMove,
    whiteConfig: SKILL_PRESETS[whiteSkill],
    blackConfig: SKILL_PRESETS[blackSkill],
  });

  function handleStart(m: GameMode, w: SkillLevel, b: SkillLevel) {
    setWhiteSkill(w);
    setBlackSkill(b);
    navigate(`/experiments/chess/${m}`);
  }

  // An unrecognized mode in the URL falls back to the mode picker.
  if (modeParam !== undefined && !isGameMode(modeParam)) {
    return <Navigate to="/experiments/chess" replace />;
  }
  if (!mode) return <ModeScreen onStart={handleStart} />;

  function handleReset() {
    resetGame();
    clearAI();
    setPaused(false);
  }

  function handleSquareClick(r: number, c: number) {
    if (thinking) return;
    selectSquare(r, c);
  }

  const statusLine = {
    playing:   '',
    check:     t('chess.status.check'),
    checkmate: pos.turn === 'w' ? t('chess.status.black_wins') : t('chess.status.white_wins'),
    stalemate: t('chess.status.stalemate'),
    draw:      drawReason === 'repetition' ? t('chess.status.draw_repetition') : t('chess.status.draw_50move'),
  }[status];

  return (
    <div className="chess-page">
      <ExperimentHeader
        crumbs={[
          { label: t('experiments.chess.title').toLowerCase(), to: '/experiments/chess' },
          { label: t(`chess.modes.${mode}`).toLowerCase(), to: `/experiments/chess/${mode}` },
        ]}
      />

      <div className="chess-content">
        <div className="chess-layout">
        <div className="chess-board-col" ref={boardColRef}>
          <div className="chess-board-area">
            <Board
              pos={pos}
              selected={selected}
              lastMove={lastMove}
              moveTos={moveTos}
              checkKingSq={checkKingSq}
              slideInfo={slideInfo}
              castleRookSlide={castleRookSlide}
              historyLength={history.length}
              boardGridRef={boardGridRef}
              onSquareClick={handleSquareClick}
            />
            {promotionPending && (
              <PromotionDialog turn={pos.turn} onPromote={handlePromotion} />
            )}
          </div>

          <div className="chess-anim-overlay">
            {flyingPieces.map(fp => (
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
            whiteCaptured={whiteCaptured}
            blackCaptured={blackCaptured}
            materialAdv={materialAdv}
          />
        </div>

        <aside className="chess-sidebar">
          <PlayerStatus
            status={status}
            turn={pos.turn}
            thinking={thinking}
            isGameOver={isGameOver}
            drawLine={statusLine}
          />
          <GameControls
            mode={mode}
            isGameOver={isGameOver}
            paused={paused}
            thinking={thinking}
            onReset={handleReset}
            onModeBack={() => { handleReset(); navigate('/experiments/chess'); }}
            onPauseToggle={() => setPaused(p => !p)}
            onStep={stepAI}
          />
          <MoveHistory
            rounds={rounds}
            moveGrades={moveGrades}
            copied={copied}
            copyGrades={copyGrades}
            onToggleCopyGrades={setCopyGrades}
            historyRef={historyRef}
            onCopy={copyHistory}
          />
        </aside>
        </div>
      </div>
    </div>
  );
}
