import { useEffect, useMemo, useRef, useState } from 'react';
import type { Color, GameMode, GameStatus, Move, Piece, PieceType, Position } from './types';
import { applyMove, findKing, getLegalMoves, getGameStatus, initialPosition, positionKey } from './engine';
import { evaluate as evaluatePosition, getBestMove } from './ai';
import ThemeToggle from '../../components/ThemeToggle';
import { useTheme } from '../../hooks/useTheme';
import './Chess.css';

const SYMBOLS: Record<string, string> = {
  wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
  bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟',
};

const FILES = ['a','b','c','d','e','f','g','h'];
const RANKS = ['8','7','6','5','4','3','2','1'];

function sqName(r: number, c: number): string {
  return FILES[c] + RANKS[r];
}

function moveLabel(m: Move): string {
  const base = sqName(m.from[0], m.from[1]) + sqName(m.to[0], m.to[1]);
  return m.flag === 'promotion' ? base + m.promotion!.toLowerCase() : base;
}

const MODE_LABELS: Record<GameMode, string> = {
  hvh: 'Human vs Human',
  hva: 'Human vs AI',
  ava: 'AI vs AI',
};

const AI_DEPTH: Record<GameMode, number> = { hvh: 0, hva: 4, ava: 3 };
const AI_DELAY: Record<GameMode, number> = { hvh: 0, hva: 150, ava: 450 };

// Captured-piece display helpers (outside component — no state dependency)
const PIECE_SORT: Record<string, number> = { Q: 0, R: 1, B: 2, N: 3, P: 4, K: 5 };
const PIECE_VAL:  Record<string, number> = { Q: 9, R: 5, B: 3, N: 3, P: 1, K: 0 };

function computeGrade(posBefore: Position, chosenMove: Move): number {
  const best = getBestMove(posBefore, 2);
  if (!best) return 8;
  const isWhite  = posBefore.turn === 'w';
  const evalBest = evaluatePosition(applyMove(posBefore, best));
  const evalChosen = evaluatePosition(applyMove(posBefore, chosenMove));
  const cpLoss = isWhite ? evalBest - evalChosen : evalChosen - evalBest;
  if (cpLoss <= 0)   return 10;
  if (cpLoss <= 25)  return 9;
  if (cpLoss <= 75)  return 8;
  if (cpLoss <= 150) return 7;
  if (cpLoss <= 300) return 6;
  if (cpLoss <= 500) return 4;
  return 2;
}

function gradeInfo(grade: number | undefined): { sym: string; cls: string } | null {
  if (grade === undefined || grade === 8) return null;
  if (grade >= 10) return { sym: '!!', cls: 'grade-brilliant' };
  if (grade >= 9)  return { sym: '!',  cls: 'grade-good' };
  if (grade >= 7)  return { sym: '!?', cls: 'grade-interesting' };
  if (grade >= 6)  return { sym: '?!', cls: 'grade-inaccuracy' };
  if (grade >= 4)  return { sym: '?',  cls: 'grade-mistake' };
  return             { sym: '??', cls: 'grade-blunder' };
}

function MoveCell({ label, grade }: { label: string; grade?: number }) {
  const info = gradeInfo(grade);
  return (
    <span className="chess-move-cell">
      {label}
      {info && <span className={`chess-grade ${info.cls}`}>{info.sym}</span>}
    </span>
  );
}

interface SlideInfo {
  toRow: number; toCol: number;
  dx: number; dy: number;
  key: number;
}

interface FlyingPiece {
  id: number; symbol: string;
  x: number; y: number;
  flyDy: number; size: number;
}

export default function ChessGame() {
  const { theme, toggle } = useTheme();
  const [mode, setMode] = useState<GameMode | null>(null);
  const [pos, setPos] = useState<Position>(initialPosition());
  const [legalMoves, setLegalMoves] = useState<Move[]>([]);
  const [status, setStatus] = useState<GameStatus>('playing');
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [lastMove, setLastMove] = useState<Move | null>(null);
  const [thinking, setThinking] = useState(false);
  const [history, setHistory] = useState<Move[]>([]);
  const [promotionPending, setPromotionPending] = useState<{ from: [number, number]; to: [number, number] } | null>(null);
  const [drawReason, setDrawReason] = useState<'repetition' | '50-move' | null>(null);
  const [paused, setPaused] = useState(false);
  const [moveGrades, setMoveGrades] = useState<(number | undefined)[]>([]);
  const [slideInfo, setSlideInfo] = useState<SlideInfo | null>(null);
  const [castleRookSlide, setCastleRookSlide] = useState<SlideInfo | null>(null);
  const [flyingPieces, setFlyingPieces] = useState<FlyingPiece[]>([]);
  const historyRef = useRef<HTMLDivElement>(null);
  const posHistoryRef = useRef<Map<string, number>>(new Map());
  const posBeforeRef = useRef<Position[]>([]);
  const boardGridRef = useRef<HTMLDivElement>(null);
  const boardColRef = useRef<HTMLDivElement>(null);
  const flyIdRef = useRef(0);

  // Recompute legal moves, status, and position history when position changes.
  // We replay from history (ground truth) rather than incrementally counting,
  // which avoids double-counting in React StrictMode and is always correct.
  useEffect(() => {
    const moves = getLegalMoves(pos);
    setLegalMoves(moves);

    const posMap = new Map<string, number>();
    const posArr: Position[] = [];
    let p = initialPosition();
    for (const move of history) {
      posArr.push(p);
      p = applyMove(p, move);
      const k = positionKey(p);
      posMap.set(k, (posMap.get(k) ?? 0) + 1);
    }
    posHistoryRef.current = posMap;
    posBeforeRef.current = posArr;

    const count = posMap.get(positionKey(pos)) ?? 0;
    if (count >= 3) {
      setStatus('draw');
      setDrawReason('repetition');
    } else {
      const s = getGameStatus(pos, moves);
      setStatus(s);
      setDrawReason(s === 'draw' ? '50-move' : null);
    }

    // Grade the latest move asynchronously so it doesn't block the render.
    const lastIdx = history.length - 1;
    if (lastIdx >= 0) {
      const posBefore = posArr[lastIdx];
      const move = history[lastIdx];
      const idx = lastIdx;
      setTimeout(() => {
        const grade = computeGrade(posBefore, move);
        setMoveGrades(prev => {
          if (prev[idx] !== undefined) return prev;
          const next = [...prev];
          next[idx] = grade;
          return next;
        });
      }, 0);
    }
  }, [pos, history]);

  // Auto-scroll history
  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [history]);

  // AI move trigger
  useEffect(() => {
    if (!mode || promotionPending || paused) return;
    if (status !== 'playing' && status !== 'check') return;

    const isAITurn = mode === 'ava' || (mode === 'hva' && pos.turn === 'b');
    if (!isAITurn) return;

    setThinking(true);
    const currentPos = pos;
    const depth = AI_DEPTH[mode];

    const currentHistory = new Map(posHistoryRef.current);
    const timer = setTimeout(() => {
      const move = getBestMove(currentPos, depth, currentHistory);
      if (move) applyGameMove(currentPos, move);
      setThinking(false);
    }, AI_DELAY[mode]);

    return () => {
      clearTimeout(timer);
      setThinking(false);
    };
  }, [pos, mode, status, promotionPending, paused]);

  function handleSquareClick(r: number, c: number) {
    if (!mode || thinking || promotionPending) return;
    if (status !== 'playing' && status !== 'check') return;

    const isHumanTurn = mode === 'hvh' || (mode === 'hva' && pos.turn === 'w');
    if (!isHumanTurn) return;

    const piece = pos.board[r][c];

    if (selected) {
      const [sr, sc] = selected;
      const candidates = legalMoves.filter(
        m => m.from[0] === sr && m.from[1] === sc && m.to[0] === r && m.to[1] === c,
      );

      if (candidates.length > 0) {
        if (candidates[0].flag === 'promotion') {
          setPromotionPending({ from: [sr, sc], to: [r, c] });
          setSelected(null);
          return;
        }
        applyGameMove(pos, candidates[0]);
        setSelected(null);
        return;
      }

      if (piece?.color === pos.turn) {
        setSelected([r, c]);
      } else {
        setSelected(null);
      }
    } else {
      if (piece?.color === pos.turn) setSelected([r, c]);
    }
  }

  function handlePromotion(type: PieceType) {
    if (!promotionPending) return;
    const { from, to } = promotionPending;
    const move = legalMoves.find(
      m => m.from[0] === from[0] && m.from[1] === from[1]
        && m.to[0] === to[0] && m.to[1] === to[1]
        && m.flag === 'promotion' && m.promotion === type,
    );
    if (move) applyGameMove(pos, move);
    setPromotionPending(null);
  }

  function stepAI() {
    if (thinking || !mode) return;
    if (status !== 'playing' && status !== 'check') return;
    setThinking(true);
    const currentPos = pos;
    const currentHistory = new Map(posHistoryRef.current);
    setTimeout(() => {
      const move = getBestMove(currentPos, AI_DEPTH[mode], currentHistory);
      if (move) applyGameMove(currentPos, move);
      setThinking(false);
    }, 50);
  }

  function applyGameMove(currentPos: Position, move: Move) {
    const [fr, fc] = move.from;
    const [tr, tc] = move.to;

    if (boardGridRef.current) {
      const boardRect = boardGridRef.current.getBoundingClientRect();
      const sqSize = boardRect.width / 8;

      setSlideInfo({ toRow: tr, toCol: tc, dx: (fc - tc) * sqSize, dy: (fr - tr) * sqSize, key: Date.now() });

      if (move.flag === 'castle-k' || move.flag === 'castle-q') {
        const rank = currentPos.turn === 'w' ? 7 : 0;
        const [rfc, rtc] = move.flag === 'castle-k' ? [7, 5] : [0, 3];
        setCastleRookSlide({ toRow: rank, toCol: rtc, dx: (rfc - rtc) * sqSize, dy: 0, key: Date.now() + 1 });
      } else {
        setCastleRookSlide(null);
      }

      if ((move.captured || move.flag === 'en-passant') && boardColRef.current) {
        const capRow = move.flag === 'en-passant' ? (currentPos.turn === 'w' ? tr + 1 : tr - 1) : tr;
        const captured = move.captured ?? { type: 'P' as PieceType, color: (currentPos.turn === 'w' ? 'b' : 'w') as Color };
        const colRect = boardColRef.current.getBoundingClientRect();
        const x = boardRect.left - colRect.left + tc * sqSize;
        const y = boardRect.top - colRect.top + capRow * sqSize;
        const flyDy = boardRect.height - capRow * sqSize + sqSize * 1.5;
        const id = ++flyIdRef.current;
        setFlyingPieces(prev => [...prev, { id, symbol: SYMBOLS[captured.color + captured.type], x, y, flyDy, size: sqSize }]);
        setTimeout(() => setFlyingPieces(prev => prev.filter(fp => fp.id !== id)), 500);
      }
    } else {
      setSlideInfo(null);
      setCastleRookSlide(null);
    }

    setPos(applyMove(currentPos, move));
    setLastMove(move);
    setHistory(h => [...h, move]);
  }

  function resetGame() {
    posHistoryRef.current = new Map();
    posBeforeRef.current = [];
    setPos(initialPosition());
    setSelected(null);
    setLastMove(null);
    setHistory([]);
    setMoveGrades([]);
    setThinking(false);
    setPromotionPending(null);
    setPaused(false);
    setDrawReason(null);
    setSlideInfo(null);
    setCastleRookSlide(null);
    setFlyingPieces([]);
  }

  const [whiteCaptured, blackCaptured, materialAdv] = useMemo(() => {
    const byW: Piece[] = [], byB: Piece[] = [];
    for (let i = 0; i < history.length; i++) {
      const m = history[i];
      const list = i % 2 === 0 ? byW : byB;
      if (m.captured) list.push(m.captured);
      if (m.flag === 'en-passant')
        list.push({ type: 'P', color: (i % 2 === 0 ? 'b' : 'w') as Color });
    }
    const sort = (a: Piece[]) => [...a].sort((x, y) => PIECE_SORT[x.type] - PIECE_SORT[y.type]);
    const val  = (a: Piece[]) => a.reduce((s, p) => s + PIECE_VAL[p.type], 0);
    return [sort(byW), sort(byB), val(byW) - val(byB)];
  }, [history]);

  const [copied, setCopied] = useState(false);
  function copyHistory() {
    const text = rounds
      .map(([w, b], i) => `${i + 1}. ${moveLabel(w)}${b ? ` ${moveLabel(b)}` : ''}`)
      .join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const moveTos = new Set(
    selected
      ? legalMoves
          .filter(m => m.from[0] === selected[0] && m.from[1] === selected[1])
          .map(m => `${m.to[0]},${m.to[1]}`)
      : [],
  );

  const checkKingSq = (status === 'check' || status === 'checkmate')
    ? findKing(pos.board, pos.turn)
    : null;

  const isGameOver = status === 'checkmate' || status === 'stalemate' || status === 'draw';

  const statusLine = {
    playing:   '',
    check:     'check!',
    checkmate: pos.turn === 'w' ? 'black wins' : 'white wins',
    stalemate: 'stalemate',
    draw:      drawReason === 'repetition' ? 'draw by repetition' : '50-move draw',
  }[status];

  // Group moves into rounds
  const rounds: [Move, Move | null][] = [];
  for (let i = 0; i < history.length; i += 2) {
    rounds.push([history[i], history[i + 1] ?? null]);
  }

  // ── Mode selection ──────────────────────────────────────────
  if (!mode) {
    return (
      <div className="chess-page">
        <div className="chess-back-row">
          <a href="/" className="chess-back">← experiments</a>
          <ThemeToggle theme={theme} onToggle={toggle} />
        </div>
        <div className="chess-mode-screen">
          <div className="chess-mode-title">
            <span className="chess-title-text">chess</span>
            <span className="chess-title-badge">experiment 01</span>
          </div>
          <p className="chess-mode-desc">
            Minimax AI with alpha-beta pruning and piece-square tables.
            Pick a mode to start.
          </p>
          <div className="chess-mode-buttons">
            {(['hva', 'hvh', 'ava'] as GameMode[]).map(m => (
              <button key={m} className="chess-mode-btn" onClick={() => setMode(m)}>
                {MODE_LABELS[m]}
              </button>
            ))}
            <button className="chess-mode-btn chess-mode-btn--planned" disabled>
              Puzzle Mode <span className="chess-planned-tag">planned</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Game view ───────────────────────────────────────────────
  return (
    <div className="chess-page">
      <div className="chess-topbar">
        <a href="/" className="chess-back">← experiments</a>
        <div className="chess-topbar-title">chess</div>
        <div className="chess-topbar-mode">{MODE_LABELS[mode]}</div>
        <ThemeToggle theme={theme} onToggle={toggle} />
      </div>

      <div className="chess-layout">
        {/* ── Board column ── */}
        <div className="chess-board-col" ref={boardColRef}>
        <div className="chess-board-area">
          <div className="chess-board-wrap">
            <div className="chess-ranks">
              {RANKS.map(r => (
                <div key={r} className="chess-label">{r}</div>
              ))}
            </div>

            <div className="chess-board-inner">
              <div className="chess-board" ref={boardGridRef}>
                {Array.from({ length: 64 }, (_, i) => {
                  const r = Math.floor(i / 8);
                  const c = i % 8;
                  const key = `${r},${c}`;
                  const piece = pos.board[r][c];
                  const isLight = (r + c) % 2 === 0;
                  const isSelected = selected?.[0] === r && selected?.[1] === c;
                  const isMoveTo = moveTos.has(key);
                  const isCheck = checkKingSq?.[0] === r && checkKingSq?.[1] === c;
                  const isLastFrom = lastMove?.from[0] === r && lastMove?.from[1] === c;
                  const isLastTo   = lastMove?.to[0] === r   && lastMove?.to[1] === c;
                  const isCapture = isMoveTo && !!piece;

                  const isSliding = slideInfo?.toRow === r && slideInfo?.toCol === c;
                  const isRookSliding = castleRookSlide?.toRow === r && castleRookSlide?.toCol === c;
                  const slide = isSliding ? slideInfo : isRookSliding ? castleRookSlide : null;

                  let cls = `chess-square ${isLight ? 'sq-light' : 'sq-dark'}`;
                  if (isSelected)      cls += ' sq-selected';
                  else if (isLastFrom) cls += ' sq-last-from';
                  else if (isLastTo)   cls += ' sq-last-to';
                  if (isCheck)         cls += ' sq-check';

                  const pieceKey = isLastTo    ? `pl${history.length}`
                                 : isRookSliding ? `pr${history.length}`
                                 : `p${r}${c}`;

                  return (
                    <div
                      key={key}
                      className={cls}
                      onClick={() => handleSquareClick(r, c)}
                      role="button"
                      tabIndex={0}
                      aria-label={sqName(r, c)}
                      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && handleSquareClick(r, c)}
                    >
                      {isMoveTo && <div className={isCapture ? 'move-ring' : 'move-dot'} />}
                      {piece && (
                        <div
                          key={pieceKey}
                          className={`chess-piece chess-piece--${piece.color}${slide ? ' piece-sliding' : ''}`}
                          style={slide ? { '--slide-dx': `${slide.dx}px`, '--slide-dy': `${slide.dy}px` } as React.CSSProperties : undefined}
                        >
                          {SYMBOLS[piece.color + piece.type]}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div />
            <div className="chess-files">
              {FILES.map(f => (
                <div key={f} className="chess-label">{f}</div>
              ))}
            </div>
          </div>

          {/* Promotion picker */}
          {promotionPending && (
            <div className="chess-promotion-overlay">
              <div className="chess-promotion-dialog">
                <p className="chess-promotion-label">Promote to:</p>
                <div className="chess-promotion-options">
                  {(['Q', 'R', 'B', 'N'] as PieceType[]).map(pt => (
                    <button
                      key={pt}
                      className="chess-promotion-btn"
                      onClick={() => handlePromotion(pt)}
                      aria-label={pt}
                    >
                      {SYMBOLS[pos.turn + pt]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Flying piece overlay */}
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

        {/* Captured pieces below board */}
        {(whiteCaptured.length > 0 || blackCaptured.length > 0) && (
          <div className="chess-captures">
            <div className="chess-capture-row">
              <div className="chess-turn-pip chess-turn-pip--w" />
              <span className="chess-capture-pieces">
                {whiteCaptured.map((p, i) => <span key={i}>{SYMBOLS['b' + p.type]}</span>)}
              </span>
              {materialAdv > 0 && <span className="chess-capture-adv">+{materialAdv}</span>}
            </div>
            <div className="chess-capture-row">
              <div className="chess-turn-pip chess-turn-pip--b" />
              <span className="chess-capture-pieces">
                {blackCaptured.map((p, i) => <span key={i}>{SYMBOLS['w' + p.type]}</span>)}
              </span>
              {materialAdv < 0 && <span className="chess-capture-adv">+{-materialAdv}</span>}
            </div>
          </div>
        )}
        </div>{/* end chess-board-col */}

        {/* ── Sidebar ── */}
        <aside className="chess-sidebar">
          <div className="chess-players">
            {(['b', 'w'] as const).map(color => {
              const isActive = !isGameOver && pos.turn === color;
              const won  = isGameOver && status === 'checkmate' && pos.turn !== color;
              const lost = isGameOver && status === 'checkmate' && pos.turn === color;
              const checked = !isGameOver && status === 'check' && pos.turn === color;
              return (
                <div key={color} className={`chess-player${isActive ? ' chess-player--active' : ''}`}>
                  <div className={`chess-player-swatch chess-player-swatch--${color}`} />
                  <span className="chess-player-name">{color === 'w' ? 'White' : 'Black'}</span>
                  {isActive && thinking && (
                    <span className="chess-thinking-dots">
                      <span /><span /><span />
                    </span>
                  )}
                  {checked && <span className="chess-badge chess-badge--check">check</span>}
                  {won  && <span className="chess-badge chess-badge--win">win</span>}
                  {lost && <span className="chess-badge chess-badge--lose">loss</span>}
                </div>
              );
            })}
            {isGameOver && status !== 'checkmate' && (
              <div className="chess-draw-line">{statusLine}</div>
            )}
          </div>

          {mode === 'ava' && !isGameOver && (
            <div className="chess-ava-controls">
              <button
                className={`chess-btn chess-btn--ava ${paused ? 'chess-btn--play' : 'chess-btn--pause'}`}
                onClick={() => setPaused(p => !p)}
              >
                {paused ? '▶ Resume' : '⏸ Pause'}
              </button>
              {paused && (
                <button
                  className="chess-btn chess-btn--step"
                  onClick={stepAI}
                  disabled={thinking}
                >
                  → Step
                </button>
              )}
            </div>
          )}

          <div className="chess-controls">
            <button className="chess-btn" onClick={resetGame}>↺ Reset</button>
            <button className="chess-btn chess-btn--dim" onClick={() => { resetGame(); setMode(null); }}>
              ← Mode
            </button>
          </div>

          <div className="chess-history">
            <div className="chess-history-header">
              Move history
              {rounds.length > 0 && (
                <button className="chess-copy-btn" onClick={copyHistory}>
                  {copied ? '✓ copied' : 'copy'}
                </button>
              )}
            </div>
            <div className="chess-history-list" ref={historyRef}>
              {rounds.length === 0
                ? <div className="chess-history-empty">No moves yet.</div>
                : rounds.map(([w, b], i) => (
                    <div key={i} className={`chess-move-row${i === rounds.length - 1 ? ' chess-move-row--last' : ''}`}>
                      <span className="chess-move-num">{i + 1}</span>
                      <MoveCell label={moveLabel(w)} grade={moveGrades[i * 2]} />
                      {b
                        ? <MoveCell label={moveLabel(b)} grade={moveGrades[i * 2 + 1]} />
                        : <span />
                      }
                    </div>
                  ))
              }
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
