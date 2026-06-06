import type { Board, Color } from '../types';

// Local direction tables - duplicated from engine.ts to keep this hot-path
// counter independent of the legal-move generator (no allocations).
const ORTHO: ReadonlyArray<readonly [number, number]> = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const DIAG: ReadonlyArray<readonly [number, number]> = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const QUEEN: ReadonlyArray<readonly [number, number]> = [...ORTHO, ...DIAG];
const KNIGHT: ReadonlyArray<readonly [number, number]> =
  [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KING: ReadonlyArray<readonly [number, number]> =
  [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

function onBoard(r: number, c: number): boolean {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function slideCount(
  board: Board, r: number, c: number, color: Color,
  dirs: ReadonlyArray<readonly [number, number]>,
): number {
  let n = 0;
  for (const [dr, dc] of dirs) {
    let r2 = r + dr, c2 = c + dc;
    while (onBoard(r2, c2)) {
      const t = board[r2][c2];
      if (t) { if (t.color !== color) n++; break; }
      n++;
      r2 += dr; c2 += dc;
    }
  }
  return n;
}

// Pseudo-legal mobility - counts target squares without filtering
// for pin/check legality. Skips castling and en-passant (rare, negligible).
export function countMobility(board: Board, color: Color): number {
  let n = 0;
  const dir = color === 'w' ? -1 : 1;
  const startRank = color === 'w' ? 6 : 1;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p || p.color !== color) continue;

      switch (p.type) {
        case 'P': {
          if (onBoard(r + dir, c) && !board[r + dir][c]) {
            n++;
            if (r === startRank && !board[r + 2 * dir][c]) n++;
          }
          for (const dc of [-1, 1]) {
            const r2 = r + dir, c2 = c + dc;
            if (!onBoard(r2, c2)) continue;
            const t = board[r2][c2];
            if (t && t.color !== color) n++;
          }
          break;
        }
        case 'N':
          for (const [dr, dc] of KNIGHT) {
            const r2 = r + dr, c2 = c + dc;
            if (!onBoard(r2, c2)) continue;
            const t = board[r2][c2];
            if (!t || t.color !== color) n++;
          }
          break;
        case 'B': n += slideCount(board, r, c, color, DIAG); break;
        case 'R': n += slideCount(board, r, c, color, ORTHO); break;
        case 'Q': n += slideCount(board, r, c, color, QUEEN); break;
        case 'K':
          for (const [dr, dc] of KING) {
            const r2 = r + dr, c2 = c + dc;
            if (!onBoard(r2, c2)) continue;
            const t = board[r2][c2];
            if (!t || t.color !== color) n++;
          }
          break;
      }
    }
  }
  return n;
}
