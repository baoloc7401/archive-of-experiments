import type { Config, Side } from "../types";
import type { Actor } from "./cast";
import { type Rng, pick } from "./rng";

/** Run statistics accumulated while replaying the story, so the framing beats
 *  (intro/win/loss) can react to what actually happened, not just templates. */
export interface StoryStats {
  /** total committed crossings */
  crossings: number;
  /** highest tension reached (0..100) */
  maxTension: number;
  /** trust between the groups at the end (0..100) */
  finalTrust: number;
  /** crossings that left a bank one body from disaster (c === m) */
  nearMisses: number;
  /** crossings where missionaries and cannibals shared the boat */
  sharedTrips: number;
  /** return trips (boat coming back for more) */
  returnTrips: number;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

export function listNames(actors: Actor[]): string {
  const ns = actors.map((a) => a.name);
  if (ns.length === 0) return "";
  if (ns.length === 1) return ns[0];
  if (ns.length === 2) return `${ns[0]} and ${ns[1]}`;
  return `${ns.slice(0, -1).join(", ")} and ${ns[ns.length - 1]}`;
}

const CROSS_VERBS = [
  "dug the oars in and hauled across",
  "cut across the black water",
  "drove the boat over",
  "knifed across the current",
  "rowed hard",
  "pushed off and crossed",
];
// neutral motion verbs — the NEAR_DIRS carry the "back", so they never collide
const RETURN_VERBS = ["rowed", "hauled the boat", "drove the boat", "knifed", "dragged the boat"];
const FAR_DIRS = [
  "to the far shore",
  "to the waiting dark of the far bank",
  "to the opposite bank",
  "for the other side",
];
const NEAR_DIRS = [
  "back to the near shore",
  "back to the restless others",
  "back across the black water",
];

const FIRST_CLAUSES = [
  "the first to gamble on the water",
  "while the rest held their breath on the mud",
  "testing whether the river would let them live",
];
const TRUST_CLAUSES = [
  "a knife-edge truce balanced on the thwart between them",
  "predator and prey jammed hull to hull, neither blinking",
  "sworn enemies crammed into one trembling boat",
];
const DIRE_CLAUSES = [
  "while on the bank the cannibals counted heads and grinned",
  "the missionaries left behind white-knuckling their crosses",
  "every shadow on the shore leaning hungrily inward",
];
const TENSE_CLAUSES = [
  "as the numbers tilted toward murder",
  "hands tightening on oar and bone",
  "the balance one body away from blood",
];
const UNEASY_CLAUSES = ["counting bodies under their breath", "with one eye on the tree line"];
const CALM_CLAUSES = [
  "the river briefly merciful",
  "no teeth bared — for now",
  "the only sound the drip of the oars",
];

function tensionClause(rng: Rng, tension: number): string {
  if (tension >= 70) return pick(rng, DIRE_CLAUSES);
  if (tension >= 45) return pick(rng, TENSE_CLAUSES);
  if (tension >= 25) return pick(rng, UNEASY_CLAUSES);
  return pick(rng, CALM_CLAUSES);
}

function subject(crossersM: Actor[], crossersC: Actor[], rng: Rng): string {
  const m = listNames(crossersM);
  const c = listNames(crossersC);
  if (crossersM.length && crossersC.length) return `${m} and ${c}`;
  if (crossersM.length) return m;
  // cannibals only — sometimes name the faction for menace
  const tag = crossersC.length > 1 ? "the cannibals " : "the cannibal ";
  return pick(rng, [c, `${tag}${c}`]);
}

export interface CrossCtx {
  crossersM: Actor[];
  crossersC: Actor[];
  dir: Side;
  isFirst: boolean;
  tension: number;
  /** missionaries and cannibals shared the boat this trip */
  shared: boolean;
}

export function crossText(rng: Rng, ctx: CrossCtx): string {
  const isReturn = ctx.dir === "R";
  const total = ctx.crossersM.length + ctx.crossersC.length;

  // a lone rower heading back to fetch the rest gets its own beat sometimes
  if (isReturn && total === 1 && rng() < 0.5) {
    const who = listNames([...ctx.crossersM, ...ctx.crossersC]);
    return `${cap(who)} ${pick(rng, ["rowed back alone", "came back across the water", "doubled back, jaw set"])} ${pick(
      rng,
      ["to fetch the others", "to drag the next one across", "for another passenger"]
    )}.`;
  }

  const subj = subject(ctx.crossersM, ctx.crossersC, rng);
  const verb = pick(rng, isReturn ? RETURN_VERBS : CROSS_VERBS);
  const dir = pick(rng, isReturn ? NEAR_DIRS : FAR_DIRS);

  let clause: string;
  if (ctx.isFirst) clause = pick(rng, FIRST_CLAUSES);
  else if (ctx.shared && rng() < 0.6) clause = pick(rng, TRUST_CLAUSES);
  else clause = tensionClause(rng, ctx.tension);

  return `${cap(subj)} ${verb} ${dir}, ${clause}.`;
}

export function introText(rng: Rng, cfg: Config, missionaries: Actor[], cannibals: Actor[]): string {
  const opener = pick(rng, [
    "Smoke curls from cookfires on the far bank; on the near one, the missionaries try not to wonder what's for dinner.",
    "Dusk bleeds across the river, and a problem of teeth and arithmetic waits on the mud.",
    "One boat. Black water. And a single rule written in survival.",
    "The current runs slow and dark, and on its near bank an uneasy congregation gathers.",
  ]);

  const cannibalAdj = pick(rng, ["hungry", "restless", "sharp-toothed", "lean and watchful"]);

  // the boat clause flexes with capacity — a cramped two-seater reads very
  // differently from a roomy four
  const boatClause =
    cfg.k <= 2
      ? pick(rng, [
          "A single cramped boat takes only two across at a time,",
          "One boat, two seats, and a long night of ferrying ahead,",
        ])
      : cfg.k === 3
        ? pick(rng, ["The boat holds three, no more,", "Three to a hull, and not one body over,"])
        : pick(rng, [
            "A broad boat swallows four at a stroke,",
            "The boat is almost generous — four seats —",
          ]);

  // the standing balance of forces sets the dread level before a single oar dips
  const balanceClause =
    cfg.c > cfg.m
      ? pick(rng, [
          `And the cannibals already hold the numbers, ${cfg.c} to ${cfg.m} — this was a doomed idea from the first head-count.`,
          `Worse still: the cannibals outnumber the faithful ${cfg.c} to ${cfg.m} before a single oar dips.`,
        ])
      : cfg.c === cfg.m
        ? pick(rng, [
            "Evenly matched — which, on this river, is the most dangerous number of all.",
            "Even numbers, even odds, and no margin for a single careless crossing.",
          ])
        : pick(rng, [
            `The faithful hold the edge, ${cfg.m} to ${cfg.c} — but the boat will squander it fast.`,
            "For now the missionaries have the count; the river will test how long that lasts.",
          ]);

  const hook = pick(rng, [
    "The far bank waits.",
    "The water is black and patient.",
    "Nobody has dared touch the boat yet.",
  ]);

  return (
    `${opener} ${cfg.m} ${plural(cfg.m, "missionary", "missionaries")} — ${listNames(missionaries)} — ` +
    `share the bank with ${cfg.c} ${cannibalAdj} ${plural(cfg.c, "cannibal", "cannibals")} — ${listNames(cannibals)}. ` +
    `${boatClause} and the law of every shore is brutal and simple: let the cannibals outnumber the missionaries ` +
    `anywhere a missionary stands, and someone becomes supper. ${balanceClause} ${hook}`
  );
}

export function winText(rng: Rng, stats: StoryStats): string {
  const { crossings, finalTrust, maxTension, nearMisses } = stats;

  // 1) the result, scaled by how grueling the haul was
  const result =
    crossings <= 7
      ? pick(rng, [
          `It was over almost before it began — ${crossings} crossings, clean and merciless.`,
          `${crossings} crossings, not an oar-stroke wasted, and the far shore was theirs.`,
        ])
      : crossings <= 13
        ? pick(rng, [
            `${crossings} white-knuckle crossings, and not one missionary ended up in a cookpot.`,
            `${crossings} crossings of held breath and counted heads, and somehow every soul made it over.`,
          ])
        : pick(rng, [
            `${crossings} interminable crossings later, the survivors dragged themselves onto the far mud.`,
            `After ${crossings} grinding crossings — back and forth, back and forth — the last of them was finally across.`,
          ]);

  // 2) the relationship the ferrying forged (or didn't)
  const bond =
    finalTrust >= 55
      ? pick(rng, [
          "Somewhere out on the black water, hunger had bent to patience; enemies who'd shared a hull too many times to start eating each other now.",
          "Predator and prey had ridden that boat so often the hatred had worn smooth.",
        ])
      : pick(rng, [
          "No friendships were made — only the cold arithmetic of who sat where, and it had held.",
          "The cannibals beached the boat, ran their tongues over their teeth, and reluctantly let the matter drop.",
        ]);

  // 3) the near-miss flourish, dynamic on the actual count of close calls
  const peril =
    nearMisses === 1
      ? "Once the count hung a single body from slaughter — and held."
      : nearMisses >= 2
        ? `${cap(numberWord(nearMisses))} times the count hung a single body from slaughter — and held each time.`
        : maxTension < 30
          ? "Not one crossing came close to disaster; a rare, bloodless run."
          : "The numbers wavered but never broke.";

  const closer = pick(rng, [
    "The boat drifted empty, and for once nobody was screaming.",
    "The cookfires on the far bank would go hungry tonight.",
    "A bloodless miracle, balanced to the last body on the mud.",
  ]);

  return `${result} ${bond} ${peril} ${closer}`;
}

export function lossText(
  rng: Rng,
  victims: Actor[],
  predators: Actor[],
  side: Side,
  stats: StoryStats
): string {
  const where = side === "L" ? "near bank" : "far bank";
  const ratio = `${predators.length} to ${victims.length}`;
  const n = stats.crossings;

  // 1) *when* it fell apart — first move vs. early vs. agonizingly late
  const when =
    n <= 1
      ? pick(rng, [
          "It fell apart on the very first crossing.",
          "One move in. One. And it was already over.",
        ])
      : n <= 3
        ? pick(rng, [
            `Barely begun — ${n} crossings — and the plan was already red ruin.`,
            `${cap(numberWord(n))} crossings, and the whole scheme came apart at the seams.`,
          ])
        : pick(rng, [
            `${cap(numberWord(n))} crossings in — so close you could smell the far bank — and then the count betrayed them.`,
            `After ${n} careful crossings, a single slip undid every last one.`,
          ]);

  // 2) the kill, with the exact ratio that doomed them
  const kill = pick(rng, [
    `On the ${where} the arithmetic tipped, ${ratio}: ${listNames(predators)} were on ${listNames(victims)} before the boat had even cleared the shallows.`,
    `${ratio} on the ${where}. ${listNames(predators)} closed in, and ${listNames(victims)} had nowhere left to run.`,
    `${listNames(predators)} fell on ${listNames(victims)} in a thrash of reeds, firelight, and teeth — ${ratio} on the ${where}, exactly what the rule forbade.`,
  ]);

  // 3) an optional "the math finally caught up" note if there'd been close calls
  const debt =
    stats.nearMisses >= 2
      ? pick(rng, [
          " After so many narrow counts, the river finally collected its debt.",
          " The arithmetic had been circling all night; this time it landed.",
        ])
      : "";

  const ender = pick(rng, [
    "The screaming was mercifully brief.",
    "By the time the boat touched mud, there was nothing left to ferry.",
    "The river took what the cannibals didn't.",
    "Someone, somewhere, should have done the math.",
  ]);

  return `${when} ${kill}${debt} ${ender}`;
}

const NUMBER_WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
];

function numberWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}
