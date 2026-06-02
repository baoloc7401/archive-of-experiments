import type { AcoParams, LayoutDef } from "./types";

// Distances are computed in a virtual SCALE×SCALE space so tour lengths land on
// human-friendly numbers (hundreds–thousands) regardless of the canvas size.
export const SCALE = 1000;

export const DEFAULT_PARAMS: AcoParams = {
  ants: 24,
  alpha: 1,
  beta: 4,
  rho: 0.5,
  q: 1,
  elitist: true,
};

// Slider bounds + step for each exposed parameter.
export interface ParamRange {
  key: "ants" | "alpha" | "beta" | "rho";
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
}

export const PARAM_RANGES: ParamRange[] = [
  { key: "ants", label: "ants", hint: "colony size — more ants explore more, but each iteration costs more", min: 4, max: 60, step: 1 },
  { key: "alpha", label: "α pheromone", hint: "trail influence — high α makes ants follow the crowd (exploit)", min: 0, max: 5, step: 0.1 },
  { key: "beta", label: "β distance", hint: "greed for short edges — high β acts like nearest-neighbour", min: 0, max: 8, step: 0.1 },
  { key: "rho", label: "ρ evaporation", hint: "how fast trails fade — high ρ forgets faster, avoids early lock-in", min: 0.01, max: 0.95, step: 0.01 },
];

export const LAYOUTS: LayoutDef[] = [
  { id: "random", label: "scatter", hint: "uniformly random cities" },
  { id: "circle", label: "ring", hint: "cities on a circle — optimum is the perimeter" },
  { id: "clusters", label: "clusters", hint: "a few tight clusters" },
  { id: "grid", label: "grid", hint: "jittered lattice" },
];

export const DEFAULT_LAYOUT = "random" as const;
export const DEFAULT_CITY_COUNT = 22;
export const MIN_CITIES = 5;
export const MAX_CITIES = 60;

// Animation speed slider → translates to "tour-edges advanced per frame".
export const DEFAULT_SPEED = 45;
export const MIN_SPEED = 1;
export const MAX_SPEED = 100;

// Best length must be unchanged for this many iterations to flag "converged".
export const CONVERGE_PATIENCE = 40;
