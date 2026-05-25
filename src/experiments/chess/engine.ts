import type { Board, Color, Move, Piece, PieceType, Position } from './types';

export function initialPosition(): Position {
  const board: Board = Array.from({ length: 8 }, () => Array(8).fill(null));
  const back: PieceType[] = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
  for (let col = 0; col < 8; col++) {
    board[0][col] = { type: back[col], color: 'b' };
    board[7][col] = { type: back[col], color: 'w' };
    board[1][col] = { type: 'P', color: 'b' };
    board[6][col] = { type: 'P', color: 'w' };
  }
  return {
    board,
    turn: 'w',
    castling: { wk: true, wq: true, bk: true, bq: true },
    ep: null,
    halfmove: 0,
    fullmove: 1,
  };
}

export function opponent(color: Color): Color {
  return color === 'w' ? 'b' : 'w';
}

function onBoard(r: number, c: number): boolean {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

export function cloneBoard(board: Board): Board {
  return board.map(row => [...row]);
}

function clonePosition(pos: Position): Position {
  return {
    board: cloneBoard(pos.board),
    turn: pos.turn,
    castling: { ...pos.castling },
    ep: pos.ep ? [pos.ep[0], pos.ep[1]] : null,
    halfmove: pos.halfmove,
    fullmove: pos.fullmove,
  };
}

function addPawnMoves(pos: Position, r: number, c: number, moves: Move[]): void {
  const { board, ep, turn } = pos;
  const dir = turn === 'w' ? -1 : 1;
  const startRank = turn === 'w' ? 6 : 1;
  const promRank = turn === 'w' ? 0 : 7;
  const opp = opponent(turn);

  const r1 = r + dir;
  if (onBoard(r1, c) && !board[r1][c]) {
    if (r1 === promRank) {
      for (const pt of ['Q', 'R', 'B', 'N'] as PieceType[]) {
        moves.push({ from: [r, c], to: [r1, c], flag: 'promotion', promotion: pt });
      }
    } else {
      moves.push({ from: [r, c], to: [r1, c], flag: 'normal' });
      if (r === startRank && !board[r + 2 * dir][c]) {
        moves.push({ from: [r, c], to: [r + 2 * dir, c], flag: 'double-push' });
      }
    }
  }

  for (const dc of [-1, 1]) {
    const r2 = r + dir, c2 = c + dc;
    if (!onBoard(r2, c2)) continue;
    const target = board[r2][c2];
    if (target?.color === opp) {
      if (r2 === promRank) {
        for (const pt of ['Q', 'R', 'B', 'N'] as PieceType[]) {
          moves.push({ from: [r, c], to: [r2, c2], flag: 'promotion', promotion: pt, captured: target });
        }
      } else {
        moves.push({ from: [r, c], to: [r2, c2], flag: 'normal', captured: target });
      }
    } else if (ep && ep[0] === r2 && ep[1] === c2) {
      moves.push({ from: [r, c], to: [r2, c2], flag: 'en-passant' });
    }
  }
}

function addKnightMoves(board: Board, r: number, c: number, color: Color, moves: Move[]): void {
  for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]] as [number,number][]) {
    const r2 = r + dr, c2 = c + dc;
    if (!onBoard(r2, c2) || board[r2][c2]?.color === color) continue;
    moves.push({ from: [r, c], to: [r2, c2], flag: 'normal', captured: board[r2][c2] ?? undefined });
  }
}

function addSlidingMoves(
  board: Board, r: number, c: number, color: Color, moves: Move[],
  dirs: [number, number][],
): void {
  for (const [dr, dc] of dirs) {
    let r2 = r + dr, c2 = c + dc;
    while (onBoard(r2, c2)) {
      const target = board[r2][c2];
      if (target?.color === color) break;
      moves.push({ from: [r, c], to: [r2, c2], flag: 'normal', captured: target ?? undefined });
      if (target) break;
      r2 += dr; c2 += dc;
    }
  }
}

const DIAGS: [number, number][] = [[-1,-1],[-1,1],[1,-1],[1,1]];
const ORTHOS: [number, number][] = [[-1,0],[1,0],[0,-1],[0,1]];
const ALL_DIRS = [...DIAGS, ...ORTHOS];
const KING_OFFS: [number, number][] = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
const KNIGHT_OFFS: [number, number][] = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];

function addKingMoves(pos: Position, r: number, c: number, moves: Move[]): void {
  const { board, castling, turn } = pos;
  const color = turn;

  for (const [dr, dc] of KING_OFFS) {
    const r2 = r + dr, c2 = c + dc;
    if (!onBoard(r2, c2) || board[r2][c2]?.color === color) continue;
    moves.push({ from: [r, c], to: [r2, c2], flag: 'normal', captured: board[r2][c2] ?? undefined });
  }

  const rank = color === 'w' ? 7 : 0;
  if (r !== rank || c !== 4) return;

  if ((color === 'w' ? castling.wk : castling.bk)
    && !board[rank][5] && !board[rank][6]
    && board[rank][7]?.type === 'R' && board[rank][7]?.color === color) {
    moves.push({ from: [r, c], to: [rank, 6], flag: 'castle-k' });
  }
  if ((color === 'w' ? castling.wq : castling.bq)
    && !board[rank][3] && !board[rank][2] && !board[rank][1]
    && board[rank][0]?.type === 'R' && board[rank][0]?.color === color) {
    moves.push({ from: [r, c], to: [rank, 2], flag: 'castle-q' });
  }
}

function pseudoLegalMoves(pos: Position): Move[] {
  const moves: Move[] = [];
  const { board, turn } = pos;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece || piece.color !== turn) continue;
      switch (piece.type) {
        case 'P': addPawnMoves(pos, r, c, moves); break;
        case 'N': addKnightMoves(board, r, c, turn, moves); break;
        case 'B': addSlidingMoves(board, r, c, turn, moves, DIAGS); break;
        case 'R': addSlidingMoves(board, r, c, turn, moves, ORTHOS); break;
        case 'Q': addSlidingMoves(board, r, c, turn, moves, ALL_DIRS); break;
        case 'K': addKingMoves(pos, r, c, moves); break;
      }
    }
  }
  return moves;
}

export function isSquareAttacked(board: Board, r: number, c: number, byColor: Color): boolean {
  for (const [dr, dc] of KNIGHT_OFFS) {
    const p = onBoard(r+dr, c+dc) && board[r+dr][c+dc];
    if (p && p.color === byColor && p.type === 'N') return true;
  }
  const pawnRow = byColor === 'w' ? r + 1 : r - 1;
  for (const dc of [-1, 1]) {
    const p = onBoard(pawnRow, c+dc) && board[pawnRow][c+dc];
    if (p && p.color === byColor && p.type === 'P') return true;
  }
  for (const [dr, dc] of KING_OFFS) {
    const p = onBoard(r+dr, c+dc) && board[r+dr][c+dc];
    if (p && p.color === byColor && p.type === 'K') return true;
  }
  for (const [dr, dc] of ORTHOS) {
    let r2 = r + dr, c2 = c + dc;
    while (onBoard(r2, c2)) {
      const p = board[r2][c2];
      if (p) { if (p.color === byColor && (p.type === 'R' || p.type === 'Q')) return true; break; }
      r2 += dr; c2 += dc;
    }
  }
  for (const [dr, dc] of DIAGS) {
    let r2 = r + dr, c2 = c + dc;
    while (onBoard(r2, c2)) {
      const p = board[r2][c2];
      if (p) { if (p.color === byColor && (p.type === 'B' || p.type === 'Q')) return true; break; }
      r2 += dr; c2 += dc;
    }
  }
  return false;
}

export function findKing(board: Board, color: Color): [number, number] | null {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c]?.type === 'K' && board[r][c]?.color === color) return [r, c];
  return null;
}

export function isInCheck(pos: Position, color: Color): boolean {
  const kp = findKing(pos.board, color);
  return kp ? isSquareAttacked(pos.board, kp[0], kp[1], opponent(color)) : false;
}

export function applyMove(pos: Position, move: Move): Position {
  const np = clonePosition(pos);
  const { board } = np;
  const [fr, fc] = move.from;
  const [tr, tc] = move.to;
  const piece = board[fr][fc] as Piece;

  board[tr][tc] = piece;
  board[fr][fc] = null;

  if (move.flag === 'en-passant') {
    board[pos.turn === 'w' ? tr + 1 : tr - 1][tc] = null;
  } else if (move.flag === 'castle-k') {
    const rank = pos.turn === 'w' ? 7 : 0;
    board[rank][5] = board[rank][7];
    board[rank][7] = null;
  } else if (move.flag === 'castle-q') {
    const rank = pos.turn === 'w' ? 7 : 0;
    board[rank][3] = board[rank][0];
    board[rank][0] = null;
  } else if (move.flag === 'promotion') {
    board[tr][tc] = { type: move.promotion!, color: pos.turn };
  }

  if (piece.type === 'K') {
    if (pos.turn === 'w') { np.castling.wk = false; np.castling.wq = false; }
    else { np.castling.bk = false; np.castling.bq = false; }
  }
  if (piece.type === 'R') {
    if (fr === 7 && fc === 0) np.castling.wq = false;
    if (fr === 7 && fc === 7) np.castling.wk = false;
    if (fr === 0 && fc === 0) np.castling.bq = false;
    if (fr === 0 && fc === 7) np.castling.bk = false;
  }
  if (tr === 7 && tc === 0) np.castling.wq = false;
  if (tr === 7 && tc === 7) np.castling.wk = false;
  if (tr === 0 && tc === 0) np.castling.bq = false;
  if (tr === 0 && tc === 7) np.castling.bk = false;

  np.ep = move.flag === 'double-push' ? [(fr + tr) / 2, tc] : null;
  np.halfmove = piece.type === 'P' || move.captured ? 0 : np.halfmove + 1;
  if (pos.turn === 'b') np.fullmove++;
  np.turn = opponent(pos.turn);

  return np;
}

export function getLegalMoves(pos: Position): Move[] {
  const legal: Move[] = [];
  for (const move of pseudoLegalMoves(pos)) {
    if (move.flag === 'castle-k' || move.flag === 'castle-q') {
      if (isInCheck(pos, pos.turn)) continue;
      const rank = pos.turn === 'w' ? 7 : 0;
      const passCol = move.flag === 'castle-k' ? 5 : 3;
      const tmp = cloneBoard(pos.board);
      tmp[rank][passCol] = tmp[rank][4];
      tmp[rank][4] = null;
      if (isSquareAttacked(tmp, rank, passCol, opponent(pos.turn))) continue;
    }
    const np = applyMove(pos, move);
    if (!isInCheck(np, pos.turn)) legal.push(move);
  }
  return legal;
}

export function positionKey(pos: Position): string {
  let k = pos.turn;
  k += pos.castling.wk ? 'K' : '-';
  k += pos.castling.wq ? 'Q' : '-';
  k += pos.castling.bk ? 'k' : '-';
  k += pos.castling.bq ? 'q' : '-';
  k += pos.ep ? `${pos.ep[0]}${pos.ep[1]}` : '--';
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = pos.board[r][c];
      k += p ? p.color + p.type : '..';
    }
  return k;
}

export function getGameStatus(pos: Position, legalMoves: Move[]): import('./types').GameStatus {
  if (pos.halfmove >= 100) return 'draw';
  if (legalMoves.length === 0) return isInCheck(pos, pos.turn) ? 'checkmate' : 'stalemate';
  return isInCheck(pos, pos.turn) ? 'check' : 'playing';
}
