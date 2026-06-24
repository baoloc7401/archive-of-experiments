/// <reference types="@webgpu/types" />
import type { Bodies } from "../types";
import { NBODY_WGSL, TILE } from "./nbody.wgsl";

/**
 * Opt-in WebGPU brute-force solver. It owns the bodies between frames in GPU
 * storage buffers and integrates them entirely on the device; the CPU only
 * reads a copy back each frame to feed the (unchanged) WebGL2 renderer, picking,
 * trails, and camera. Compute-only: it never configures a canvas context, so it
 * coexists with the WebGL2 renderer on the same canvas without conflict.
 *
 * The readback is asynchronous (mapAsync), so displayed positions lag the GPU
 * by ~1 frame - invisible, and the price for not stalling the pipeline. The
 * path is float32, so it is the fast-and-loose counterpart to the float64 CPU
 * engine, which stays the source of truth for energy/merging/precision scenes.
 */
export interface GpuSolver {
  /** Adapter description for the debug readout. */
  readonly info: string;
  /** True once the device is lost; the canvas falls back to the CPU path. */
  readonly lost: boolean;
  /** Copy the SoA prefix into GPU buffers and mark accelerations stale. */
  upload(b: Bodies): void;
  /** Encode `substeps` leapfrog steps of size `h` and kick off a readback. */
  step(h: number, substeps: number, gravity: number, eps2: number): void;
  /** Apply the most recent readback into the SoA; true if fresh data landed. */
  readInto(b: Bodies): boolean;
  destroy(): void;
}

interface StagingSlot {
  buf: GPUBuffer;
  busy: boolean;
  /** Generation this slot's copy belongs to (stale after a reseed). */
  gen: number;
  /** Body count captured in this copy. */
  n: number;
}

/** How many readbacks may be in flight before we skip a frame's copy. */
const STAGING_SLOTS = 3;

export async function createGpuSolver(
  capacity: number,
  onLost?: () => void,
): Promise<GpuSolver | null> {
  if (typeof navigator === "undefined" || !navigator.gpu) return null;
  const setup = await (async () => {
    try {
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
      if (!adapter) return null;
      const device = await adapter.requestDevice();
      return { device, info: adapterInfo(adapter) };
    } catch {
      return null;
    }
  })();
  if (!setup) return null;
  const dev = setup.device;
  const info = setup.info;

  const vec4Bytes = capacity * 16;
  const usageStorage: GPUBufferUsageFlags =
    GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST;
  const posBuf = dev.createBuffer({ size: vec4Bytes, usage: usageStorage });
  const velBuf = dev.createBuffer({ size: vec4Bytes, usage: usageStorage });
  const accBuf = dev.createBuffer({ size: vec4Bytes, usage: GPUBufferUsage.STORAGE });
  const paramBuf = dev.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const module = dev.createShaderModule({ code: NBODY_WGSL });
  const bgl = dev.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
      { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
      { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
    ],
  });
  const layout = dev.createPipelineLayout({ bindGroupLayouts: [bgl] });
  const pipe = (entryPoint: string) =>
    dev.createComputePipeline({ layout, compute: { module, entryPoint } });
  const forcesPipe = pipe("forces");
  const kickDriftPipe = pipe("kickDrift");
  const kickPipe = pipe("kick");
  const bindGroup = dev.createBindGroup({
    layout: bgl,
    entries: [
      { binding: 0, resource: { buffer: paramBuf } },
      { binding: 1, resource: { buffer: posBuf } },
      { binding: 2, resource: { buffer: velBuf } },
      { binding: 3, resource: { buffer: accBuf } },
    ],
  });

  const slots: StagingSlot[] = [];
  for (let i = 0; i < STAGING_SLOTS; i++) {
    slots.push({
      buf: dev.createBuffer({ size: capacity * 32, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }),
      busy: false,
      gen: -1,
      n: 0,
    });
  }

  // CPU staging for uploads and the most recent readback.
  const posStage = new Float32Array(capacity * 4);
  const velStage = new Float32Array(capacity * 4);
  const mirror = new Float32Array(capacity * 8);
  const paramData = new ArrayBuffer(16);
  const paramView = new DataView(paramData);

  let n = 0;
  let generation = 0;
  let accelValid = false;
  let mirrorGen = -1;
  let mirrorN = 0;
  let hasMirror = false;
  let lost = false;
  let destroyed = false;

  dev.lost.then((reason) => {
    void reason;
    if (destroyed) return;
    lost = true;
    onLost?.();
  });

  const workgroups = () => Math.ceil(n / TILE);

  function upload(b: Bodies): void {
    if (lost || destroyed) return;
    n = b.count;
    for (let i = 0; i < n; i++) {
      posStage[i * 4] = b.x[i];
      posStage[i * 4 + 1] = b.y[i];
      posStage[i * 4 + 2] = b.z[i];
      posStage[i * 4 + 3] = b.mass[i];
      velStage[i * 4] = b.vx[i];
      velStage[i * 4 + 1] = b.vy[i];
      velStage[i * 4 + 2] = b.vz[i];
      velStage[i * 4 + 3] = 0;
    }
    dev.queue.writeBuffer(posBuf, 0, posStage, 0, n * 4);
    dev.queue.writeBuffer(velBuf, 0, velStage, 0, n * 4);
    accelValid = false;
    generation++;
  }

  function step(h: number, substeps: number, gravity: number, eps2: number): void {
    if (lost || destroyed || n === 0 || substeps <= 0) return;
    paramView.setFloat32(0, gravity, true);
    paramView.setFloat32(4, eps2, true);
    paramView.setFloat32(8, h, true);
    paramView.setUint32(12, n >>> 0, true);
    dev.queue.writeBuffer(paramBuf, 0, paramData);

    const wg = workgroups();
    const enc = dev.createCommandEncoder();
    const pass = enc.beginComputePass();
    pass.setBindGroup(0, bindGroup);
    // Leapfrog reuses the closing kick's accelerations as the next step's
    // opening kick, so forces are only seeded once when stale (after upload).
    if (!accelValid) {
      pass.setPipeline(forcesPipe);
      pass.dispatchWorkgroups(wg);
      accelValid = true;
    }
    for (let s = 0; s < substeps; s++) {
      pass.setPipeline(kickDriftPipe);
      pass.dispatchWorkgroups(wg);
      pass.setPipeline(forcesPipe);
      pass.dispatchWorkgroups(wg);
      pass.setPipeline(kickPipe);
      pass.dispatchWorkgroups(wg);
    }
    pass.end();

    // Copy positions + velocities into a free staging buffer for readback.
    const slot = slots.find((s) => !s.busy);
    if (slot) {
      const bytes = n * 16;
      enc.copyBufferToBuffer(posBuf, 0, slot.buf, 0, bytes);
      enc.copyBufferToBuffer(velBuf, 0, slot.buf, bytes, bytes);
      slot.busy = true;
      slot.gen = generation;
      slot.n = n;
    }
    dev.queue.submit([enc.finish()]);

    if (slot) {
      const captured = slot;
      const bytes = captured.n * 32;
      captured.buf
        .mapAsync(GPUMapMode.READ, 0, bytes)
        .then(() => {
          if (destroyed) return;
          if (captured.gen === generation) {
            mirror.set(new Float32Array(captured.buf.getMappedRange(0, bytes)));
            mirrorGen = captured.gen;
            mirrorN = captured.n;
            hasMirror = true;
          }
          captured.buf.unmap();
          captured.busy = false;
        })
        .catch(() => {
          captured.busy = false;
        });
    }
  }

  function readInto(b: Bodies): boolean {
    if (!hasMirror || mirrorGen !== generation || mirrorN !== b.count) return false;
    const velBase = mirrorN * 4;
    for (let i = 0; i < mirrorN; i++) {
      b.x[i] = mirror[i * 4];
      b.y[i] = mirror[i * 4 + 1];
      b.z[i] = mirror[i * 4 + 2];
      b.vx[i] = mirror[velBase + i * 4];
      b.vy[i] = mirror[velBase + i * 4 + 1];
      b.vz[i] = mirror[velBase + i * 4 + 2];
    }
    return true;
  }

  function destroy(): void {
    destroyed = true;
    posBuf.destroy();
    velBuf.destroy();
    accBuf.destroy();
    paramBuf.destroy();
    for (const s of slots) s.buf.destroy();
    dev.destroy();
  }

  return {
    info,
    get lost() {
      return lost;
    },
    upload,
    step,
    readInto,
    destroy,
  };
}

/** Best-effort human-readable adapter name for the debug panel. */
function adapterInfo(adapter: GPUAdapter): string {
  const i = adapter.info;
  if (!i) return "WebGPU";
  const parts = [i.vendor, i.architecture, i.description].filter(Boolean);
  return parts.length ? `WebGPU · ${parts.join(" ")}` : "WebGPU";
}
