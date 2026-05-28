import type { AIConfig } from '../types';
import { DEFAULT_SKILL, SKILL_PRESETS } from './skill';

// Module-level holder so evaluate() and quiesce() can read live options
// without threading a config parameter through every recursive call. Safe
// because the worker serializes search requests and a single getBestMove
// call sets options before any search happens.
let current: AIConfig = SKILL_PRESETS[DEFAULT_SKILL];

export function setSearchOptions(c: AIConfig): void {
  current = c;
}

export function getSearchOptions(): AIConfig {
  return current;
}
