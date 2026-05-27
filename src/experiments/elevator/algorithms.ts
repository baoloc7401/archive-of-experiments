import type { AlgorithmId, Direction, ElevatorRequest } from './types';

export interface Decision {
  nextPos: number;
  direction: Direction;
  isJump: boolean;
}

interface Ctx {
  pending: ElevatorRequest[];
  position: number;
  direction: Direction;
  totalFloors: number;
}

export function decide(algorithm: AlgorithmId, ctx: Ctx): Decision | null {
  if (ctx.pending.length === 0) return null;
  switch (algorithm) {
    case 'fcfs':   return decideFCFS(ctx);
    case 'sstf':   return decideSSTF(ctx);
    case 'scan':   return decideSCAN(ctx);
    case 'look':   return decideLOOK(ctx);
    case 'c-scan': return decideCSCAN(ctx);
    case 'c-look': return decideCLOOK(ctx);
  }
}

function step(from: number, to: number): Direction {
  return to > from ? 'up' : 'down';
}

function decideFCFS({ pending, position }: Ctx): Decision | null {
  const target = pending[0].floor;
  if (target === position) return null;
  const dir = step(position, target);
  return { nextPos: position + (dir === 'up' ? 1 : -1), direction: dir, isJump: false };
}

function decideSSTF({ pending, position }: Ctx): Decision | null {
  let best = pending[0];
  let bestDist = Math.abs(best.floor - position);
  for (const r of pending) {
    const d = Math.abs(r.floor - position);
    if (d < bestDist) { best = r; bestDist = d; }
  }
  if (best.floor === position) return null;
  const dir = step(position, best.floor);
  return { nextPos: position + (dir === 'up' ? 1 : -1), direction: dir, isJump: false };
}

function decideSCAN({ pending, position, direction, totalFloors }: Ctx): Decision | null {
  const top = totalFloors - 1;
  if (direction === 'up') {
    if (position < top) {
      return { nextPos: position + 1, direction: 'up', isJump: false };
    }
    // at top boundary — reverse
    const hasDown = pending.some(r => r.floor < position);
    if (hasDown) return { nextPos: position - 1, direction: 'down', isJump: false };
    return null;
  } else {
    if (position > 0) {
      return { nextPos: position - 1, direction: 'down', isJump: false };
    }
    const hasUp = pending.some(r => r.floor > position);
    if (hasUp) return { nextPos: position + 1, direction: 'up', isJump: false };
    return null;
  }
}

function decideLOOK({ pending, position, direction }: Ctx): Decision | null {
  const hasUp = pending.some(r => r.floor > position);
  const hasDown = pending.some(r => r.floor < position);
  if (direction === 'up') {
    if (hasUp) return { nextPos: position + 1, direction: 'up', isJump: false };
    if (hasDown) return { nextPos: position - 1, direction: 'down', isJump: false };
    return null;
  } else {
    if (hasDown) return { nextPos: position - 1, direction: 'down', isJump: false };
    if (hasUp) return { nextPos: position + 1, direction: 'up', isJump: false };
    return null;
  }
}

function decideCSCAN({ pending, position, totalFloors }: Ctx): Decision | null {
  const top = totalFloors - 1;
  if (position < top) {
    return { nextPos: position + 1, direction: 'up', isJump: false };
  }
  // at top: jump to floor 0
  if (pending.some(r => r.floor < position)) {
    return { nextPos: 0, direction: 'up', isJump: true };
  }
  return null;
}

function decideCLOOK({ pending, position }: Ctx): Decision | null {
  const hasUp = pending.some(r => r.floor > position);
  if (hasUp) return { nextPos: position + 1, direction: 'up', isJump: false };
  const min = pending.reduce((m, r) => Math.min(m, r.floor), Infinity);
  if (!Number.isFinite(min) || min === position) return null;
  return { nextPos: min, direction: 'up', isJump: true };
}
