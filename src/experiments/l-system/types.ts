/** A point in model space. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** One drawn turtle stroke: a 3D line segment plus colouring metadata. */
export interface Segment {
  ax: number;
  ay: number;
  az: number;
  bx: number;
  by: number;
  bz: number;
  /** Bracket-nesting depth at draw time (0 = trunk). Used for taper + colour. */
  depth: number;
  /** Draw order normalised to 0..1 across the whole string. */
  order: number;
}

/** The interpreted geometry plus stats, centred on its bounding box. */
export interface LModel {
  segments: Segment[];
  /** Length of the expanded string. */
  symbolCount: number;
  /** Deepest bracket nesting reached. */
  maxDepth: number;
  /** Bounding-box centre (segments are drawn relative to it). */
  center: Vec3;
  /** Bounding-box dimensions (width, height, depth) in model units. */
  size: Vec3;
  /** Bounding-sphere radius used to fit the model to the viewport. */
  radius: number;
}

export type ColorMode = "depth" | "order" | "mono";

/** A named grammar the presets pick from. */
export interface LPreset {
  id: string;
  axiom: string;
  /** One rule per line, `S=replacement` or `S -> replacement`. */
  rules: string;
  angle: number;
  iterations: number;
  /** Colour mode this preset looks best in (defaults to "depth"). */
  color?: ColorMode;
}

export interface LParams {
  axiom: string;
  /** Editable production rules, one `S=replacement` per line. */
  rules: string;
  iterations: number;
  /** Turn/pitch/roll angle in degrees (shared by all rotations). */
  angle: number;
  /** Base trunk line width in pixels. */
  thickness: number;
  /** How much thinner each successive branch level draws (0 = no taper). */
  taper: number;
  /** Depth-fog strength: how far segments fade toward the background (0..1). */
  fog: number;
  colorMode: ColorMode;
  /** Auto-spin speed in radians per second. */
  spinSpeed: number;
  /** Reveal the geometry stroke-by-stroke when it rebuilds, like a turtle drawing. */
  grow: boolean;
}

/** Live readout pushed up from the canvas (also feeds the debug report). */
export interface LSnapshot {
  symbolCount: number;
  segments: number;
  maxDepth: number;
  fps: number;
  /** Bounding-box dimensions in model units. */
  size: Vec3;
  /** Orbit-camera state at snapshot time. */
  yaw: number;
  pitch: number;
  zoom: number;
  /** Fraction of strokes currently drawn (growth progress). */
  reveal: number;
  /** Canvas size and device-pixel ratio. */
  w: number;
  h: number;
  dpr: number;
}
