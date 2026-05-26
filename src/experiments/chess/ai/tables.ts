import type { Move } from '../types';

export type TTFlag = 'exact' | 'lower' | 'upper';

export interface TTEntry {
  depth: number;
  flag: TTFlag;
  score: number;
  bestMove?: Move;
}

// Transposition table: position key → cached evaluation + best move.
// Persists across getBestMove calls within a game; cleared between games.
export const tt = new Map<string, TTEntry>();

// History heuristic: quiet move → cut-off score accumulated over the game.
// Persists across getBestMove calls; decayed (halved) at the start of each search.
export const histTable = new Map<string, number>();

// Releases all cached search state. Called by resetGame() between games.
export function clearTT(): void {
  tt.clear();
  histTable.clear();
}
