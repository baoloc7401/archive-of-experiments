// i18n note: the narrative this engine emits (and the strings in ./templates)
// is intentionally English and is NOT subject to translation. Generative,
// kaomoji-laced flavour prose is the engine's nature - it's authored as English
// voice, not UI chrome, and is exempt like the debug-bridge text. Keep it as-is.
import type { Config, Move, Side, Status } from "../types";
import { other } from "../solver";
import { type Actor, buildRoster, chooseCrossers } from "./cast";
import { mulberry32 } from "./rng";
import { crossText, introText, lossText, type StoryStats, winText } from "./templates";

export type BeatKind = "intro" | "cross" | "win" | "loss";

export interface StoryBeat {
  id: number;
  kind: BeatKind;
  /** crossing number for `cross` beats, else null */
  n: number | null;
  text: string;
  /** story tension after this beat, 0..100 - used to tint the UI */
  tension: number;
}

const START_TENSION = 22;
const START_TRUST = 16;

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}

/**
 * Layer 2 + 3: replay the solved/played moves over a named cast, evolve story
 * variables (tension, trust) from how precarious each resulting bank is, and
 * render each transition as prose. Pure and deterministic in (cfg, moves,
 * status, seed) - "retell" just changes the seed.
 */
export function generateStory(
  cfg: Config,
  moves: Move[],
  status: Status,
  seed: number
): StoryBeat[] {
  const rng = mulberry32((seed * 2654435761) >>> 0);
  const roster = buildRoster(cfg, rng);

  let leftM = [...roster.missionaries];
  let leftC = [...roster.cannibals];
  let rightM: Actor[] = [];
  let rightC: Actor[] = [];
  let boat: Side = "L";
  let tension = START_TENSION;
  let trust = START_TRUST;

  const stats: StoryStats = {
    crossings: moves.length,
    maxTension: tension,
    finalTrust: trust,
    nearMisses: 0,
    sharedTrips: 0,
    returnTrips: 0,
  };

  const beats: StoryBeat[] = [];
  let id = 0;

  beats.push({
    id: id++,
    kind: "intro",
    n: null,
    text: introText(rng, cfg, roster.missionaries, roster.cannibals),
    tension,
  });

  moves.forEach((mv, i) => {
    const fromM = boat === "L" ? leftM : rightM;
    const fromC = boat === "L" ? leftC : rightC;
    const crossersM = chooseCrossers(rng, fromM, mv.m);
    const crossersC = chooseCrossers(rng, fromC, mv.c);
    for (const a of [...crossersM, ...crossersC]) a.crossed++;

    const idsM = new Set(crossersM.map((a) => a.id));
    const idsC = new Set(crossersC.map((a) => a.id));
    if (boat === "L") {
      leftM = leftM.filter((a) => !idsM.has(a.id));
      leftC = leftC.filter((a) => !idsC.has(a.id));
      rightM = [...rightM, ...crossersM];
      rightC = [...rightC, ...crossersC];
    } else {
      rightM = rightM.filter((a) => !idsM.has(a.id));
      rightC = rightC.filter((a) => !idsC.has(a.id));
      leftM = [...leftM, ...crossersM];
      leftC = [...leftC, ...crossersC];
    }
    boat = other(boat);

    // story variables react to how close each bank now sits to disaster
    let precarious = false;
    for (const [m, c] of [
      [leftM.length, leftC.length],
      [rightM.length, rightC.length],
    ]) {
      if (m === 0) continue; // an all-cannibal bank threatens no one
      if (c === m) {
        tension += 14;
        trust -= 5;
        precarious = true;
      } else if (c === m - 1) {
        tension += 6;
      } else {
        tension -= 7;
        trust += 2;
      }
    }
    const shared = mv.m > 0 && mv.c > 0;
    if (shared) trust += 8;
    tension = clamp(tension);
    trust = clamp(trust);

    // accumulate run stats for the dynamic framing beats
    if (precarious) stats.nearMisses += 1;
    if (shared) stats.sharedTrips += 1;
    if (mv.from === "R") stats.returnTrips += 1;
    stats.maxTension = Math.max(stats.maxTension, tension);
    stats.finalTrust = trust;

    beats.push({
      id: id++,
      kind: "cross",
      n: i + 1,
      text: crossText(rng, {
        crossersM,
        crossersC,
        dir: mv.from,
        isFirst: i === 0,
        tension,
        shared,
      }),
      tension,
    });
  });

  if (status === "won") {
    beats.push({ id: id++, kind: "win", n: null, text: winText(rng, stats), tension });
  } else if (status === "lost") {
    // the doomed bank: missionaries present AND outnumbered by cannibals
    const leftDoomed = leftM.length > 0 && leftC.length > leftM.length;
    const rightDoomed = rightM.length > 0 && rightC.length > rightM.length;
    if (leftDoomed || rightDoomed) {
      const side: Side = leftDoomed ? "L" : "R";
      const victims = leftDoomed ? leftM : rightM;
      const predators = leftDoomed ? leftC : rightC;
      beats.push({
        id: id++,
        kind: "loss",
        n: null,
        text: lossText(rng, victims, predators, side, stats),
        tension: 100,
      });
    }
  }

  return beats;
}
