import type { AlgorithmInfo, AlgorithmId } from './types';

export const TOTAL_FLOORS = 12;

export const SPEED_PRESETS: { label: string; ms: number }[] = [
  { label: '0.5×', ms: 1200 },
  { label: '1×',   ms: 600 },
  { label: '2×',   ms: 320 },
  { label: '4×',   ms: 160 },
  { label: '8×',   ms: 80 },
];

export const DEFAULT_SPEED_INDEX = 1;

/** One colour per elevator in comparison mode (by selection order). The first
 *  three reuse theme tokens so they stay theme-aware; the rest are fixed. */
export const SHAFT_COLORS = [
  'var(--accent)',
  'var(--accent2)',
  'var(--wip)',
  '#4da8ff',
  '#ff5d9e',
  '#ff9f43',
];

export const ALGORITHMS: AlgorithmInfo[] = [
  {
    id: 'fcfs',
    name: 'FCFS',
    short: 'first-come, first-served',
    tagline: 'fair but lazy',
    description:
      'Serves requests strictly in the order they were made. Simple, predictable, but ignores geometry — the elevator can zigzag wildly.',
  },
  {
    id: 'sstf',
    name: 'SSTF',
    short: 'shortest seek time first',
    tagline: 'greedy & impatient',
    description:
      'Always picks the closest pending request. Fast on average but can starve distant floors when nearby requests keep arriving.',
  },
  {
    id: 'scan',
    name: 'SCAN',
    short: 'the classic elevator sweep',
    tagline: 'all the way to the wall',
    description:
      'Travels to one end of the building, then reverses — like a windscreen wiper. Always touches the boundary even when nobody is there.',
  },
  {
    id: 'look',
    name: 'LOOK',
    short: 'sweep, but smarter',
    tagline: 'turn back when nobody is up there',
    description:
      'Just like SCAN, but reverses direction at the last pending request instead of the building edge. The everyday-elevator algorithm.',
  },
  {
    id: 'c-scan',
    name: 'C-SCAN',
    short: 'circular SCAN',
    tagline: 'one-way express',
    description:
      'Only services requests while going up. At the top it runs non-stop straight back down to the ground floor (serving no one), then sweeps up again. Fairer wait times.',
  },
  {
    id: 'c-look',
    name: 'C-LOOK',
    short: 'circular LOOK',
    tagline: 'rewind to lowest request',
    description:
      'Like C-SCAN but skips the dead-zone trip to the building edge. After serving the highest pending request, it runs non-stop straight down to the lowest one, then sweeps up.',
  },
];

export const ALGORITHM_BY_ID: Record<AlgorithmId, AlgorithmInfo> =
  Object.fromEntries(ALGORITHMS.map(a => [a.id, a])) as Record<AlgorithmId, AlgorithmInfo>;
