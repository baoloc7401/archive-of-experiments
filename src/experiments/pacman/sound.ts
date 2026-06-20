// Classic-style Pac-Man sound effects, synthesized with the Web Audio API - no
// asset files. One shared AudioContext, created lazily on first use (after a
// user gesture, so the browser's autoplay policy is satisfied). Every cue is a
// short blip routed through a master gain that the UI can mute.

import type { SfxCue } from "./types";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = true;
/** Waka pitch toggles each chomp so the dot-eating sound alternates. */
let wakaHigh = false;

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.18;
    master.connect(ctx.destination);
  }
  return ctx;
}

/** Mute/unmute. Unmuting (a user gesture) primes and resumes the context. */
export function setMuted(next: boolean) {
  muted = next;
  if (next) {
    stopSiren();
    return;
  }
  const c = ensure();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
  // Warm up the graph with one silent sample so the first real cue is not
  // dropped while the context finishes resuming.
  const prime = c.createBufferSource();
  prime.buffer = c.createBuffer(1, 1, c.sampleRate);
  prime.connect(c.destination);
  prime.start(0);
}

// --- Ambient ghost siren ---------------------------------------------------
// A low continuous tone that hums during play and rises in pitch + volume as the
// nearest lethal ghost closes in (level 0..1). While frightened it drops to a
// flat warble. Driven once per animated frame by the view; torn down on pause,
// mute, or unmount.
let sirenOsc: OscillatorNode | null = null;
let sirenGain: GainNode | null = null;

export function setSiren(level: number, frightened: boolean) {
  if (muted) {
    stopSiren();
    return;
  }
  const c = ensure();
  if (!c || !master) return;
  if (c.state === "suspended") void c.resume();
  if (!sirenOsc || !sirenGain) {
    sirenOsc = c.createOscillator();
    sirenGain = c.createGain();
    sirenOsc.type = "sawtooth";
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(master);
    sirenOsc.start();
  }
  const lv = Math.max(0, Math.min(1, level));
  const freq = frightened ? 68 : 58 + lv * 92;
  const vol = frightened ? 0.045 : 0.012 + lv * 0.05;
  const t = c.currentTime;
  sirenOsc.frequency.setTargetAtTime(freq, t, 0.06);
  sirenGain.gain.setTargetAtTime(vol, t, 0.06);
}

export function stopSiren() {
  if (sirenOsc) {
    try {
      sirenOsc.stop();
    } catch {
      // already stopped
    }
    sirenOsc.disconnect();
    sirenOsc = null;
  }
  if (sirenGain) {
    sirenGain.disconnect();
    sirenGain = null;
  }
}

/** Release the shared context (call on unmount); it is recreated on next unmute. */
export function closeAudio() {
  stopSiren();
  if (ctx) {
    void ctx.close();
    ctx = null;
    master = null;
  }
}

/** One enveloped oscillator blip, optionally gliding its pitch. */
function tone(
  freq: number,
  when: number,
  dur: number,
  type: OscillatorType,
  peak: number,
  slideTo?: number,
) {
  const c = ctx;
  if (!c || !master) return;
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** Play one cue. No-op while muted or before audio is available. */
export function playCue(cue: SfxCue) {
  if (muted) return;
  const c = ensure();
  if (!c || !master) return;
  if (c.state === "suspended") void c.resume();
  switch (cue) {
    case "chomp":
      wakaHigh = !wakaHigh;
      tone(wakaHigh ? 320 : 210, 0, 0.055, "square", 0.45);
      break;
    case "decoy":
      // Cyan "wobble": two bright tones bouncing - a fake-out shimmer.
      tone(660, 0, 0.09, "triangle", 0.5, 520);
      tone(520, 0.08, 0.11, "triangle", 0.45, 680);
      break;
    case "freeze":
      // Cold descending shimmer.
      tone(1320, 0, 0.14, "sine", 0.3);
      tone(880, 0.02, 0.22, "sine", 0.4, 480);
      break;
    case "speed":
      // Fast upward zip.
      tone(300, 0, 0.16, "sawtooth", 0.45, 1300);
      break;
    case "energizer":
      tone(180, 0, 0.18, "sawtooth", 0.45, 440);
      tone(360, 0.05, 0.16, "square", 0.3, 720);
      break;
    case "eatghost":
      tone(200, 0, 0.2, "square", 0.5, 920);
      break;
    case "fruit":
      tone(523, 0, 0.1, "triangle", 0.5);
      tone(659, 0.09, 0.1, "triangle", 0.5);
      tone(784, 0.18, 0.15, "triangle", 0.5);
      break;
    case "fruitspawn":
      // Soft two-note chime when a bonus fruit appears.
      tone(784, 0, 0.1, "sine", 0.35);
      tone(1047, 0.09, 0.16, "sine", 0.35);
      break;
    case "frightwarn":
      // Urgent double blip: the energizer is about to wear off.
      tone(880, 0, 0.07, "square", 0.4);
      tone(880, 0.12, 0.07, "square", 0.4);
      break;
    case "extralife":
      // Bright rising 1UP jingle.
      tone(659, 0, 0.09, "square", 0.45);
      tone(880, 0.09, 0.09, "square", 0.45);
      tone(1175, 0.18, 0.09, "square", 0.45);
      tone(1319, 0.27, 0.2, "square", 0.45);
      break;
    case "trap":
      tone(170, 0, 0.26, "sawtooth", 0.5, 60);
      break;
    case "death":
      tone(460, 0, 0.5, "sawtooth", 0.5, 70);
      break;
    case "win":
      tone(523, 0, 0.12, "square", 0.5);
      tone(659, 0.12, 0.12, "square", 0.5);
      tone(784, 0.24, 0.12, "square", 0.5);
      tone(1047, 0.36, 0.22, "square", 0.5);
      break;
  }
}
