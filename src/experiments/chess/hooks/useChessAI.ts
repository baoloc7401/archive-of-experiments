import { useCallback, useEffect, useRef, useState } from 'react';
import type { AIConfig, GameMode, GameStatus, Move, Position } from '../types';
import { AI_DELAY } from '../constants';
import type { SearchRequest, SearchResult } from '../ai/worker';

interface Props {
  mode: GameMode | null;
  pos: Position;
  status: GameStatus;
  promotionPending: { from: [number, number]; to: [number, number] } | null;
  paused: boolean;
  posHistoryRef: React.MutableRefObject<Map<string, number>>;
  applyGameMove: (pos: Position, move: Move) => void;
  whiteConfig: AIConfig;
  blackConfig: AIConfig;
}

export function useChessAI({ mode, pos, status, promotionPending, paused, posHistoryRef, applyGameMove, whiteConfig, blackConfig }: Props) {
  const [thinking, setThinking] = useState(false);
  const applyRef = useRef(applyGameMove);
  applyRef.current = applyGameMove;

  // Persistent worker: keeps the per-game TT and history heuristic between
  // searches, and runs alpha-beta off the UI thread so the board stays
  // responsive even at deeper search levels.
  const workerRef = useRef<Worker | null>(null);
  const searchIdRef = useRef(0);
  const activeIdRef = useRef<number | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL('../ai/worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const runSearch = useCallback((currentPos: Position, config: AIConfig) => {
    const worker = workerRef.current;
    if (!worker) return () => {};

    const id = ++searchIdRef.current;
    activeIdRef.current = id;
    setThinking(true);

    const onMessage = (e: MessageEvent<SearchResult>) => {
      if (e.data.type !== 'result' || e.data.id !== id) return;
      worker.removeEventListener('message', onMessage);
      // Ignore stale results — a newer search has superseded this one.
      if (activeIdRef.current !== id) return;
      activeIdRef.current = null;
      if (e.data.move) applyRef.current(currentPos, e.data.move);
      setThinking(false);
    };
    worker.addEventListener('message', onMessage);

    const req: SearchRequest = {
      type: 'search',
      id,
      pos: currentPos,
      config,
      history: Array.from(posHistoryRef.current),
    };
    worker.postMessage(req);

    return () => {
      worker.removeEventListener('message', onMessage);
      // Don't terminate — the worker keeps TT state across searches.
      // Stale results are filtered by id check above.
      if (activeIdRef.current === id) activeIdRef.current = null;
      setThinking(false);
    };
  }, [posHistoryRef]);

  useEffect(() => {
    if (!mode || promotionPending || paused) return;
    if (status !== 'playing' && status !== 'check') return;

    const isAITurn = mode === 'ava' || (mode === 'hva' && pos.turn === 'b');
    if (!isAITurn) return;

    const currentPos = pos;
    const config = pos.turn === 'w' ? whiteConfig : blackConfig;

    // Animation delay before the AI move appears — matches the prior behavior.
    const timer = setTimeout(() => runSearch(currentPos, config), AI_DELAY[mode]);

    return () => {
      clearTimeout(timer);
      activeIdRef.current = null;
      setThinking(false);
    };
  }, [pos, mode, status, promotionPending, paused, runSearch, whiteConfig, blackConfig]);

  function stepAI() {
    if (!mode || thinking) return;
    if (status !== 'playing' && status !== 'check') return;
    const config = pos.turn === 'w' ? whiteConfig : blackConfig;
    runSearch(pos, config);
  }

  // Called by the page on game reset so the worker's TT doesn't leak
  // between games. Main-thread tables are cleared separately by useChessGame.
  function clearAI() {
    activeIdRef.current = null;
    setThinking(false);
    workerRef.current?.postMessage({ type: 'clear' });
  }

  return { thinking, stepAI, clearAI };
}
