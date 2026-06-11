import type { Bodies } from "./types";

/**
 * Flat Barnes-Hut octree over typed-array pools: no per-node objects, no
 * allocation in the steady state (pools grow geometrically and then stick).
 * Leaves hold up to LEAF_CAP bodies in an intrusive linked list and split
 * lazily; the depth cap keeps coincident bodies from splitting forever.
 */
const LEAF_CAP = 8;
const MAX_DEPTH = 24;

/** Where a force pass writes its results; physics' Scratch satisfies this. */
export interface ForceSink {
  ax: Float64Array;
  ay: Float64Array;
  az: Float64Array;
  /** Flat (i, j) merge-candidate pairs, i < j. */
  pairs: Int32Array;
  pairCount: number;
  /** Sum of pairwise potential energy (BH pass double-counts; caller halves). */
  pe: number;
  /** Force evaluations performed (body-body or body-node). */
  evals: number;
}

export interface Octree {
  /** Cube center + half-extent per node. */
  cx: Float64Array;
  cy: Float64Array;
  cz: Float64Array;
  half: Float64Array;
  /** Mass-weighted position sums during build; divided into COM on finalize. */
  comX: Float64Array;
  comY: Float64Array;
  comZ: Float64Array;
  comM: Float64Array;
  /** 8 child slots per node, -1 = none. */
  child: Int32Array;
  /** 1 = internal node, 0 = leaf. */
  internal: Uint8Array;
  /** Head of the leaf's body list, -1 = empty. */
  first: Int32Array;
  leafN: Int32Array;
  /** Per-body list link. */
  next: Int32Array;
  /** Leaf node currently holding each body (so traversal can skip-self). */
  leafOf: Int32Array;
  /** Traversal stack (worst case ~ 8 * MAX_DEPTH). */
  stack: Int32Array;
  nodeCount: number;
  nodeCap: number;
}

export function makeOctree(bodyCapacity: number): Octree {
  const cap = 1024;
  return {
    cx: new Float64Array(cap),
    cy: new Float64Array(cap),
    cz: new Float64Array(cap),
    half: new Float64Array(cap),
    comX: new Float64Array(cap),
    comY: new Float64Array(cap),
    comZ: new Float64Array(cap),
    comM: new Float64Array(cap),
    child: new Int32Array(cap * 8),
    internal: new Uint8Array(cap),
    first: new Int32Array(cap),
    leafN: new Int32Array(cap),
    next: new Int32Array(bodyCapacity),
    leafOf: new Int32Array(bodyCapacity),
    stack: new Int32Array(MAX_DEPTH * 8 + 64),
    nodeCount: 0,
    nodeCap: cap,
  };
}

function growNodes(t: Octree): void {
  const cap = t.nodeCap * 2;
  const copy = <A extends Float64Array | Int32Array | Uint8Array>(src: A, size: number): A => {
    const dst =
      src instanceof Float64Array
        ? new Float64Array(size)
        : src instanceof Int32Array
          ? new Int32Array(size)
          : new Uint8Array(size);
    dst.set(src);
    return dst as A;
  };
  t.cx = copy(t.cx, cap);
  t.cy = copy(t.cy, cap);
  t.cz = copy(t.cz, cap);
  t.half = copy(t.half, cap);
  t.comX = copy(t.comX, cap);
  t.comY = copy(t.comY, cap);
  t.comZ = copy(t.comZ, cap);
  t.comM = copy(t.comM, cap);
  t.child = copy(t.child, cap * 8);
  t.internal = copy(t.internal, cap);
  t.first = copy(t.first, cap);
  t.leafN = copy(t.leafN, cap);
  t.nodeCap = cap;
}

function newNode(t: Octree, cx: number, cy: number, cz: number, half: number): number {
  if (t.nodeCount === t.nodeCap) growNodes(t);
  const n = t.nodeCount++;
  t.cx[n] = cx;
  t.cy[n] = cy;
  t.cz[n] = cz;
  t.half[n] = half;
  t.comX[n] = 0;
  t.comY[n] = 0;
  t.comZ[n] = 0;
  t.comM[n] = 0;
  t.internal[n] = 0;
  t.first[n] = -1;
  t.leafN[n] = 0;
  t.child.fill(-1, n * 8, n * 8 + 8);
  return n;
}

/** Octant of (x, y, z) inside node `n`, and the child cube it implies. */
function childOf(t: Octree, n: number, x: number, y: number, z: number): number {
  const oct = (x >= t.cx[n] ? 1 : 0) | (y >= t.cy[n] ? 2 : 0) | (z >= t.cz[n] ? 4 : 0);
  const slot = n * 8 + oct;
  let c = t.child[slot];
  if (c === -1) {
    const q = t.half[n] / 2;
    c = newNode(
      t,
      t.cx[n] + ((oct & 1) !== 0 ? q : -q),
      t.cy[n] + ((oct & 2) !== 0 ? q : -q),
      t.cz[n] + ((oct & 4) !== 0 ? q : -q),
      q,
    );
    // newNode may have grown the pools, so write through the fresh array.
    t.child[slot] = c;
  }
  return c;
}

/** Append body `i` to leaf `n`'s list and credit it to the node's COM sums. */
function appendBody(t: Octree, b: Bodies, n: number, i: number): void {
  const m = b.mass[i];
  t.comX[n] += m * b.x[i];
  t.comY[n] += m * b.y[i];
  t.comZ[n] += m * b.z[i];
  t.comM[n] += m;
  t.next[i] = t.first[n];
  t.first[n] = i;
  t.leafN[n]++;
  t.leafOf[i] = n;
}

export function buildOctree(t: Octree, b: Bodies): void {
  const n = b.count;
  t.nodeCount = 0;
  if (n === 0) return;

  // Root cube: bounding box of all bodies, squared up.
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < n; i++) {
    if (b.x[i] < minX) minX = b.x[i];
    if (b.x[i] > maxX) maxX = b.x[i];
    if (b.y[i] < minY) minY = b.y[i];
    if (b.y[i] > maxY) maxY = b.y[i];
    if (b.z[i] < minZ) minZ = b.z[i];
    if (b.z[i] > maxZ) maxZ = b.z[i];
  }
  const half =
    Math.max(maxX - minX, maxY - minY, maxZ - minZ, 1e-6) * 0.5 * 1.0001;
  newNode(t, (minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2, half);

  for (let i = 0; i < n; i++) {
    let node = 0;
    let depth = 0;
    for (;;) {
      if (t.internal[node] === 1) {
        // Credit the body to every internal node it passes through.
        const m = b.mass[i];
        t.comX[node] += m * b.x[i];
        t.comY[node] += m * b.y[i];
        t.comZ[node] += m * b.z[i];
        t.comM[node] += m;
        node = childOf(t, node, b.x[i], b.y[i], b.z[i]);
        depth++;
      } else if (t.leafN[node] < LEAF_CAP || depth >= MAX_DEPTH) {
        appendBody(t, b, node, i);
        break;
      } else {
        // Split: push the resident bodies one level down, then continue the
        // descent from this (now internal) node. COM sums here already include
        // the residents; the children they land in get credited by appendBody.
        t.internal[node] = 1;
        let j = t.first[node];
        t.first[node] = -1;
        t.leafN[node] = 0;
        while (j !== -1) {
          const after = t.next[j];
          appendBody(t, b, childOf(t, node, b.x[j], b.y[j], b.z[j]), j);
          j = after;
        }
      }
    }
  }

  // Finalize: turn mass-weighted sums into centers of mass.
  for (let k = 0; k < t.nodeCount; k++) {
    const m = t.comM[k];
    if (m > 0) {
      t.comX[k] /= m;
      t.comY[k] /= m;
      t.comZ[k] /= m;
    }
  }
}

/**
 * Accumulate softened accelerations (and potential) for every body against the
 * tree. Internal nodes pass the opening test `s/d < theta` and act as a single
 * point mass; otherwise the traversal descends, bottoming out in exact
 * body-body terms - which is also where touching pairs are collected, since
 * close bodies always fail the opening test all the way down to their leaves.
 */
export function bhForces(
  t: Octree,
  b: Bodies,
  G: number,
  eps2: number,
  theta: number,
  sink: ForceSink,
  collectPairs: boolean,
): void {
  const n = b.count;
  const { x, y, z, mass, radius } = b;
  const { ax, ay, az, pairs } = sink;
  // Hoist every pool into a local: the traversal touches these millions of
  // times per frame and repeated property loads through `t` cost real time.
  const { stack, internal, child, first, next, leafOf } = t;
  const comX = t.comX;
  const comY = t.comY;
  const comZ = t.comZ;
  const comM = t.comM;
  const halfArr = t.half;
  const theta2 = theta * theta;
  const maxPairs = pairs.length / 2;
  let pairCount = sink.pairCount;
  let evals = 0;
  let pe = 0;

  for (let i = 0; i < n; i++) {
    const xi = x[i];
    const yi = y[i];
    const zi = z[i];
    const ri = radius[i];
    const ownLeaf = leafOf[i];
    let axi = 0;
    let ayi = 0;
    let azi = 0;
    let sp = 0;
    stack[sp++] = 0;
    while (sp > 0) {
      const node = stack[--sp];
      // Any node but the body's own leaf may pass the opening test and act as
      // a point mass (the own leaf's COM would include the body itself).
      if (node !== ownLeaf) {
        const dx = comX[node] - xi;
        const dy = comY[node] - yi;
        const dz = comZ[node] - zi;
        const d2 = dx * dx + dy * dy + dz * dz;
        const s = halfArr[node] * 2;
        if (s * s < theta2 * d2) {
          const inv = 1 / Math.sqrt(d2 + eps2);
          const gm = G * comM[node];
          const a = gm * inv * inv * inv;
          axi += dx * a;
          ayi += dy * a;
          azi += dz * a;
          pe -= mass[i] * gm * inv;
          evals++;
          continue;
        }
        if (internal[node] === 1) {
          const base = node * 8;
          for (let c = 0; c < 8; c++) {
            const ch = child[base + c];
            if (ch !== -1) stack[sp++] = ch;
          }
          continue;
        }
      }
      // The body's own leaf, or a leaf too close to approximate: exact terms.
      {
        let j = first[node];
        while (j !== -1) {
          if (j !== i) {
            const dx = x[j] - xi;
            const dy = y[j] - yi;
            const dz = z[j] - zi;
            const d2 = dx * dx + dy * dy + dz * dz;
            const inv = 1 / Math.sqrt(d2 + eps2);
            const gm = G * mass[j];
            const a = gm * inv * inv * inv;
            axi += dx * a;
            ayi += dy * a;
            azi += dz * a;
            pe -= mass[i] * gm * inv;
            evals++;
            if (collectPairs && i < j && pairCount < maxPairs) {
              const rr = ri + radius[j];
              if (d2 < rr * rr) {
                pairs[pairCount * 2] = i;
                pairs[pairCount * 2 + 1] = j;
                pairCount++;
              }
            }
          }
          j = next[j];
        }
      }
    }
    ax[i] = axi;
    ay[i] = ayi;
    az[i] = azi;
  }

  sink.pairCount = pairCount;
  sink.evals += evals;
  // Every pair was visited from both ends, so the potential is double-counted.
  sink.pe += pe * 0.5;
}
