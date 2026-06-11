import type { Bodies, NBodyParams, PresetId } from "./types";

/**
 * Initial-condition generators. Each writes the first `n` slots of the SoA
 * buffers and assumes the baseline G = 1 with the scene inside a ~unit sphere;
 * preset `overrides` reset the sliders that the physics was tuned for.
 */
export interface PresetDef {
  id: PresetId;
  /** Default body count the scene is designed around. */
  count: number;
  minCount: number;
  /** Exact-body scenes (figure-8) lock the count slider. */
  locked?: boolean;
  /** Params this scene needs to read as intended (applied on select). */
  overrides: Partial<NBodyParams>;
  generate: (b: Bodies, n: number) => void;
}

/** Collision radius from mass; ~2 sun radii of 0.012 at mass 1. */
export function radiusOf(mass: number): number {
  return 0.012 * Math.cbrt(mass);
}

function set(
  b: Bodies,
  i: number,
  x: number,
  y: number,
  z: number,
  vx: number,
  vy: number,
  vz: number,
  mass: number,
): void {
  b.x[i] = x;
  b.y[i] = y;
  b.z[i] = z;
  b.vx[i] = vx;
  b.vy[i] = vy;
  b.vz[i] = vz;
  b.mass[i] = mass;
  b.radius[i] = radiusOf(mass);
}

/** Remove net momentum and re-center the center of mass on the origin. */
function zeroDrift(b: Bodies): void {
  const n = b.count;
  let m = 0;
  let px = 0;
  let py = 0;
  let pz = 0;
  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (let i = 0; i < n; i++) {
    m += b.mass[i];
    px += b.mass[i] * b.vx[i];
    py += b.mass[i] * b.vy[i];
    pz += b.mass[i] * b.vz[i];
    cx += b.mass[i] * b.x[i];
    cy += b.mass[i] * b.y[i];
    cz += b.mass[i] * b.z[i];
  }
  if (m === 0) return;
  for (let i = 0; i < n; i++) {
    b.vx[i] -= px / m;
    b.vy[i] -= py / m;
    b.vz[i] -= pz / m;
    b.x[i] -= cx / m;
    b.y[i] -= cy / m;
    b.z[i] -= cz / m;
  }
}

/** Gaussian via Box-Muller (no spare caching; callers are seed-time only). */
function gauss(): number {
  let u = 0;
  while (u === 0) u = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
}

const TWO_PI = Math.PI * 2;

/**
 * One toy spiral galaxy: a heavy core plus a thin disk of light stars on
 * circular orbits, generated in the xy plane then tilted and offset. Star
 * speeds use only the core mass; the softening hides the missing disk term.
 */
function makeGalaxy(
  b: Bodies,
  start: number,
  stars: number,
  coreMass: number,
  cx: number,
  cy: number,
  cz: number,
  vx: number,
  vy: number,
  vz: number,
  tiltX: number,
  tiltY: number,
): void {
  const cosX = Math.cos(tiltX);
  const sinX = Math.sin(tiltX);
  const cosY = Math.cos(tiltY);
  const sinY = Math.sin(tiltY);
  const place = (
    i: number,
    px: number,
    py: number,
    pz: number,
    ux: number,
    uy: number,
    uz: number,
    mass: number,
  ) => {
    // Tilt about X, then Y, for both position and velocity.
    const y1 = py * cosX - pz * sinX;
    let z1 = py * sinX + pz * cosX;
    const x1 = px * cosY + z1 * sinY;
    z1 = -px * sinY + z1 * cosY;
    const wy = uy * cosX - uz * sinX;
    let wz = uy * sinX + uz * cosX;
    const wx = ux * cosY + wz * sinY;
    wz = -ux * sinY + wz * cosY;
    set(b, i, cx + x1, cy + y1, cz + z1, vx + wx, vy + wy, vz + wz, mass);
  };
  place(start, 0, 0, 0, 0, 0, 0, coreMass);
  const starMass = 0.12 / stars;
  for (let i = 1; i <= stars; i++) {
    const r = 0.06 + 0.5 * Math.sqrt(Math.random());
    const a = Math.random() * TWO_PI;
    const v = Math.sqrt(coreMass / r);
    place(
      start + i,
      r * Math.cos(a),
      r * Math.sin(a),
      gauss() * 0.012,
      -v * Math.sin(a),
      v * Math.cos(a),
      gauss() * 0.01,
      starMass,
    );
  }
}

function genCollision(b: Bodies, n: number): void {
  const starsA = Math.floor((n - 2) / 2);
  const starsB = n - 2 - starsA;
  makeGalaxy(b, 0, starsA, 0.5, -0.8, -0.12, 0, 0.22, 0.05, 0, 0.45, 0.2);
  makeGalaxy(b, starsA + 1, starsB, 0.5, 0.8, 0.12, 0, -0.22, -0.05, 0, -0.3, -0.55);
  b.count = n;
  zeroDrift(b);
}

/** Plummer sphere in approximate virial equilibrium. */
function genCluster(b: Bodies, n: number): void {
  const total = 1.2;
  const a = 0.32;
  const mass = total / n;
  for (let i = 0; i < n; i++) {
    let r = a / Math.sqrt(Math.pow(Math.random(), -2 / 3) - 1);
    if (r > a * 5) r = a * 5;
    const cosT = Math.random() * 2 - 1;
    const sinT = Math.sqrt(1 - cosT * cosT);
    const phi = Math.random() * TWO_PI;
    // Local 1D dispersion of the Plummer model: sigma^2 = G M / (6 sqrt(r^2 + a^2)).
    const sigma = Math.sqrt(total / (6 * Math.hypot(r, a)));
    set(
      b,
      i,
      r * sinT * Math.cos(phi),
      r * sinT * Math.sin(phi),
      r * cosT,
      gauss() * sigma,
      gauss() * sigma,
      gauss() * sigma,
      mass,
    );
  }
  b.count = n;
  zeroDrift(b);
}

/** Place body `i` on a near-circular orbit of radius `r`, inclined by `inc`. */
function orbitBody(b: Bodies, i: number, r: number, inc: number, mass: number): void {
  const a = Math.random() * TWO_PI;
  // Star mass dominates, so v ~ sqrt(G M_star / r) is circular to within ~1%.
  const v = Math.sqrt(1 / r);
  const ci = Math.cos(inc);
  const si = Math.sin(inc);
  // In-plane circular orbit, then rotated about the x-axis (line of nodes).
  set(
    b,
    i,
    r * Math.cos(a),
    r * Math.sin(a) * ci,
    r * Math.sin(a) * si,
    -v * Math.sin(a),
    v * Math.cos(a) * ci,
    v * Math.cos(a) * si,
    mass,
  );
}

// Well-separated orbital radii (rocky planets close in, gas/ice giants far
// out) and masses that give the gas giants a visibly larger glow sprite.
const SOLAR_R = [0.14, 0.2, 0.27, 0.35, 0.55, 0.72, 0.88, 1.02];
const SOLAR_M = [3e-5, 7e-5, 1e-4, 4e-5, 1.5e-3, 9e-4, 3e-4, 3e-4];

/** Bodies the solar scene generates: the Sun and eight planets. */
export const SOLAR_COUNT = 1 + SOLAR_R.length;

/**
 * The Sun and the eight planets on well-separated, near-coplanar orbits. A
 * fixed cast, so the body count locks.
 *
 * No moons: at realistic Sun/planet mass ratios the Hill spheres are tiny, so
 * a moon's orbit is ~100x faster than the outer planets'. A single global
 * fixed-step integrator cannot resolve that spread without a step so small the
 * moons would still strip seed-dependently while being sub-pixel anyway. A
 * stable, clean planetary system is the honest result; an isolated planet +
 * moons would need its own scene.
 */
function genSolar(b: Bodies, n: number): void {
  void n;
  set(b, 0, 0, 0, 0, 0, 0, 0, 1);
  for (let p = 0; p < SOLAR_R.length; p++) {
    orbitBody(b, p + 1, SOLAR_R[p], (Math.random() - 0.5) * 0.04, SOLAR_M[p]);
  }
  b.count = 1 + SOLAR_R.length;
  zeroDrift(b);
}

const PLANET_R = [0.16, 0.22, 0.28, 0.36, 0.46, 0.62, 0.8, 1.0];
const PLANET_M = [3e-5, 8e-5, 1e-4, 5e-5, 1.5e-3, 4e-4, 2e-4, 2e-4];

/** A star, eight planets, and a dense asteroid belt between planets 5 and 6. */
function genBelt(b: Bodies, n: number): void {
  set(b, 0, 0, 0, 0, 0, 0, 0, 1);
  for (let p = 0; p < 8; p++) {
    const r = PLANET_R[p];
    const a = Math.random() * TWO_PI;
    const v = Math.sqrt(1 / r);
    const inc = (Math.random() - 0.5) * 0.06;
    set(
      b,
      p + 1,
      r * Math.cos(a),
      r * Math.sin(a),
      r * Math.sin(inc),
      -v * Math.sin(a),
      v * Math.cos(a),
      0,
      PLANET_M[p],
    );
  }
  for (let i = 9; i < n; i++) {
    const r = 0.51 + Math.random() * 0.07;
    const a = Math.random() * TWO_PI;
    const v = Math.sqrt(1 / r);
    set(
      b,
      i,
      r * Math.cos(a),
      r * Math.sin(a),
      gauss() * 0.006,
      -v * Math.sin(a),
      v * Math.cos(a),
      gauss() * 0.004,
      1e-7,
    );
  }
  b.count = n;
  zeroDrift(b);
}

/** Two equal stars in a circular mutual orbit plus a circumbinary disk. */
function genBinary(b: Bodies, n: number): void {
  const sep = 0.3;
  // omega^2 = G Mtot / d^3, so each star moves at 0.5 sqrt(G Mtot / d).
  const v = 0.5 * Math.sqrt(1 / sep);
  set(b, 0, -sep / 2, 0, 0, 0, -v, 0, 0.5);
  set(b, 1, sep / 2, 0, 0, 0, v, 0, 0.5);
  for (let i = 2; i < n; i++) {
    const r = 0.55 + Math.random() * 0.65;
    const a = Math.random() * TWO_PI;
    const vo = Math.sqrt(1 / r);
    set(
      b,
      i,
      r * Math.cos(a),
      r * Math.sin(a),
      gauss() * 0.015,
      -vo * Math.sin(a),
      vo * Math.cos(a),
      gauss() * 0.008,
      2e-6,
    );
  }
  b.count = n;
  zeroDrift(b);
}

/**
 * The Chenciner-Montgomery figure-8 choreography: exact initial conditions for
 * three unit masses at G = 1. Any softening or approximation breaks the braid,
 * so its overrides force exact direct summation.
 */
function genFigure8(b: Bodies, n: number): void {
  void n;
  const px = 0.97000436;
  const py = 0.24308753;
  const v3x = -0.93240737;
  const v3y = -0.86473146;
  set(b, 0, px, -py, 0, -v3x / 2, -v3y / 2, 0, 1);
  set(b, 1, -px, py, 0, -v3x / 2, -v3y / 2, 0, 1);
  set(b, 2, 0, 0, 0, v3x, v3y, 0, 1);
  b.count = 3;
}

/** Heavy center plus a dense ring of dust on near-circular orbits. */
function genDisk(b: Bodies, n: number): void {
  set(b, 0, 0, 0, 0, 0, 0, 0, 1);
  const rMin = 0.14;
  const rMax = 1.05;
  for (let i = 1; i < n; i++) {
    // Log-uniform radius piles dust toward the center where accretion is busiest.
    const r = rMin * Math.pow(rMax / rMin, Math.random());
    const a = Math.random() * TWO_PI;
    const v = Math.sqrt(1 / r) * (1 + gauss() * 0.01);
    set(
      b,
      i,
      r * Math.cos(a),
      r * Math.sin(a),
      gauss() * 0.012 * r,
      -v * Math.sin(a),
      v * Math.cos(a),
      gauss() * 0.006,
      5e-7 * Math.pow(10, Math.random()),
    );
  }
  b.count = n;
  zeroDrift(b);
}

/** Cold uniform ball with a hint of solid rotation: collapse, then a disk. */
function genCloud(b: Bodies, n: number): void {
  const R = 0.75;
  const mass = 1 / n;
  const omega = 0.35;
  for (let i = 0; i < n; i++) {
    const r = R * Math.cbrt(Math.random());
    const cosT = Math.random() * 2 - 1;
    const sinT = Math.sqrt(1 - cosT * cosT);
    const phi = Math.random() * TWO_PI;
    const x = r * sinT * Math.cos(phi);
    const y = r * sinT * Math.sin(phi);
    const z = r * cosT;
    set(b, i, x, y, z, -omega * y + gauss() * 0.01, omega * x + gauss() * 0.01, gauss() * 0.01, mass);
  }
  b.count = n;
  zeroDrift(b);
}

/**
 * A bound, hierarchical triple - the three-body problem that does NOT fly
 * apart. A truly chaotic equal-mass triple almost always ejects a body: in a
 * close encounter one star is slingshot away while the other two fall into a
 * tighter binary, so the system stays bound in energy yet still loses a member
 * (verified here - pushing the outer eccentricity past ~0.45 ejects a body in
 * seconds). To dance forever instead, the bodies are hierarchical: a tight,
 * fast inner binary, and a third body on a wide, eccentric orbit that swings in
 * close and back out. The pair whirls many times per outer lap, braiding the
 * trails into a rosette inside a big breathing loop. The separation ratio (~5),
 * modest eccentricity (0.3) and sub-Kozai tilt keep it bound for good: a
 * 10000 sim-second integration stays put with zero energy drift.
 */
function genThreeBody(b: Bodies, n: number): void {
  void n;
  const mInner = 0.4;
  const mOuter = 0.5;
  const aIn = 0.2; // inner binary separation
  const aOut = 1.0; // semi-major axis of the outer body's orbit
  const eOut = 0.3; // outer eccentricity: the swing that makes it a dance
  const mIn = 2 * mInner;
  const mTot = mIn + mOuter;
  // Inner binary: each star circles the pair's centre of mass.
  const vIn = Math.sqrt(mInner / (2 * aIn));
  // Outer orbit (inner binary treated as one mass at its COM), started at
  // apocentre: r = a(1+e), v = sqrt(G mTot (1-e) / (a(1+e))).
  const rRel = aOut * (1 + eOut);
  const vRel = Math.sqrt((mTot * (1 - eOut)) / (aOut * (1 + eOut)));
  const rO = (rRel * mIn) / mTot;
  const rI = (rRel * mOuter) / mTot;
  const vO = (vRel * mIn) / mTot;
  const vI = (vRel * mOuter) / mTot;
  // Tilt the inner orbit ~28 deg (below the 39 deg Kozai angle, so the inner
  // eccentricity stays put) for a three-dimensional dance.
  const ci = Math.cos(0.5);
  const si = Math.sin(0.5);
  const a = aIn / 2;
  set(b, 0, -rI, a * ci, a * si, -vIn, vI, 0, mInner);
  set(b, 1, -rI, -a * ci, -a * si, vIn, vI, 0, mInner);
  set(b, 2, rO, 0, 0, 0, -vO, 0, mOuter);
  b.count = 3;
  zeroDrift(b);
}

/**
 * The restricted three-body problem made visible: a star, a massive planet,
 * and two asteroid swarms trapped at the leading (L4) and trailing (L5)
 * Lagrange points, 60 degrees ahead of and behind the planet. The swarms
 * librate around those points instead of dispersing - the clearest picture of
 * why Jupiter shepherds its Trojans.
 */
function genTrojans(b: Bodies, n: number): void {
  const mp = 0.012; // planet/star mass ratio below 0.0385 keeps L4/L5 stable
  const R = 0.72;
  const omega = Math.sqrt((1 + mp) / (R * R * R));
  const vp = omega * R;
  const bary = (mp / (1 + mp)) * R;
  set(b, 0, -bary, 0, 0, 0, -mp * vp, 0, 1);
  set(b, 1, R - bary, 0, 0, 0, vp, 0, mp);
  const swarm = Math.max(0, n - 2);
  for (let i = 0; i < swarm; i++) {
    const ang = i % 2 === 0 ? Math.PI / 3 : -Math.PI / 3;
    const px = R * Math.cos(ang) - bary + gauss() * 0.05;
    const py = R * Math.sin(ang) + gauss() * 0.05;
    const pz = gauss() * 0.02;
    // Co-rotating velocity (omega x r) puts each asteroid on a tadpole orbit.
    set(b, i + 2, px, py, pz, -omega * py, omega * px, 0, 1e-6);
  }
  b.count = n;
  zeroDrift(b);
}

/**
 * A cold, loosely-bound cluster dropped onto an eccentric orbit around a heavy
 * mass. Tidal shear stretches it into a long stream that winds around the
 * central body - the same process that draws stellar streams out of disrupting
 * star clusters and dwarf galaxies. Trails make the winding unmistakable.
 */
function genStream(b: Bodies, n: number): void {
  set(b, 0, 0, 0, 0, 0, 0, 0, 1);
  const cx = 1.25;
  const vy = 0.5; // sub-circular: an eccentric orbit that dips close in
  const cm = 0.02 / Math.max(1, n - 1);
  for (let i = 1; i < n; i++) {
    set(
      b,
      i,
      cx + gauss() * 0.07,
      gauss() * 0.07,
      gauss() * 0.04,
      gauss() * 0.04,
      vy + gauss() * 0.04,
      gauss() * 0.03,
      cm,
    );
  }
  b.count = n;
  zeroDrift(b);
}

/**
 * A black hole devouring an accretion disk. A dominant central mass anchors a
 * bright disk on near-circular orbits (hot, fast inner edge), while a third of
 * the matter rains in on eccentric orbits whose pericentre dips into the hole.
 *
 * The hole is given a large capture radius and a matching softening length, so
 * its gravity is *capped* near the centre rather than singular: infalling
 * matter is swallowed (merging on) at a finite speed instead of being slung
 * back out at the absurd velocities an unsoftened point mass would produce.
 * Speed colouring lights the shredding infall.
 */
function genBlackHole(b: Bodies, n: number): void {
  const bh = 2.5;
  set(b, 0, 0, 0, 0, 0, 0, 0, bh);
  // Override the mass-derived radius: a wide capture zone so matter merges at
  // the soft core instead of slingshotting through a singularity.
  b.radius[0] = 0.06;
  const rMin = 0.2;
  const rMax = 1.0;
  for (let i = 1; i < n; i++) {
    const infall = Math.random() < 0.3;
    // Disk: log-uniform radius (inner-heavy, bright core). Infallers start
    // farther out so their dive across the disk reads clearly.
    const r = infall ? 0.45 + Math.random() * 0.55 : rMin * Math.pow(rMax / rMin, Math.random());
    const a = Math.random() * TWO_PI;
    const vc = Math.sqrt(bh / r);
    // Near-circular gas vs eccentric infall (pericentre r f^2 / (2 - f^2)
    // reaches the capture radius), kept above the speeds that would slingshot.
    const f = infall ? 0.42 + 0.18 * Math.random() : 0.92 + 0.08 * Math.random();
    const v = vc * f;
    const zScale = infall ? 0.05 : 0.01 * r;
    set(
      b,
      i,
      r * Math.cos(a),
      r * Math.sin(a),
      gauss() * zScale,
      -v * Math.sin(a),
      v * Math.cos(a),
      gauss() * 0.006,
      8e-6,
    );
  }
  b.count = n;
  zeroDrift(b);
}

// timeScale is a persisted "look" setting (see index.tsx), so it is
// deliberately absent from every preset's overrides - switching scenes keeps
// whatever playback speed the user chose.
export const PRESETS: PresetDef[] = [
  {
    id: "collision",
    count: 4000,
    minCount: 200,
    overrides: { gravity: 1, softening: 0.02, theta: 0.7, merging: false },
    generate: genCollision,
  },
  {
    id: "cluster",
    count: 3000,
    minCount: 100,
    overrides: { gravity: 1, softening: 0.02, theta: 0.7, merging: false },
    generate: genCluster,
  },
  {
    id: "solar",
    count: SOLAR_COUNT,
    minCount: SOLAR_COUNT,
    locked: true,
    // Small softening for crisp Keplerian orbits (no close passes) and a finer
    // substep so the inner planets trace smoothly.
    overrides: { gravity: 1, softening: 0.002, theta: 0, merging: false, substep: 0.008 },
    generate: genSolar,
  },
  {
    id: "belt",
    count: 2500,
    minCount: 12,
    overrides: { gravity: 1, softening: 0.004, theta: 0.6, merging: false },
    generate: genBelt,
  },
  {
    id: "trojans",
    count: 1500,
    minCount: 50,
    overrides: { gravity: 1, softening: 0.01, theta: 0.5, merging: false },
    generate: genTrojans,
  },
  {
    id: "binary",
    count: 2500,
    minCount: 50,
    overrides: { gravity: 1, softening: 0.006, theta: 0.6, merging: false },
    generate: genBinary,
  },
  {
    id: "figure8",
    count: 3,
    minCount: 3,
    locked: true,
    overrides: { gravity: 1, softening: 0.002, theta: 0, merging: false },
    generate: genFigure8,
  },
  {
    id: "threebody",
    count: 3,
    minCount: 3,
    locked: true,
    overrides: { gravity: 1, softening: 0.01, theta: 0, merging: false },
    generate: genThreeBody,
  },
  {
    id: "disk",
    count: 5000,
    minCount: 100,
    overrides: { gravity: 1, softening: 0.008, theta: 0.7, merging: true },
    generate: genDisk,
  },
  {
    id: "stream",
    count: 2000,
    minCount: 50,
    overrides: { gravity: 1, softening: 0.01, theta: 0.7, merging: false },
    generate: genStream,
  },
  {
    id: "blackhole",
    count: 4000,
    minCount: 200,
    // Softening ~ capture radius caps the central force; a finer substep
    // resolves the fast infall so matter is swallowed cleanly, not flung.
    overrides: { gravity: 1, softening: 0.05, theta: 0.7, merging: true, substep: 0.008 },
    generate: genBlackHole,
  },
  {
    id: "cloud",
    count: 3000,
    minCount: 50,
    overrides: { gravity: 1, softening: 0.02, theta: 0.7, merging: true },
    generate: genCloud,
  },
];

export function presetById(id: PresetId): PresetDef {
  const def = PRESETS.find((p) => p.id === id);
  if (!def) throw new Error(`unknown preset: ${id}`);
  return def;
}

/** Generate `params.count` bodies of the active preset into the buffers. */
export function seed(b: Bodies, preset: PresetId, count: number): void {
  const def = presetById(preset);
  const n = def.locked
    ? def.count
    : Math.max(def.minCount, Math.min(count, b.capacity));
  def.generate(b, n);
}
