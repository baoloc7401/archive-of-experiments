import type { Color, PieceType, Position } from './types';

const PIECE_TYPE_INDEX: Record<PieceType, number> = { P: 0, N: 1, B: 2, R: 3, Q: 4, K: 5 };

const MASK64 = (1n << 64n) - 1n;

// Deterministic 64-bit PRNG (splitmix64). A fixed seed is essential: the
// search runs in a Web Worker, which is a separate module instance with its
// own copy of these key tables. Identical seeds guarantee the worker and the
// main thread derive the SAME keys, so position hashes (and therefore the
// opening book, repetition map, and TT) agree across the thread boundary.
function makeRand64(seed: bigint): () => bigint {
  let state = seed & MASK64;
  return () => {
    state = (state + 0x9E3779B97F4A7C15n) & MASK64;
    let z = state;
    z = ((z ^ (z >> 30n)) * 0xBF58476D1CE4E5B9n) & MASK64;
    z = ((z ^ (z >> 27n)) * 0x94D049BB133111EBn) & MASK64;
    z = (z ^ (z >> 31n)) & MASK64;
    return z;
  };
}

const rand64 = makeRand64(0x9E3779B97F4A7C15n);

// Precomputed at module load: 12 piece kinds × 64 squares, plus side-to-move,
// 4 castling rights, and 8 en-passant files.
const PIECE_KEYS: bigint[][] = Array.from({ length: 12 }, () =>
  Array.from({ length: 64 }, rand64),
);
const TURN_KEY: bigint = rand64();
const CASTLE_KEYS = { wk: rand64(), wq: rand64(), bk: rand64(), bq: rand64() } as const;
const EP_KEYS: readonly bigint[] = Array.from({ length: 8 }, rand64);

export type CastleSide = keyof typeof CASTLE_KEYS;

function pieceIndex(color: Color, type: PieceType): number {
  return PIECE_TYPE_INDEX[type] + (color === 'w' ? 0 : 6);
}

export function zPiece(color: Color, type: PieceType, r: number, c: number): bigint {
  return PIECE_KEYS[pieceIndex(color, type)][r * 8 + c];
}

export function zTurn(): bigint { return TURN_KEY; }
export function zCastle(side: CastleSide): bigint { return CASTLE_KEYS[side]; }
export function zEp(file: number): bigint { return EP_KEYS[file]; }

// Full hash computation - used for initial position and validation.
// Incremental updates happen inline in applyMove.
export function computeZobrist(pos: Position): bigint {
  let h = 0n;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = pos.board[r][c];
      if (p) h ^= zPiece(p.color, p.type, r, c);
    }
  }
  if (pos.turn === 'b') h ^= TURN_KEY;
  if (pos.castling.wk) h ^= CASTLE_KEYS.wk;
  if (pos.castling.wq) h ^= CASTLE_KEYS.wq;
  if (pos.castling.bk) h ^= CASTLE_KEYS.bk;
  if (pos.castling.bq) h ^= CASTLE_KEYS.bq;
  if (pos.ep) h ^= EP_KEYS[pos.ep[1]];
  return h;
}
