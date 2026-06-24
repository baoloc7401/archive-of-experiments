import type { PresetId } from "./types";

/**
 * Named points on the Gray-Scott parameter map. Values follow Karl Sims's map
 * (karlsims.com/rd.html) and the xmorphia survey (mrob.com/pub/comp/xmorphia),
 * read against the dA = 1.0, dB = 0.5, dt = 1.0 convention this sim uses. Each
 * sits in a distinct regime so cycling them walks the full visual range.
 */
export interface RDPreset {
  id: PresetId;
  feed: number;
  kill: number;
}

export const PRESETS: readonly RDPreset[] = [
  { id: "solitons", feed: 0.03, kill: 0.062 },
  { id: "mitosis", feed: 0.0367, kill: 0.0649 },
  { id: "spots", feed: 0.018, kill: 0.051 },
  { id: "worms", feed: 0.054, kill: 0.063 },
  { id: "maze", feed: 0.029, kill: 0.057 },
  { id: "coral", feed: 0.0545, kill: 0.062 },
  { id: "fingerprint", feed: 0.039, kill: 0.058 },
  { id: "uskate", feed: 0.062, kill: 0.0609 },
];

/** Tolerance for treating slider values as "still on" a preset. */
const EPS = 1e-4;

/** The preset whose (feed, kill) the current params sit on, or null. */
export function matchPreset(feed: number, kill: number): PresetId | null {
  for (const p of PRESETS) {
    if (Math.abs(p.feed - feed) < EPS && Math.abs(p.kill - kill) < EPS) return p.id;
  }
  return null;
}
