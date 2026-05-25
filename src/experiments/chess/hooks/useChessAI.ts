import { useEffect, useRef, useState } from 'react';
import type { GameMode, GameStatus, Move, Position } from '../types';
import { AI_DELAY, AI_DEPTH } from '../constants';
import { getBestMove } from '../ai';

interface Props {
  mode: GameMode | null;
  pos: Position;
  status: GameStatus;
  promotionPending: { from: [number, number]; to: [number, number] } | null;
  paused: boolean;
  posHistoryRef: React.MutableRefObject<Map<string, number>>;
  applyGameMove: (pos: Position, move: Move) => void;
}

export function useChessAI({ mode, pos, status, promotionPending, paused, posHistoryRef, applyGameMove }: Props) {
  const [thinking, setThinking] = useState(false);
  const applyRef = useRef(applyGameMove);
  applyRef.current = applyGameMove;

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
      if (move) applyRef.current(currentPos, move);
      setThinking(false);
    }, AI_DELAY[mode]);

    return () => {
      clearTimeout(timer);
      setThinking(false);
    };
  }, [pos, mode, status, promotionPending, paused]);

  function stepAI() {
    if (!mode || thinking) return;
    if (status !== 'playing' && status !== 'check') return;
    setThinking(true);
    const currentPos = pos;
    const currentHistory = new Map(posHistoryRef.current);
    setTimeout(() => {
      const move = getBestMove(currentPos, AI_DEPTH[mode], currentHistory);
      if (move) applyRef.current(currentPos, move);
      setThinking(false);
    }, 50);
  }

  return { thinking, stepAI };
}
