/**
 * The flock in structure-of-arrays form: parallel typed arrays indexed by boid.
 * Buffers are allocated once at `capacity` (= MAX_COUNT) so changing the live
 * `count` never reallocates - it just grows/shrinks the active prefix.
 */
export interface Flock {
  x: Float32Array;
  y: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  /** Faction id per boid (0-based), used when speciesCount > 1. */
  species: Uint8Array;
  count: number;
  capacity: number;
}

/** How the stage boundary is handled. */
export type EdgeMode = "wrap" | "bounce" | "avoid";

/** What a held pointer does to the flock. */
export type PointerMode = "repel" | "attract";

/** How each boid is tinted. */
export type ColorMode = "heading" | "speed" | "density";

/** Initial layout the flock is seeded into. */
export type SeedMode = "scatter" | "ring" | "grid" | "clumps" | "point";

/** What a pointer press does, by active tool. */
export type PointerTool = "push" | "obstacle" | "goal";

/** A point in canvas space (waypoint / goal). */
export interface Vec2 {
  x: number;
  y: number;
}

/** A circular obstacle the flock steers around. */
export interface Obstacle {
  x: number;
  y: number;
  r: number;
}

/** An autonomous hunter that chases the nearest boid. */
export interface Predator {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** Live pointer state shared between the canvas and the simulation. */
export interface Pointer {
  x: number;
  y: number;
  active: boolean;
}

/** Mutable, non-param world entities placed/spawned at runtime. */
export interface World {
  obstacles: Obstacle[];
  goals: Vec2[];
  goalIndex: number;
  predators: Predator[];
}

/** Tunable flocking parameters, all driven by sidebar controls. */
export interface BoidParams {
  /** How many boids share the stage. */
  count: number;
  /** Neighbor sensing radius in px. */
  radius: number;
  /** Weight of the separation rule (avoid crowding). */
  separation: number;
  /** Weight of the alignment rule (match heading). */
  alignment: number;
  /** Weight of the cohesion rule (steer to center). */
  cohesion: number;
  /** Speed cap applied to every boid each frame. */
  maxSpeed: number;
  /** Perception cone in degrees (360 = omnidirectional, no blind spot). */
  fov: number;
  /** Boundary behavior. */
  edges: EdgeMode;
  /** Held-pointer behavior (when the pointer tool is "push"). */
  pointerMode: PointerMode;
  /** Boid tint scheme (overridden by faction colour when speciesCount > 1). */
  colorMode: ColorMode;
  /** Strength of the drifting flow field (0 = off). */
  flow: number;
  /** Number of factions (1 = single flock). */
  speciesCount: number;
  /** Number of autonomous predators (0 = none). */
  predatorCount: number;
  /** Initial formation on seed/reset. */
  seedMode: SeedMode;
  /** Long-exposure "light painting": fade frames instead of clearing. */
  trails: boolean;
  /** What a pointer press does. */
  pointerTool: PointerTool;
}

/** A named bundle of parameters applied in one tap. */
export interface Preset {
  id: string;
  params: Partial<BoidParams>;
}

/** Throttled live readout pushed up from the simulation loop. */
export interface BoidSnapshot {
  count: number;
  fps: number;
  avgSpeed: number;
  /** Vicsek order parameter in [0, 1]: 0 = disordered, 1 = perfectly aligned. */
  order: number;
}
