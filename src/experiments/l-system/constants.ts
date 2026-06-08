import type { ColorMode, LParams, LPreset } from "./types";

/** Hard ceiling on the expanded string so a runaway grammar can't freeze the tab. */
export const MAX_STRING_LEN = 250_000;

export const MIN_ITER = 0;
export const MAX_ITER = 7;

export const MIN_ANGLE = 0;
export const MAX_ANGLE = 90;

export const MIN_THICK = 1;
export const MAX_THICK = 6;

export const MIN_TAPER = 0;
export const MAX_TAPER = 0.6;

export const MIN_FOG = 0;
export const MAX_FOG = 1;

export const MIN_SPIN = 0;
export const MAX_SPIN = 1.5;

/** Fraction of the viewport the fitted model spans (leaves a margin). */
export const FIT = 0.82;
/** Camera focal length as a multiple of the viewport, controlling perspective. */
export const FOCAL = 2.4;
/** How throttled the telemetry snapshot is, in ms. */
export const STATS_INTERVAL = 250;

export const COLOR_MODES: ColorMode[] = ["depth", "order", "mono"];

/**
 * Structurally different grammars, not re-angled trees: lush tree, trunkless
 * shrub, 3D Barnsley fern, conical conifer, coiling helix, stylized creature,
 * 6-fold snow crystal, plus the famous classics (Hilbert, Sierpinski, Koch,
 * Levy) so the gallery doubles as a tour of the well-known L-systems.
 */
export const PRESETS: LPreset[] = [
  {
    id: "tree",
    axiom: "F",
    rules: "F=FF-[&F+F+F]+[^F-F-F]",
    angle: 22.5,
    iterations: 4,
  },
  {
    // No trunk: six branches radiate from the base into a dense, low, rounded
    // mound (wider than tall) - a shrub, not a tree.
    id: "bush",
    axiom: "A",
    rules: "A=[+FA][-FA][&FA][^FA][/+FA][\\-FA]\nF=F",
    angle: 22,
    iterations: 4,
  },
  {
    // Barnsley's fractal fern, rolled out of its plane (/ ) so the famous frond
    // spreads in 3D instead of lying flat.
    id: "fern",
    axiom: "X",
    rules: "X=F+[[X]-X]/-F[-FX]+/X\nF=FF",
    angle: 25,
    iterations: 5,
  },
  {
    id: "pine",
    axiom: "T",
    rules: "T=FF[&&L]///////[&&L]///////[&&L]///T\nL=F[+L][-L]",
    angle: 18,
    iterations: 7,
  },
  {
    // A pure 3D helix: each step bends (curvature, +) and twists (torsion, /),
    // so the line coils like a spring instead of branching like a plant.
    id: "spiral",
    axiom: "A",
    rules: "A=F+/F+/F+/F+/F+/F+/F+/F+/F+/F+/F+/F+/F+/F+/F+/F+/A",
    angle: 16,
    iterations: 7,
    color: "order",
  },
  {
    // A stylized creature (NOT a literal dragon - L-systems can't draw figures):
    // a maned head (M) then a long body that undulates in alternating arcs
    // (P/Q) and corkscrews in 3D (/), with little forked legs (L) along it.
    id: "serpent",
    axiom: "MA",
    rules:
      "M=[&FF][^FF][+FF][-FF][&+F][^-F][/FF][\\FF]F\nA=PQ/A\nP=++F[&L]F\nQ=--F[^L]F\nL=F[-F]",
    angle: 18,
    iterations: 12,
    color: "order",
  },
  {
    // Six-fold snow crystal: feathery dendrite arms (in-plane +/-) that also
    // shed branchlets out of the plane (&/^), so it stays a recognisable
    // snowflake but gains real depth.
    id: "snowflake",
    axiom: "[A]+[A]+[A]+[A]+[A]+[A]",
    rules: "A=FF[+B][-B][&B][^B]FA\nB=FF[+C][-C]\nC=F[&F][^F]",
    angle: 60,
    iterations: 4,
    color: "order",
  },
  {
    id: "hilbert",
    axiom: "X",
    rules: "X=^<XF^<XFX-F^>>XFX&F+>>XFX-F>X->",
    angle: 90,
    iterations: 3,
    color: "order",
  },
  {
    // Sierpinski gasket (the classic triangle fractal). Flat by definition.
    id: "sierpinski",
    axiom: "F-G-G",
    rules: "F=F-G+F+G-F\nG=GG",
    angle: 120,
    iterations: 6,
    color: "order",
  },
  {
    // Koch island: the snowflake's square cousin. Flat by definition.
    id: "koch",
    axiom: "F-F-F-F",
    rules: "F=F-F+F+FF-F-F+F",
    angle: 90,
    iterations: 3,
    color: "order",
  },
  {
    // Levy C curve. Flat by definition.
    id: "levy",
    axiom: "F",
    rules: "F=+F--F+",
    angle: 45,
    iterations: 12,
    color: "order",
  },
];

const TREE = PRESETS[0];

export const DEFAULT_PARAMS: LParams = {
  axiom: TREE.axiom,
  rules: TREE.rules,
  iterations: TREE.iterations,
  angle: TREE.angle,
  thickness: 2.4,
  taper: 0.2,
  fog: 0.55,
  colorMode: "depth",
  spinSpeed: 0.35,
  grow: true,
};

/** Milliseconds the progressive-growth reveal takes, clamped by segment count. */
export const GROW_MIN_MS = 1400;
export const GROW_MAX_MS = 4200;
