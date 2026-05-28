import type { Move, Position } from '../types';
import { applyMove, getLegalMoves, initialPosition, positionKey } from '../engine';

// Common opening lines as UCI move sequences. Each line is a sequence of
// from-to coordinates (e2e4); promotions append the promoted piece
// letter (e7e8q). Lines may share early plies — the book de-duplicates
// per-position and a position with multiple book candidates picks
// at random for variety.
const OPENING_LINES: readonly (readonly string[])[] = [
  // 1. e4 ...
  ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5'],                       // Ruy Lopez
  ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4'],                       // Italian
  ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'd2d4'],                       // Scotch
  ['e2e4', 'e7e5', 'g1f3', 'g8f6'],                               // Petroff
  ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4'],                       // Open Sicilian (Najdorf-ish)
  ['e2e4', 'c7c5', 'g1f3', 'b8c6'],                               // Sicilian — knight variation
  ['e2e4', 'c7c5', 'g1f3', 'e7e6'],                               // Sicilian — Taimanov
  ['e2e4', 'e7e6', 'd2d4', 'd7d5'],                               // French
  ['e2e4', 'c7c6', 'd2d4', 'd7d5'],                               // Caro-Kann
  ['e2e4', 'd7d5', 'e4d5', 'd8d5'],                               // Scandinavian
  ['e2e4', 'd7d6', 'd2d4', 'g8f6'],                               // Pirc
  ['e2e4', 'g8f6', 'e4e5', 'f6d5'],                               // Alekhine

  // 1. d4 ...
  ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'g8f6'],               // QGD
  ['d2d4', 'd7d5', 'c2c4', 'c7c6'],                               // Slav
  ['d2d4', 'g8f6', 'c2c4', 'g7g6', 'b1c3', 'f8g7'],               // King's Indian
  ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'b1c3', 'f8b4'],               // Nimzo-Indian
  ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'g1f3', 'b7b6'],               // Queen's Indian
  ['d2d4', 'f7f5', 'g2g3'],                                       // Dutch

  // Flank openings
  ['c2c4', 'e7e5', 'b1c3'],                                       // English
  ['g1f3', 'd7d5', 'g2g3'],                                       // Reti
  ['g1f3', 'g8f6', 'c2c4'],                                       // Symmetric English
];

function parseUci(uci: string): { from: [number, number]; to: [number, number]; promo?: string } {
  // 'a'..'h' files → cols 0..7; '1'..'8' ranks → rows 7..0.
  const fromCol = uci.charCodeAt(0) - 97;
  const fromRow = 8 - parseInt(uci[1], 10);
  const toCol = uci.charCodeAt(2) - 97;
  const toRow = 8 - parseInt(uci[3], 10);
  const promo = uci.length > 4 ? uci[4].toUpperCase() : undefined;
  return { from: [fromRow, fromCol], to: [toRow, toCol], promo };
}

function findLegal(legal: Move[], parsed: ReturnType<typeof parseUci>): Move | null {
  for (const m of legal) {
    if (m.from[0] !== parsed.from[0] || m.from[1] !== parsed.from[1]) continue;
    if (m.to[0] !== parsed.to[0] || m.to[1] !== parsed.to[1]) continue;
    if (parsed.promo) {
      if (m.flag === 'promotion' && m.promotion === parsed.promo) return m;
    } else {
      if (m.flag !== 'promotion') return m;
    }
  }
  return null;
}

// Position key → list of book candidate moves for that position.
const book = new Map<string, Move[]>();

function sameMove(a: Move, b: Move): boolean {
  return a.from[0] === b.from[0] && a.from[1] === b.from[1]
      && a.to[0] === b.to[0]     && a.to[1] === b.to[1]
      && a.flag === b.flag
      && a.promotion === b.promotion;
}

(function buildBook(): void {
  for (const line of OPENING_LINES) {
    let pos = initialPosition();
    for (const uci of line) {
      const parsed = parseUci(uci);
      const legal = getLegalMoves(pos);
      const move = findLegal(legal, parsed);
      if (!move) break; // malformed entry — abandon this line

      const key = positionKey(pos);
      const existing = book.get(key);
      if (existing) {
        if (!existing.some(m => sameMove(m, move))) existing.push(move);
      } else {
        book.set(key, [move]);
      }
      pos = applyMove(pos, move);
    }
  }
})();

// Returns a book move for the current position, or null on miss.
// Stored Move objects carry Piece references from the book-build replay,
// so we resolve through the caller's legal-move list to ensure the returned
// Move matches the live position's captured-piece pointers.
export function lookupBookMove(pos: Position, legalMoves: Move[]): Move | null {
  const candidates = book.get(positionKey(pos));
  if (!candidates || candidates.length === 0) return null;

  const live: Move[] = [];
  for (const bm of candidates) {
    const match = legalMoves.find(lm => sameMove(lm, bm));
    if (match) live.push(match);
  }
  if (live.length === 0) return null;
  return live[Math.floor(Math.random() * live.length)];
}
