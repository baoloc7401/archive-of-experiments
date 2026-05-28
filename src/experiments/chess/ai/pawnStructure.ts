import type { Board, Color } from '../types';

const DOUBLED_PENALTY = 20;
const ISOLATED_PENALTY = 30;
// Passed-pawn bonus indexed by ranks-advanced-from-own-back-rank.
// Index 0 = own back rank (never a pawn); 6 = one square from promotion.
const PASSED_BONUS: readonly number[] = [0, 5, 10, 20, 40, 60, 90, 120];

function isPassed(board: Board, r: number, c: number, color: Color): boolean {
  const dir = color === 'w' ? -1 : 1;
  const stop = color === 'w' ? -1 : 8;
  let row = r + dir;
  while (row !== stop) {
    for (let dc = -1; dc <= 1; dc++) {
      const col = c + dc;
      if (col < 0 || col > 7) continue;
      const p = board[row][col];
      if (p?.type === 'P' && p.color !== color) return false;
    }
    row += dir;
  }
  return true;
}

// Score from white's perspective: positive favors white.
export function pawnStructureScore(board: Board): number {
  const wFiles = new Int8Array(8);
  const bFiles = new Int8Array(8);

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p?.type !== 'P') continue;
      if (p.color === 'w') wFiles[c]++;
      else bFiles[c]++;
    }
  }

  let score = 0;

  for (let c = 0; c < 8; c++) {
    // Doubled pawns: penalty per extra pawn on the same file.
    if (wFiles[c] > 1) score -= DOUBLED_PENALTY * (wFiles[c] - 1);
    if (bFiles[c] > 1) score += DOUBLED_PENALTY * (bFiles[c] - 1);

    // Isolated pawns: no friendly pawns on adjacent files.
    const left = c > 0;
    const right = c < 7;
    const wIsolated = wFiles[c] > 0
      && (!left  || wFiles[c - 1] === 0)
      && (!right || wFiles[c + 1] === 0);
    const bIsolated = bFiles[c] > 0
      && (!left  || bFiles[c - 1] === 0)
      && (!right || bFiles[c + 1] === 0);
    if (wIsolated) score -= ISOLATED_PENALTY * wFiles[c];
    if (bIsolated) score += ISOLATED_PENALTY * bFiles[c];
  }

  // Passed pawns: scaled by how far advanced they are.
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p?.type !== 'P') continue;
      if (!isPassed(board, r, c, p.color)) continue;
      const advance = p.color === 'w' ? 7 - r : r;
      const bonus = PASSED_BONUS[advance] ?? 0;
      score += p.color === 'w' ? bonus : -bonus;
    }
  }

  return score;
}
