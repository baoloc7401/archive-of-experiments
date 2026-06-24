import type { NBodyParams } from "./types";

/** Hard capacity: all SoA buffers are allocated once at this size. */
export const MAX_COUNT = 16384;

export const MIN_TIME_SCALE = 0;
export const MAX_TIME_SCALE = 4;

export const MIN_GRAVITY = 0.2;
export const MAX_GRAVITY = 3;

export const MIN_SOFTENING = 0.002;
export const MAX_SOFTENING = 0.08;

export const MIN_THETA = 0;
export const MAX_THETA = 1.2;

/** Longest trail, in sim seconds of motion (0 on the slider = off). */
export const MAX_TRAILS = 8;
/** Sim seconds between trail samples (4 substeps at the default rate). */
export const TRAIL_SAMPLE_DT = 0.064;
/** Ring-buffer capacity of trail samples per body (MAX_TRAILS / sample dt). */
export const TRAIL_K = 128;

/**
 * Fixed integration substep in sim time. With G = 1 and the scene living in a
 * ~unit sphere, a circular orbit at r = 1 around unit mass takes 2*pi sim
 * seconds (~393 substeps): small enough for stable leapfrog orbits, large
 * enough that a 60 fps frame at timeScale 1 costs ~1 substep.
 */
export const SUBSTEP = 0.016;
/** Frame-time cap: drop sim time rather than spiral when a frame stalls. */
export const MAX_SUBSTEPS_PER_FRAME = 6;

/** Merge-candidate pair buffer size per substep. */
export const MAX_MERGE_PAIRS = 256;

/** How throttled the telemetry snapshot is, in ms. */
export const STATS_INTERVAL = 250;

/** Camera: perspective field of view (radians) and orbit distance per zoom 1. */
export const CAM_FOV = 0.9;
export const CAM_DIST = 3.0;
export const CAM_NEAR = 0.05;
export const CAM_FAR = 120;
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 6;
export const PITCH_LIMIT = 1.45;

/** Auto-spin rate (rad/s) and drag-release inertia damping (per second). */
export const SPIN_RATE = 0.07;
export const INERTIA_DAMPING = 3.2;

/** Pick radius for click-to-follow, in CSS pixels. */
export const PICK_RADIUS = 28;
/** Camera-target ease toward the followed body (per second). */
export const FOLLOW_LERP = 4.5;

/** Preset-entry "scene cut": brightness/zoom settle duration, in ms. */
export const ENTRY_MS = 600;

/** Energy drift (relative) past which the stat flips to the warning tint. */
export const DRIFT_WARN = 0.05;

export const DEFAULT_PARAMS: NBodyParams = {
  preset: "collision",
  count: 4000,
  timeScale: 1,
  gravity: 1,
  softening: 0.02,
  theta: 0.7,
  integrator: "leapfrog",
  merging: false,
  trails: 2,
  colorMode: "speed",
  spin: true,
  compute: "cpu",
};

/** Whether this browser exposes the WebGPU API (gates the GPU-compute toggle). */
export function webgpuSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.gpu;
}
