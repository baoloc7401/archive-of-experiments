import type { PresetId, RuleGenome } from "./types";
import { MAX_STATES, MINI_H, MINI_W, MIN_STATES } from "./constants";
import { createGrid, randomizeGrid, stepGrid } from "./miniSim";

// --- Bitmask helpers (birth/survive are 9-bit masks over neighbor counts 0..8) ---

export function mask(bits: number[]): number {
  let m = 0;
  for (const b of bits) m |= 1 << b;
  return m;
}

export function hasBit(m: number, i: number): boolean {
  return ((m >> i) & 1) !== 0;
}

export function toggleBit(m: number, i: number): number {
  return m ^ (1 << i);
}

// --- Preset rule library ---------------------------------------------------

export interface RulePreset {
  id: PresetId;
  birth: number;
  survive: number;
  states: number;
  /** Typical starting fill fraction for a random-soup reseed. */
  density: number;
}

/**
 * Verified rule strings, not guessed: the 2-state Life-like rules are sourced
 * from Wikipedia's "Life-like cellular automaton" article (list of named
 * rules), and the multi-state Generations rules from Golly's official
 * Generations help page (golly.sourceforge.io/Help/Algorithms/Generations.html,
 * notation "survive/birth/states" there - stored here as birth/survive/states
 * to match our own field order, not Golly's string order). Frogs is 3 states
 * (Golly: "12/34/3"), not 5 - a common misremembering worth flagging since it
 * was corrected during design.
 */
export const PRESETS: readonly RulePreset[] = [
  { id: "conway", birth: mask([3]), survive: mask([2, 3]), states: 2, density: 0.35 },
  { id: "highlife", birth: mask([3, 6]), survive: mask([2, 3]), states: 2, density: 0.35 },
  { id: "seeds", birth: mask([2]), survive: mask([]), states: 2, density: 0.1 },
  {
    id: "daynight",
    birth: mask([3, 6, 7, 8]),
    survive: mask([3, 4, 6, 7, 8]),
    states: 2,
    density: 0.5,
  },
  { id: "replicator", birth: mask([1, 3, 5, 7]), survive: mask([1, 3, 5, 7]), states: 2, density: 0.15 },
  { id: "diamoeba", birth: mask([3, 5, 6, 7, 8]), survive: mask([5, 6, 7, 8]), states: 2, density: 0.48 },
  { id: "morley", birth: mask([3, 6, 8]), survive: mask([2, 4, 5]), states: 2, density: 0.35 },
  {
    id: "lifewithoutdeath",
    birth: mask([3]),
    survive: mask([0, 1, 2, 3, 4, 5, 6, 7, 8]),
    states: 2,
    density: 0.12,
  },
  { id: "life34", birth: mask([3, 4]), survive: mask([3, 4]), states: 2, density: 0.35 },
  { id: "twoxtwo", birth: mask([3, 6]), survive: mask([1, 2, 5]), states: 2, density: 0.35 },
  { id: "anneal", birth: mask([4, 6, 7, 8]), survive: mask([3, 5, 6, 7, 8]), states: 2, density: 0.5 },
  { id: "briansbrain", birth: mask([2]), survive: mask([]), states: 3, density: 0.25 },
  { id: "starwars", birth: mask([2]), survive: mask([3, 4, 5]), states: 4, density: 0.3 },
  { id: "frogs", birth: mask([3, 4]), survive: mask([1, 2]), states: 3, density: 0.3 },
];

/** The preset whose birth/survive/states exactly match the current genome, or null. */
export function matchPreset(genome: RuleGenome): PresetId | null {
  for (const p of PRESETS) {
    if (p.birth === genome.birth && p.survive === genome.survive && p.states === genome.states) {
      return p.id;
    }
  }
  return null;
}

function bitsToDigits(m: number): string {
  const digits: number[] = [];
  for (let i = 0; i <= 8; i++) if (hasBit(m, i)) digits.push(i);
  return digits.join("");
}

/**
 * Our own shorthand for a genome - "B{digits}/S{digits}" plus a "/G{states}"
 * suffix when states>2. Deliberately NOT Golly's "survive/birth/states"
 * string order (would read confusingly next to our birth-first field order).
 */
export function ruleToString(genome: RuleGenome): string {
  const base = `B${bitsToDigits(genome.birth)}/S${bitsToDigits(genome.survive)}`;
  return genome.states > 2 ? `${base}/G${genome.states}` : base;
}

// --- Seeded PRNG -------------------------------------------------------------

/** Small seeded PRNG (mulberry32) so breeding runs are reproducible per litter. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Breeding ----------------------------------------------------------------

const TOTAL_BITS = 9;

/** Flip 1-2 random bits across birth+survive, with a small chance to nudge `states`. */
export function mutateRule(genome: RuleGenome, rng: () => number): RuleGenome {
  let { birth, survive, states } = genome;
  const flips = 1 + (rng() < 0.5 ? 0 : 1);
  for (let i = 0; i < flips; i++) {
    const bit = Math.floor(rng() * TOTAL_BITS);
    if (rng() < 0.5) birth = toggleBit(birth, bit);
    else survive = toggleBit(survive, bit);
  }
  if (rng() < 0.25) {
    const delta = rng() < 0.5 ? -1 : 1;
    states = Math.min(MAX_STATES, Math.max(MIN_STATES, states + delta));
  }
  return { birth, survive, states };
}

/** Fixed soup density used only for scoring/thumbnail runs, independent of the user's density slider. */
const SCORE_DENSITY = 0.3;
const SCORE_STEPS = 60;

/**
 * Runs a short CPU simulation from a fixed-density random soup and scores it
 * by how much the population keeps moving in the back half of the run.
 * Rejects (-1) a genome that's extinct or saturated (>92% alive) by the end,
 * so obviously boring mutants get filtered out of the breeding lab. Always
 * simulates with wrap=true and at MINI_W x MINI_H (the same size the
 * thumbnail displays), regardless of the main canvas's boundary setting - a
 * 40x26 grid in void mode would starve edge-crossing patterns unfairly and
 * bias selection against otherwise-interesting rules.
 */
export function scoreGenome(genome: RuleGenome, rng: () => number): number {
  const a = createGrid(MINI_W, MINI_H);
  const b = createGrid(MINI_W, MINI_H);
  randomizeGrid(a, MINI_W, MINI_H, SCORE_DENSITY, rng);
  let grid = a;
  let next = b;
  const n = MINI_W * MINI_H;
  const pops: number[] = [];
  for (let step = 0; step < SCORE_STEPS; step++) {
    stepGrid(grid, next, MINI_W, MINI_H, genome, true);
    const tmp = grid;
    grid = next;
    next = tmp;
    let alive = 0;
    for (let i = 0; i < n; i++) if (grid[i] === 1) alive++;
    pops.push(alive / n);
  }
  const last = pops[pops.length - 1];
  if (last === 0 || last > 0.92) return -1;
  const tail = pops.slice(Math.floor(SCORE_STEPS / 2));
  const mean = tail.reduce((s, v) => s + v, 0) / tail.length;
  const variance = tail.reduce((s, v) => s + (v - mean) ** 2, 0) / tail.length;
  return variance;
}

const MUTATION_ATTEMPTS = 6;
/** A candidate is "decent enough" to stop trying further mutations early. */
const GOOD_ENOUGH_SCORE = 0.01;

/**
 * Breeds `count` offspring of `base`: each tries up to MUTATION_ATTEMPTS
 * mutations, keeping the best-scoring one (falling back to the last mutation
 * tried if every attempt scored -1, so a litter is never empty).
 */
export function breedLitter(base: RuleGenome, count: number, rng: () => number): RuleGenome[] {
  const out: RuleGenome[] = [];
  for (let i = 0; i < count; i++) {
    let best: RuleGenome | null = null;
    let bestScore = -Infinity;
    for (let attempt = 0; attempt < MUTATION_ATTEMPTS; attempt++) {
      const candidate = mutateRule(base, rng);
      const score = scoreGenome(candidate, rng);
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
      if (score > GOOD_ENOUGH_SCORE) break;
    }
    out.push(best ?? mutateRule(base, rng));
  }
  return out;
}
