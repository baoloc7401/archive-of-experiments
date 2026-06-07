import type { LModel, Segment, Vec3 } from "./types";

/** A saved turtle frame for the bracket stack. */
interface Frame {
  p: number[];
  h: number[];
  l: number[];
  u: number[];
  depth: number;
}

/**
 * Rotate the orthonormal pair (a, b) by `angle` in their own plane, in place.
 * Keeps the turtle frame orthonormal without accumulating drift the way a full
 * matrix multiply chain would.
 */
function spin(a: number[], b: number[], angle: number): void {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const a0 = a[0];
  const a1 = a[1];
  const a2 = a[2];
  a[0] = a0 * c + b[0] * s;
  a[1] = a1 * c + b[1] * s;
  a[2] = a2 * c + b[2] * s;
  b[0] = -a0 * s + b[0] * c;
  b[1] = -a1 * s + b[1] * c;
  b[2] = -a2 * s + b[2] * c;
}

/**
 * Walk the expanded string as a 3D turtle and collect drawn segments.
 *
 * Frame: heading H starts along +Y (so plants grow upward), left L along -X,
 * up U along +Z, forming a right-handed (H, L, U) basis. Each `F` advances one
 * unit and records a segment; rotations turn the frame in place; `[` / `]`
 * save and restore it. Symbols with no turtle meaning are ignored (they only
 * matter to the rewriter).
 */
export function interpret(str: string, angleDeg: number): LModel {
  const a = (angleDeg * Math.PI) / 180;

  let p = [0, 0, 0];
  let h = [0, 1, 0];
  let l = [-1, 0, 0];
  let u = [0, 0, 1];
  let depth = 0;
  let maxDepth = 0;

  const stack: Frame[] = [];
  const segments: Segment[] = [];

  // Track the bounding box as we go so we can centre + fit afterwards.
  let minX = 0;
  let minY = 0;
  let minZ = 0;
  let maxX = 0;
  let maxY = 0;
  let maxZ = 0;
  const grow = (x: number, y: number, z: number) => {
    if (x < minX) minX = x;
    else if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    else if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    else if (z > maxZ) maxZ = z;
  };

  for (let i = 0; i < str.length; i++) {
    const sym = str[i];
    switch (sym) {
      case "F":
      case "G": {
        const bx = p[0] + h[0];
        const by = p[1] + h[1];
        const bz = p[2] + h[2];
        segments.push({
          ax: p[0],
          ay: p[1],
          az: p[2],
          bx,
          by,
          bz,
          depth,
          order: 0,
        });
        p = [bx, by, bz];
        grow(bx, by, bz);
        break;
      }
      case "f":
        p = [p[0] + h[0], p[1] + h[1], p[2] + h[2]];
        grow(p[0], p[1], p[2]);
        break;
      case "+":
        spin(h, l, a);
        break;
      case "-":
        spin(h, l, -a);
        break;
      case "&":
        spin(h, u, -a);
        break;
      case "^":
        spin(h, u, a);
        break;
      case "\\":
      case "<":
        spin(l, u, a);
        break;
      case "/":
      case ">":
        spin(l, u, -a);
        break;
      case "|":
        spin(h, l, Math.PI);
        break;
      case "[":
        stack.push({ p: [...p], h: [...h], l: [...l], u: [...u], depth });
        depth++;
        if (depth > maxDepth) maxDepth = depth;
        break;
      case "]": {
        const f = stack.pop();
        if (f) {
          p = f.p;
          h = f.h;
          l = f.l;
          u = f.u;
          depth = f.depth;
        }
        break;
      }
      default:
        break;
    }
  }

  const n = segments.length;
  if (n > 1) {
    const inv = 1 / (n - 1);
    for (let i = 0; i < n; i++) segments[i].order = i * inv;
  }

  const center: Vec3 = {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
    z: (minZ + maxZ) / 2,
  };
  const size: Vec3 = { x: maxX - minX, y: maxY - minY, z: maxZ - minZ };
  const radius = Math.max(size.x, size.y, size.z, 1) / 2 || 1;

  return { segments, symbolCount: str.length, maxDepth, center, size, radius };
}
