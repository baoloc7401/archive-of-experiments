import type { Move, Position } from './types';
import { FILES, RANKS } from './constants';
import { applyMove } from './engine';
import { evaluate as evaluatePosition, getBestMove } from './ai';
import { GRADER_CONFIG } from './ai/skill';

export function sqName(r: number, c: number): string {
  return FILES[c] + RANKS[r];
}

export function moveLabel(m: Move): string {
  const base = sqName(m.from[0], m.from[1]) + sqName(m.to[0], m.to[1]);
  return m.flag === 'promotion' ? base + m.promotion!.toLowerCase() : base;
}

export function computeGrade(posBefore: Position, chosenMove: Move): number {
  const best = getBestMove(posBefore, GRADER_CONFIG);
  if (!best) return 8;
  const isWhite = posBefore.turn === 'w';
  const evalBest = evaluatePosition(applyMove(posBefore, best));
  const evalChosen = evaluatePosition(applyMove(posBefore, chosenMove));
  const cpLoss = isWhite ? evalBest - evalChosen : evalChosen - evalBest;
  if (cpLoss <= 0)   return 10;
  if (cpLoss <= 25)  return 9;
  if (cpLoss <= 75)  return 8;
  if (cpLoss <= 150) return 7;
  if (cpLoss <= 300) return 6;
  if (cpLoss <= 500) return 4;
  return 2;
}

export function gradeInfo(grade: number | undefined): { sym: string; cls: string } | null {
  if (grade === undefined || grade === 8) return null;
  if (grade >= 10) return { sym: '!!', cls: 'grade-brilliant' };
  if (grade >= 9)  return { sym: '!',  cls: 'grade-good' };
  if (grade >= 7)  return { sym: '!?', cls: 'grade-interesting' };
  if (grade >= 6)  return { sym: '?!', cls: 'grade-inaccuracy' };
  if (grade >= 4)  return { sym: '?',  cls: 'grade-mistake' };
  return             { sym: '??', cls: 'grade-blunder' };
}
