export const PIECE_VALUE: Record<string, number> = {
  P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000,
};

// A draw is slightly bad for both sides — the winning side should try to win,
// the losing side still prefers a draw over a bigger loss (contempt < any real loss).
export const CONTEMPT = -50;

// Score magnitude returned for checkmate; sign indicates the mated side.
export const MATE_SCORE = 99999;

// Total non-K/non-P material below this triggers endgame heuristics.
export const ENDGAME_MATERIAL = 1500;

// Null-move pruning: minimum remaining depth and base reduction.
// Adaptive R = NMP_BASE_R + depth / 3 (CPW recommendation).
export const NMP_MIN_DEPTH = 3;
export const NMP_BASE_R = 3;

// Futility pruning margins by remaining depth. Index 0 unused (depth==0 → quiesce).
// Depth 1 ≈ minor piece value; depth 2 ≈ rook value.
export const FUTILITY_MARGINS: readonly number[] = [0, 300, 500];

// Cap on cumulative check-extensions per search path to avoid explosions
// in long forcing-check sequences.
export const MAX_EXTENSIONS = 16;

// Centipawns per pseudo-legal-move difference between sides.
// Low weight keeps mobility from dominating material in noisy positions.
export const MOBILITY_WEIGHT = 4;

// Late Move Reductions — only kick in past the first few well-ordered moves
// at non-shallow depths. Reduction is logarithmic per CPW / Obsidian.
export const LMR_MIN_DEPTH = 3;
export const LMR_MIN_MOVE_INDEX = 4;

// Quiescence: how many initial qdepth plies include check-giving moves
// in addition to captures. Bounded to prevent node explosion.
export const QS_CHECK_PLIES = 2;

// Piece-square tables from white's perspective.
// Row 0 = rank 8 (top, black's back / white's advanced rank).
// For white: use board row directly. For black: use (7 - row).
export const PST: Record<string, readonly (readonly number[])[]> = {
  P: [
    [ 0,  0,  0,  0,  0,  0,  0,  0],
    [50, 50, 50, 50, 50, 50, 50, 50],
    [10, 10, 20, 30, 30, 20, 10, 10],
    [ 5,  5, 10, 25, 25, 10,  5,  5],
    [ 0,  0,  0, 20, 20,  0,  0,  0],
    [ 5, -5,-10,  0,  0,-10, -5,  5],
    [ 5, 10, 10,-20,-20, 10, 10,  5],
    [ 0,  0,  0,  0,  0,  0,  0,  0],
  ],
  N: [
    [-50,-40,-30,-30,-30,-30,-40,-50],
    [-40,-20,  0,  0,  0,  0,-20,-40],
    [-30,  0, 10, 15, 15, 10,  0,-30],
    [-30,  5, 15, 20, 20, 15,  5,-30],
    [-30,  0, 15, 20, 20, 15,  0,-30],
    [-30,  5, 10, 15, 15, 10,  5,-30],
    [-40,-20,  0,  5,  5,  0,-20,-40],
    [-50,-40,-30,-30,-30,-30,-40,-50],
  ],
  B: [
    [-20,-10,-10,-10,-10,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5, 10, 10,  5,  0,-10],
    [-10,  5,  5, 10, 10,  5,  5,-10],
    [-10,  0, 10, 10, 10, 10,  0,-10],
    [-10, 10, 10, 10, 10, 10, 10,-10],
    [-10,  5,  0,  0,  0,  0,  5,-10],
    [-20,-10,-10,-10,-10,-10,-10,-20],
  ],
  R: [
    [ 0,  0,  0,  0,  0,  0,  0,  0],
    [ 5, 10, 10, 10, 10, 10, 10,  5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [ 0,  0,  0,  5,  5,  0,  0,  0],
  ],
  Q: [
    [-20,-10,-10, -5, -5,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5,  5,  5,  5,  0,-10],
    [ -5,  0,  5,  5,  5,  5,  0, -5],
    [  0,  0,  5,  5,  5,  5,  0, -5],
    [-10,  5,  5,  5,  5,  5,  0,-10],
    [-10,  0,  5,  0,  0,  0,  0,-10],
    [-20,-10,-10, -5, -5,-10,-10,-20],
  ],
  K: [
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-20,-30,-30,-40,-40,-30,-30,-20],
    [-10,-20,-20,-20,-20,-20,-20,-10],
    [ 20, 20,  0,  0,  0,  0, 20, 20],
    [ 20, 30, 10,  0,  0, 10, 30, 20],
  ],
};

// In the endgame the king becomes an active piece and should centralize.
export const PST_KING_EG: readonly (readonly number[])[] = [
  [-50,-40,-30,-20,-20,-30,-40,-50],
  [-30,-20,-10,  0,  0,-10,-20,-30],
  [-30,-10, 20, 30, 30, 20,-10,-30],
  [-30,-10, 30, 40, 40, 30,-10,-30],
  [-30,-10, 30, 40, 40, 30,-10,-30],
  [-30,-10, 20, 30, 30, 20,-10,-30],
  [-30,-20,-10,  0,  0,-10,-20,-30],
  [-50,-40,-30,-20,-20,-30,-40,-50],
];
