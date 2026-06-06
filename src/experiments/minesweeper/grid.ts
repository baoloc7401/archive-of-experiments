/** Shared grid geometry. All indices are row-major: `i = y * width + x`. */

export function idx(x: number, y: number, width: number): number {
  return y * width + x;
}

/** Up to 8 neighbour indices of `i`, clipped to the board. */
export function neighbors(i: number, width: number, height: number): number[] {
  const x = i % width;
  const y = (i / width) | 0;
  const out: number[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    const ny = y + dy;
    if (ny < 0 || ny >= height) continue;
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      if (nx < 0 || nx >= width) continue;
      out.push(ny * width + nx);
    }
  }
  return out;
}

/** Precompute every cell's neighbour list once - the solver hammers this. */
export function neighborTable(width: number, height: number): number[][] {
  const n = width * height;
  const table: number[][] = new Array(n);
  for (let i = 0; i < n; i++) table[i] = neighbors(i, width, height);
  return table;
}

/** Cells within Chebyshev distance `radius` of `origin`, inclusive. */
export function disk(origin: number, radius: number, width: number, height: number): number[] {
  const ox = origin % width;
  const oy = (origin / width) | 0;
  const out: number[] = [];
  for (let y = Math.max(0, oy - radius); y <= Math.min(height - 1, oy + radius); y++) {
    for (let x = Math.max(0, ox - radius); x <= Math.min(width - 1, ox + radius); x++) {
      out.push(y * width + x);
    }
  }
  return out;
}
