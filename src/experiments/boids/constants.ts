import type { BoidParams, Preset } from "./types";

export const MIN_COUNT = 10;
export const MAX_COUNT = 2000;
export const MIN_RADIUS = 20;
export const MAX_RADIUS = 160;
export const MIN_WEIGHT = 0;
export const MAX_WEIGHT = 3;
export const MIN_SPEED = 1;
export const MAX_SPEED = 8;
export const MIN_FOV = 60;
export const MAX_FOV = 360;
export const MIN_FLOW = 0;
export const MAX_FLOW = 2;
export const MIN_SPECIES = 1;
export const MAX_SPECIES = 4;
export const MIN_PREDATORS = 0;
export const MAX_PREDATORS = 5;

export const DEFAULT_PARAMS: BoidParams = {
  count: 140,
  radius: 64,
  separation: 1.6,
  alignment: 1,
  cohesion: 1,
  maxSpeed: 3.4,
  fov: 300,
  edges: "wrap",
  pointerMode: "repel",
  colorMode: "heading",
  flow: 0,
  speciesCount: 1,
  predatorCount: 0,
  seedMode: "scatter",
  trails: false,
  pointerTool: "push",
};

// Behavior presets: each sets the rule-shaping fields in one tap (count + the
// six rule params + fov). Edge mode and pointer mode are left to the user.
export const PRESETS: Preset[] = [
  {
    id: "murmuration",
    params: { count: 220, radius: 70, separation: 1.1, alignment: 1.8, cohesion: 1.4, maxSpeed: 3.6, fov: 300 },
  },
  {
    id: "schooling",
    params: { count: 140, radius: 60, separation: 1.6, alignment: 1, cohesion: 1, maxSpeed: 3, fov: 260 },
  },
  {
    id: "swarm",
    params: { count: 180, radius: 50, separation: 2.4, alignment: 0.4, cohesion: 0.5, maxSpeed: 4.4, fov: 360 },
  },
  {
    id: "lockstep",
    params: { count: 160, radius: 90, separation: 0.8, alignment: 3, cohesion: 0.8, maxSpeed: 3.2, fov: 200 },
  },
  {
    id: "vortex",
    params: { count: 200, radius: 80, separation: 1.8, alignment: 1.6, cohesion: 2, maxSpeed: 3.8, fov: 240 },
  },
  {
    id: "scatter",
    params: { count: 60, radius: 70, separation: 2.8, alignment: 0.2, cohesion: 0.2, maxSpeed: 2.6, fov: 360 },
  },
  {
    id: "stampede",
    params: { count: 150, radius: 75, separation: 1.2, alignment: 2.6, cohesion: 1.2, maxSpeed: 5, fov: 220 },
  },
  {
    id: "huddle",
    params: { count: 120, radius: 110, separation: 0.6, alignment: 0.6, cohesion: 2.6, maxSpeed: 2, fov: 320 },
  },
];

// Shared math constants.
export const TWO_PI = Math.PI * 2;
export const DEG = Math.PI / 180;
export const RAD_TO_DEG = 180 / Math.PI;

export const MAX_FORCE = 0.06; // clamp on each rule's steering acceleration
export const SEP_RADIUS_FACTOR = 0.55; // separation only acts within this fraction of the neighbor radius
export const MIN_SPEED_FRAC = 0.2; // velocity floor as a fraction of maxSpeed, so boids never stall
export const HUE_BUCKETS = 24; // heading-colour is quantized into this many hues for batched drawing
export const BOID_SIZE = 6; // triangle half-length in px
export const TAIL = 5; // motion-tail length as a multiple of velocity (decorative)
export const STATS_INTERVAL = 250; // ms between telemetry snapshots
export const ORDER_HISTORY_MAX = 120; // points retained in the order-parameter sparkline

export const GRID_MIN_CELLS = 3; // below a 3x3 grid the wrapped 3x3 block self-overlaps, so fall back to brute force
export const FOCUS_PICK_RADIUS = 26; // px: how near the cursor must be to pin a boid for the rule overlay
export const ARROW_GAIN = 600; // scales the tiny steering forces up to a visible arrow length

export const EDGE_MARGIN = 60; // px band near the wall where "avoid" steering ramps in
export const EDGE_AVOID_WEIGHT = 2.4; // weight of the turn-from-wall steer in "avoid" mode
export const PREDATOR_RADIUS = 130; // px reach of the held-pointer force
export const PREDATOR_WEIGHT = 4; // weight of the pointer flee/seek steer at point-blank range

// Flow field (#13): a drifting pseudo-noise current the flock rides.
export const FLOW_SCALE = 0.0042; // spatial frequency of the field
export const FLOW_DRIFT = 0.18; // how fast the field evolves (per second)

// Obstacles (#14)
export const OBSTACLE_RADIUS = 34; // px radius of a dropped obstacle
export const OBSTACLE_MARGIN = 26; // look-ahead band outside the disc where avoidance ramps in
export const OBSTACLE_WEIGHT = 3.5; // weight of the steer-away-from-obstacle force

// Goals / waypoints (#17)
export const GOAL_WEIGHT = 0.8; // weight of the migrate-to-goal steer
export const GOAL_REACH = 40; // px: flock-center distance that advances to the next waypoint

// Autonomous predators (#16)
export const HAWK_SPEED_FACTOR = 1.12; // predators are a touch faster than boids
export const HAWK_FLEE_RADIUS = 95; // px within which boids flee a predator
export const HAWK_FLEE_WEIGHT = 3; // weight of the predator-flee steer
export const HAWK_CATCH = 12; // px: a boid this close to a predator respawns at an edge
export const HAWK_TURN = 0.12; // predator steering force per frame

// Density colouring (#21)
export const DENSITY_MAX = 22; // neighbor count mapped to the hot end of the ramp

// Species (#15): faction hue spacing handled in the canvas.
export const SPECIES_LIGHT_DARK = 62;
export const SPECIES_LIGHT_LIGHT = 45;
