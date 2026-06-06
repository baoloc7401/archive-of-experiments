import type { AlgorithmId, Direction, ElevatorRequest } from './types';

export interface Decision {
  nextPos: number;
  direction: Direction;
  /** If set, the car begins a non-stop EXPRESS run to this floor: it physically
   *  travels one floor per tick toward it WITHOUT serving anyone on the way,
   *  then resumes normal service on arrival. This is how the C-SCAN / C-LOOK
   *  circular return is modelled - a real descent, never a teleport. */
  express?: number;
}

interface Ctx {
  pending: ElevatorRequest[];
  position: number;
  direction: Direction;
  totalFloors: number;
  /** True on the tick the car restarts from a standstill - its `direction`
   *  is stale, so algorithms can choose a fresh heading instead. */
  idle: boolean;
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
  return { nextPos: position + (dir === 'up' ? 1 : -1), direction: dir };
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
  return { nextPos: position + (dir === 'up' ? 1 : -1), direction: dir };
}

function decideSCAN({ pending, position, direction, totalFloors }: Ctx): Decision | null {
  const top = totalFloors - 1;
  if (direction === 'up') {
    if (position < top) {
      return { nextPos: position + 1, direction: 'up' };
    }
    // at top boundary - reverse
    const hasDown = pending.some(r => r.floor < position);
    if (hasDown) return { nextPos: position - 1, direction: 'down' };
    return null;
  } else {
    if (position > 0) {
      return { nextPos: position - 1, direction: 'down' };
    }
    const hasUp = pending.some(r => r.floor > position);
    if (hasUp) return { nextPos: position + 1, direction: 'up' };
    return null;
  }
}

function decideLOOK({ pending, position, direction }: Ctx): Decision | null {
  const hasUp = pending.some(r => r.floor > position);
  const hasDown = pending.some(r => r.floor < position);
  if (direction === 'up') {
    if (hasUp) return { nextPos: position + 1, direction: 'up' };
    if (hasDown) return { nextPos: position - 1, direction: 'down' };
    return null;
  } else {
    if (hasDown) return { nextPos: position - 1, direction: 'down' };
    if (hasUp) return { nextPos: position + 1, direction: 'up' };
    return null;
  }
}

function decideCSCAN({ pending, position, totalFloors, idle }: Ctx): Decision | null {
  const top = totalFloors - 1;
  const anyAbove = pending.some(r => r.floor > position);
  // Restarting from a standstill with every call below us: don't trundle all
  // the way up to the top just to wrap - begin the express descent now.
  if (idle && !anyAbove && position > 0) {
    return { nextPos: position - 1, direction: 'down', express: 0 };
  }
  if (position < top) {
    return { nextPos: position + 1, direction: 'up' };
  }
  // at the top with calls below: express (non-stop) down to the ground floor,
  // then resume the upward sweep
  if (pending.some(r => r.floor < position)) {
    return { nextPos: position - 1, direction: 'down', express: 0 };
  }
  return null;
}

function decideCLOOK({ pending, position }: Ctx): Decision | null {
  const hasUp = pending.some(r => r.floor > position);
  if (hasUp) return { nextPos: position + 1, direction: 'up' };
  // nothing above: express (non-stop) down to the lowest pending request,
  // then resume the upward sweep from there
  const min = pending.reduce((m, r) => Math.min(m, r.floor), Infinity);
  if (!Number.isFinite(min) || min >= position) return null;
  return { nextPos: position - 1, direction: 'down', express: min };
}
