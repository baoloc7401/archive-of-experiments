import type { Config } from "../types";
import { type Rng, shuffle } from "./rng";

/** A named character. `crossed` is mutated as the story simulates trips, so the
 *  narrator can favour whoever has rested and add "once more" flavour. */
export interface Actor {
  id: string;
  /** how they're referred to in prose, e.g. "Sister Mara" or "Kor" */
  name: string;
  kind: "m" | "c";
  crossed: number;
}

/** Up to MAX_PEOPLE (5) of each; names are shuffled by seed so a retell can
 *  recast while keeping continuity within a single telling. */
const MISSIONARY_NAMES = [
  "Brother Aldric",
  "Sister Mara",
  "Brother Cassian",
  "Sister Edith",
  "Brother Tobias",
] as const;

const CANNIBAL_NAMES = ["Kor", "Hask", "Vok", "Ssira", "Dax"] as const;

export interface Roster {
  missionaries: Actor[];
  cannibals: Actor[];
}

export function buildRoster(cfg: Config, rng: Rng): Roster {
  const mNames = shuffle(rng, MISSIONARY_NAMES).slice(0, cfg.m);
  const cNames = shuffle(rng, CANNIBAL_NAMES).slice(0, cfg.c);
  return {
    missionaries: mNames.map((name, i) => ({ id: `m${i}`, name, kind: "m" as const, crossed: 0 })),
    cannibals: cNames.map((name, i) => ({ id: `c${i}`, name, kind: "c" as const, crossed: 0 })),
  };
}

/** Pick `k` crossers, favouring whoever has crossed least (random tie-break). */
export function chooseCrossers(rng: Rng, pool: Actor[], k: number): Actor[] {
  if (k <= 0) return [];
  const ranked = [...pool].sort((a, b) => a.crossed - b.crossed || rng() - 0.5);
  return ranked.slice(0, k);
}
