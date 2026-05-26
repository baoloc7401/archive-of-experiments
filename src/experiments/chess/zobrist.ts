import type { Color, PieceType, Position } from './types';

const PIECE_TYPE_INDEX: Record<PieceType, number> = { P: 0, N: 1, B: 2, R: 3, Q: 4, K: 5 };

function rand64(): bigint {
  // Two 32-bit chunks via Math.random — uniform enough for hashing.
  // No cryptographic strength needed: collisions are rare and the TT
  // never escapes the page (cleared on game reset, never persisted).
  const hi = BigInt(Math.floor(Math.random() * 0x100000000));
  const lo = BigInt(Math.floor(Math.random() * 0x100000000));
  return (hi << 32n) | lo;
}

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

// Full hash computation — used for initial position and validation.
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
