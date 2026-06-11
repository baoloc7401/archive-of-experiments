/**
 * The handful of column-major 4x4 helpers the renderer needs - a dependency
 * would be overkill for two matrices and a point transform.
 */
export type Mat4 = Float32Array;

export function mat4(): Mat4 {
  return new Float32Array(16);
}

/** Standard GL perspective projection (right-handed, -z forward). */
export function perspective(out: Mat4, fovY: number, aspect: number, near: number, far: number): void {
  const f = 1 / Math.tan(fovY / 2);
  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) / (near - far);
  out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
}

/**
 * Orbit-camera view matrix: translate the target to the origin, yaw about Y,
 * pitch about X, then back the camera off along +Z by `dist`. Mirrors the
 * l-system projection so the two experiments read the same way.
 */
export function orbitView(
  out: Mat4,
  yaw: number,
  pitch: number,
  dist: number,
  tx: number,
  ty: number,
  tz: number,
): void {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  // Rotation rows: R = Rx(pitch) * Ry(yaw).
  const r00 = cy;
  const r01 = 0;
  const r02 = sy;
  const r10 = sy * sp;
  const r11 = cp;
  const r12 = -cy * sp;
  const r20 = -sy * cp;
  const r21 = sp;
  const r22 = cy * cp;
  out[0] = r00;
  out[1] = r10;
  out[2] = r20;
  out[3] = 0;
  out[4] = r01;
  out[5] = r11;
  out[6] = r21;
  out[7] = 0;
  out[8] = r02;
  out[9] = r12;
  out[10] = r22;
  out[11] = 0;
  out[12] = -(r00 * tx + r01 * ty + r02 * tz);
  out[13] = -(r10 * tx + r11 * ty + r12 * tz);
  out[14] = -(r20 * tx + r21 * ty + r22 * tz) - dist;
  out[15] = 1;
}

/** out = a * b. `out` must not alias `a` or `b`. */
export function multiply(out: Mat4, a: Mat4, b: Mat4): void {
  for (let c = 0; c < 4; c++) {
    const b0 = b[c * 4];
    const b1 = b[c * 4 + 1];
    const b2 = b[c * 4 + 2];
    const b3 = b[c * 4 + 3];
    out[c * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
    out[c * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
    out[c * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
    out[c * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
  }
}

/**
 * Transform a world point to CSS-pixel screen space. Returns the clip-space w
 * (camera distance); w <= 0 means behind the camera. Used for click picking.
 */
export function projectToScreen(
  m: Mat4,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  out: { sx: number; sy: number; cw: number },
): void {
  const cx = m[0] * x + m[4] * y + m[8] * z + m[12];
  const cy = m[1] * x + m[5] * y + m[9] * z + m[13];
  const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
  out.cw = cw;
  if (cw <= 0) {
    out.sx = -1e9;
    out.sy = -1e9;
    return;
  }
  out.sx = (cx / cw + 1) * 0.5 * w;
  out.sy = (1 - (cy / cw + 1) * 0.5) * h;
}
