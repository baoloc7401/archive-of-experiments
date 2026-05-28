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
  { id: 'fcfs',   name: 'FCFS' },
  { id: 'sstf',   name: 'SSTF' },
  { id: 'scan',   name: 'SCAN' },
  { id: 'look',   name: 'LOOK' },
  { id: 'c-scan', name: 'C-SCAN' },
  { id: 'c-look', name: 'C-LOOK' },
];

export const ALGORITHM_BY_ID: Record<AlgorithmId, AlgorithmInfo> =
  Object.fromEntries(ALGORITHMS.map(a => [a.id, a])) as Record<AlgorithmId, AlgorithmInfo>;
