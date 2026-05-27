import { useEffect, useMemo, useRef, useState } from 'react';
import type { Color, GameMode, GameStatus, Move, Piece, PieceType, Position } from '../types';
import { applyMove, findKing, getLegalMoves, getGameStatus, initialPosition, isInCheck, positionKey } from '../engine';
import { PIECE_SORT, PIECE_VAL, SYMBOLS } from '../constants';
import { computeGrade, gradeInfo, moveLabel } from '../utils';
import { clearTT } from '../ai';

export interface SlideInfo {
  toRow: number; toCol: number;
  dx: number; dy: number;
  key: number;
}

export interface FlyingPiece {
  id: number; symbol: string;
  x: number; y: number;
  flyDy: number; size: number;
}

export function useChessGame(mode: GameMode | null) {
  const [pos, setPos] = useState<Position>(initialPosition());
  const [legalMoves, setLegalMoves] = useState<Move[]>([]);
  const [status, setStatus] = useState<GameStatus>('playing');
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [lastMove, setLastMove] = useState<Move | null>(null);
  const [history, setHistory] = useState<Move[]>([]);
  const [promotionPending, setPromotionPending] = useState<{ from: [number, number]; to: [number, number] } | null>(null);
  const [drawReason, setDrawReason] = useState<'repetition' | '50-move' | null>(null);
  const [moveGrades, setMoveGrades] = useState<(number | undefined)[]>([]);
  const [slideInfo, setSlideInfo] = useState<SlideInfo | null>(null);
  const [castleRookSlide, setCastleRookSlide] = useState<SlideInfo | null>(null);
  const [flyingPieces, setFlyingPieces] = useState<FlyingPiece[]>([]);
  const [copied, setCopied] = useState(false);
  const [copyGrades, setCopyGrades] = useState(true);

  const historyRef = useRef<HTMLDivElement>(null);
  const posHistoryRef = useRef<Map<string, number>>(new Map());
  const posBeforeRef = useRef<Position[]>([]);
  const boardGridRef = useRef<HTMLDivElement>(null);
  const boardColRef = useRef<HTMLDivElement>(null);
  const flyIdRef = useRef(0);

  // Recompute legal moves, status, and position history when position changes.
  // Replay from history (ground truth) rather than incrementally counting —
  // avoids double-counting in React StrictMode and is always correct.
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

  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [history]);

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

  function handleSquareClick(r: number, c: number) {
    if (!mode || promotionPending) return;
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

  function resetGame() {
    clearTT();
    posHistoryRef.current = new Map();
    posBeforeRef.current = [];
    setPos(initialPosition());
    setSelected(null);
    setLastMove(null);
    setHistory([]);
    setMoveGrades([]);
    setPromotionPending(null);
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

  const rounds: [Move, Move | null][] = [];
  for (let i = 0; i < history.length; i += 2) {
    rounds.push([history[i], history[i + 1] ?? null]);
  }

  function copyHistory() {
    const cell = (m: Move, idx: number) => {
      if (!copyGrades) return moveLabel(m);
      const g = gradeInfo(moveGrades[idx]);
      return g ? `${moveLabel(m)}${g.sym}` : moveLabel(m);
    };
    const text = rounds
      .map(([w, b], i) => `${i + 1}. ${cell(w, i * 2)}${b ? ` ${cell(b, i * 2 + 1)}` : ''}`)
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

  // Derive directly from pos (not status) — status is updated in a useEffect
  // and lags one render behind pos, which would otherwise flash the red square
  // on the wrong king for one frame after a king moves out of check.
  const checkKingSq = isInCheck(pos, pos.turn) ? findKing(pos.board, pos.turn) : null;

  const isGameOver = status === 'checkmate' || status === 'stalemate' || status === 'draw';

  return {
    pos,
    legalMoves,
    status,
    selected, setSelected,
    lastMove,
    history,
    promotionPending,
    drawReason,
    moveGrades,
    slideInfo,
    castleRookSlide,
    flyingPieces,
    copied,
    copyGrades,
    setCopyGrades,
    historyRef,
    posHistoryRef,
    boardGridRef,
    boardColRef,
    moveTos,
    checkKingSq,
    isGameOver,
    rounds,
    whiteCaptured,
    blackCaptured,
    materialAdv,
    handleSquareClick,
    handlePromotion,
    resetGame,
    applyGameMove,
    copyHistory,
  };
}
