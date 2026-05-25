import type { GameMode } from './types';

export const SYMBOLS: Record<string, string> = {
  wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
  bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟',
};

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
export const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

export const AI_DEPTH: Record<GameMode, number> = { hvh: 0, hva: 4, ava: 3 };
export const AI_DELAY: Record<GameMode, number> = { hvh: 0, hva: 150, ava: 450 };

export const PIECE_SORT: Record<string, number> = { Q: 0, R: 1, B: 2, N: 3, P: 4, K: 5 };
export const PIECE_VAL: Record<string, number> = { Q: 9, R: 5, B: 3, N: 3, P: 1, K: 0 };
