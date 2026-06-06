import type { AIConfig, SkillLevel } from '../types';

export const SKILL_LEVELS: readonly SkillLevel[] = [
  'beginner', 'casual', 'intermediate', 'advanced', 'master',
];

// Piece glyph per tier - ascending material value mirrors ascending strength.
// Used purely for UI presentation in the skill picker.
export const SKILL_PIECES: Record<SkillLevel, string> = {
  beginner: '♙',
  casual: '♘',
  intermediate: '♗',
  advanced: '♖',
  master: '♕',
};

export const DEFAULT_SKILL: SkillLevel = 'advanced';

export const SKILL_PRESETS: Record<SkillLevel, AIConfig> = {
  beginner: {
    depth: 1,
    qdepth: 0,
    evalNoiseCp: 250,
    topN: 5,
    topNWeights: [35, 25, 20, 10, 10],
    useBook: false,
    eval: { mobility: false, kingSafety: false, pawnStructure: false, mopUp: false },
  },
  casual: {
    depth: 2,
    qdepth: 1,
    evalNoiseCp: 80,
    topN: 3,
    topNWeights: [60, 25, 15],
    useBook: false,
    eval: { mobility: false, kingSafety: true, pawnStructure: false, mopUp: false },
  },
  intermediate: {
    depth: 3,
    qdepth: 2,
    evalNoiseCp: 25,
    topN: 2,
    topNWeights: [80, 20],
    useBook: true,
    eval: { mobility: true, kingSafety: true, pawnStructure: true, mopUp: false },
  },
  advanced: {
    depth: 5,
    qdepth: 4,
    evalNoiseCp: 5,
    topN: 2,
    topNWeights: [97, 3],
    useBook: true,
    eval: { mobility: true, kingSafety: true, pawnStructure: true, mopUp: true },
  },
  master: {
    depth: 7,
    qdepth: 4,
    evalNoiseCp: 0,
    topN: 1,
    topNWeights: [100],
    useBook: true,
    eval: { mobility: true, kingSafety: true, pawnStructure: true, mopUp: true },
  },
};

// Fixed config for move grading: deterministic, no book/noise/variance, shallow
// enough to keep grading responsive on every move regardless of player skill.
export const GRADER_CONFIG: AIConfig = {
  depth: 2,
  qdepth: 4,
  evalNoiseCp: 0,
  topN: 1,
  topNWeights: [100],
  useBook: false,
  eval: { mobility: true, kingSafety: true, pawnStructure: true, mopUp: true },
};
