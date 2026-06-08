import { FIT, FOCAL } from "./constants";
import { mix, type Palette } from "./palette";
import type { LModel, LParams } from "./types";

/** Orbit camera state driven by drag, wheel, and auto-spin. */
export interface View {
  yaw: number;
  pitch: number;
  zoom: number;
}

export interface DrawState {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  dpr: number;
  palette: Palette;
  params: LParams;
  model: LModel;
  view: View;
  /** Fraction of strokes to draw (0..1); the progressive-growth reveal. */
  reveal: number;
}

/** One batched stroke style: all segments sharing a quantised colour + width. */
interface Bucket {
  path: Path2D;
  style: string;
  width: number;
}

const QUANT = 10; // colour channels are rounded to this many levels of grey

/**
 * Project the centred 3D model through the orbit camera and paint it as
 * depth-cued line strokes. There is no occlusion sort: perspective foreshorten,
 * branch taper, and a fog that fades far segments toward the background give the
 * volume read, while parallax from drag/auto-spin does the rest. Segments are
 * grouped into a handful of buckets by quantised colour + width so even a large
 * system strokes in a few dozen `ctx.stroke` calls.
 */
export function drawScene(state: DrawState): void {
  const { ctx, w, h, dpr, palette, params, model, view } = state;
  const { segments, center, radius, maxDepth } = model;

  // Clear the full backing store, then work in CSS pixels.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w * dpr, h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  if (segments.length === 0) return;

  const minDim = Math.min(w, h);
  const s = ((FIT * minDim) / (2 * radius)) * view.zoom;
  const focal = FOCAL * minDim;
  const screenR = radius * s || 1;

  const cy = Math.cos(view.yaw);
  const sy = Math.sin(view.yaw);
  const cp = Math.cos(view.pitch);
  const sp = Math.sin(view.pitch);
  const cx = w / 2;
  const cyp = h / 2;

  // Rotate a model point into screen space; returns [sx, sy, depthZ].
  const project = (px: number, py: number, pz: number): [number, number, number] => {
    const x = px - center.x;
    const y = py - center.y;
    const z = pz - center.z;
    // yaw about Y, then pitch about X.
    const x1 = x * cy + z * sy;
    const z1 = -x * sy + z * cy;
    const y1 = y * cp - z1 * sp;
    const z2 = y * sp + z1 * cp;
    const zs = z2 * s;
    const persp = focal / (focal - zs);
    return [cx + x1 * s * persp, cyp - y1 * s * persp, zs];
  };

  const buckets = new Map<string, Bucket>();
  const fog = params.fog;
  const taperBase = 1 - params.taper;
  const limit =
    state.reveal >= 1
      ? segments.length
      : Math.max(1, Math.ceil(state.reveal * segments.length));

  for (let i = 0; i < limit; i++) {
    const seg = segments[i];
    const a = project(seg.ax, seg.ay, seg.az);
    const b = project(seg.bx, seg.by, seg.bz);

    // Base colour before fog.
    let base: [number, number, number];
    if (params.colorMode === "mono") {
      base = palette.textHiRgb;
    } else {
      const t =
        params.colorMode === "depth"
          ? maxDepth > 0
            ? seg.depth / maxDepth
            : 0
          : seg.order;
      base = mix(palette.accentRgb, palette.accent2Rgb, t);
    }

    // Fog: fade toward the background as the segment recedes from the viewer.
    const midZ = (a[2] + b[2]) / 2;
    const nearness = (midZ + screenR) / (2 * screenR);
    const farness = Math.min(1, Math.max(0, 1 - nearness));
    const col = mix(base, palette.bgRgb, fog * farness);

    const qr = Math.round((col[0] / 255) * QUANT);
    const qg = Math.round((col[1] / 255) * QUANT);
    const qb = Math.round((col[2] / 255) * QUANT);
    const width = Math.max(0.5, params.thickness * Math.pow(taperBase, seg.depth));
    const key = `${qr},${qg},${qb},${seg.depth}`;

    let bucket = buckets.get(key);
    if (!bucket) {
      const r = Math.round((qr / QUANT) * 255);
      const g = Math.round((qg / QUANT) * 255);
      const bl = Math.round((qb / QUANT) * 255);
      bucket = { path: new Path2D(), style: `rgb(${r},${g},${bl})`, width };
      buckets.set(key, bucket);
    }
    bucket.path.moveTo(a[0], a[1]);
    bucket.path.lineTo(b[0], b[1]);
  }

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const bucket of buckets.values()) {
    ctx.strokeStyle = bucket.style;
    ctx.lineWidth = bucket.width;
    ctx.stroke(bucket.path);
  }
}
