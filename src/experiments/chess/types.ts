export type Color = 'w' | 'b';
export type PieceType = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P';

export interface Piece {
  type: PieceType;
  color: Color;
}

export type Board = (Piece | null)[][];

export type MoveFlag =
  | 'normal'
  | 'double-push'
  | 'en-passant'
  | 'castle-k'
  | 'castle-q'
  | 'promotion';

export interface Move {
  from: [number, number];
  to: [number, number];
  flag: MoveFlag;
  promotion?: PieceType;
  captured?: Piece;
}

export interface Position {
  board: Board;
  turn: Color;
  castling: { wk: boolean; wq: boolean; bk: boolean; bq: boolean };
  ep: [number, number] | null;
  halfmove: number;
  fullmove: number;
}

export type GameStatus = 'playing' | 'check' | 'checkmate' | 'stalemate' | 'draw';
export type GameMode = 'hvh' | 'hva' | 'ava';
