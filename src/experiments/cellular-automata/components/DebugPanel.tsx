import { useState, type ReactNode } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import ScrambleText from "@/components/ScrambleText";
import { Button, Panel } from "@/components/ui";
import type { CAParams, CASnapshot } from "../types";
import { matchPreset, ruleToString } from "../rules";

interface Props {
  snap: CASnapshot | null;
  params: CAParams;
  running: boolean;
  /** Rolling window of recent population samples, accumulated by the parent
   *  (from the same onStats callback that produces `snap`) so this component
   *  never needs to derive-and-setState its own history from an effect. */
  history: readonly number[];
}

const DASH = "-";
/** Tolerance for treating two population readings as "the same" (still/oscillating checks). */
const EPS = 0.008;

/**
 * Coarse, honest heuristic (not a rigorous cycle detector) read off a rolling
 * window of population samples, throttled at STATS_INTERVAL - so "period N"
 * is in *sample* units, not generation units; a fast stepsPerFrame means
 * several generations pass between samples.
 */
function caVerdict(history: readonly number[], running: boolean): string {
  if (history.length === 0) return DASH;
  const last = history[history.length - 1];
  if (last < 0.004) return "extinct";

  const n = history.length;
  if (n >= 5) {
    const recent = history.slice(-5);
    if (recent.every((v) => Math.abs(v - recent[0]) < EPS)) {
      return running ? "still (stable)" : "paused";
    }
  }
  if (n >= 8) {
    for (let lag = 2; lag <= Math.min(16, Math.floor(n / 2)); lag++) {
      let checks = 0;
      let matches = 0;
      for (let i = n - 1; i - lag >= 0; i--) {
        checks++;
        if (Math.abs(history[i] - history[i - lag]) < EPS) matches++;
      }
      if (checks >= lag * 2 && matches === checks) {
        return `oscillating (~period ${lag} readings)`;
      }
    }
  }
  if (n >= 6) {
    const recent = history.slice(-6);
    const mean = recent.reduce((s, v) => s + v, 0) / recent.length;
    const variance = recent.reduce((s, v) => s + (v - mean) ** 2, 0) / recent.length;
    if (variance > 0.01) return "chaotic";
  }
  return "evolving";
}

/**
 * Plain-text version for the clipboard. Kept English on purpose: it is meant
 * to be pasted back to Claude for debugging, not read as UI prose.
 */
function buildReport(
  snap: CASnapshot | null,
  params: CAParams,
  running: boolean,
  history: readonly number[],
): string {
  const n = (v: number | undefined, d = 3) => (snap && v != null ? v.toFixed(d) : DASH);
  const preset = matchPreset(params.genome) ?? "custom";
  return [
    "=== CELLULAR AUTOMATA DEBUG ===",
    `preset:   ${preset}`,
    `rule:     ${ruleToString(params.genome)} (birth ${params.genome.birth} | survive ${params.genome.survive} | states ${params.genome.states})`,
    `session:  boundary ${params.boundary} | brush ${params.brushMode} r${params.brushRadius} | steps/frame ${params.stepsPerFrame} | density ${(params.reseedDensity * 100).toFixed(0)}%`,
    "",
    "field (96x96 readback)",
    `  verdict ${caVerdict(history, running)}`,
    `  population ${snap ? (snap.population * 100).toFixed(1) : DASH}% | footprint ${snap ? (snap.footprint * 100).toFixed(1) : DASH}% | churn ${n(snap?.churn, 4)}`,
    `  generation ${snap ? snap.generation.toLocaleString() : DASH}`,
    "",
    "runtime",
    `  fps ${snap ? Math.round(snap.fps) : DASH} | running ${running ? "yes" : "no"}`,
    `  grid ${snap ? `${snap.simW}x${snap.simH}` : DASH} | canvas ${snap ? `${snap.w}x${snap.h} @${snap.dpr}x` : DASH}`,
    `  gpu ${snap?.gpu || DASH}`,
    "  webgl2: core integer textures only, no extension required",
  ].join("\n");
}

function Row({ k, v, hi }: { k: string; v: ReactNode; hi?: boolean }) {
  return (
    <div className="ca-dbg-row">
      <span className="ca-dbg-k">{k}</span>
      <span className={hi ? "ca-dbg-v ca-dbg-v--hi" : "ca-dbg-v"}>{v}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="ca-dbg-sec">
      <div className="ca-dbg-sec-title">{title}</div>
      {children}
    </div>
  );
}

/**
 * Debug bridge: a copyable plain-text report plus a live readout. Paste the
 * report back to Claude to describe what the field is doing wrong. Unlike
 * reaction-diffusion's stateless fieldVerdict, this needs a rolling history of
 * population samples for the oscillating/chaotic reads - `history` arrives
 * ready-made from the parent (accumulated alongside `snap` itself, in the
 * same onStats callback - never derived here via an effect).
 */
export default function DebugPanel({ snap, params, running, history }: Props) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  async function copy() {
    const text = buildReport(snap, params, running, history);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* ignore */
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  const preset = matchPreset(params.genome) ?? "custom";

  return (
    <Panel title={t("experiments.cellular-automata.debug")} defaultOpen={false}>
      <div className="ca-dbg">
        <div className="ca-dbg-top">
          <span className="ca-dbg-badge">{preset}</span>
          <Button
            size="sm"
            variant={copied ? "primary" : "ghost"}
            onClick={copy}
            tooltip={t("experiments.cellular-automata.copy_hint")}
          >
            <ScrambleText
              text={
                copied
                  ? t("experiments.cellular-automata.copied")
                  : t("experiments.cellular-automata.copy")
              }
              duration={400}
            />
          </Button>
        </div>

        <Section title="rule">
          <Row k="genome" v={ruleToString(params.genome)} hi />
          <Row k="boundary" v={params.boundary} />
          <Row k="states" v={params.genome.states} />
        </Section>

        <Section title="field">
          <Row k="verdict" v={caVerdict(history, running)} hi />
          <Row k="population" v={snap ? `${(snap.population * 100).toFixed(1)}%` : DASH} />
          <Row k="footprint" v={snap ? `${(snap.footprint * 100).toFixed(1)}%` : DASH} />
          <Row k="churn" v={snap ? `${(snap.churn * 100).toFixed(1)}%` : DASH} hi />
          <Row k="generation" v={snap ? snap.generation.toLocaleString() : DASH} />
        </Section>

        <Section title="runtime">
          <Row k="fps" v={snap ? Math.round(snap.fps) : DASH} hi />
          <Row k="running" v={running ? "yes" : "no"} />
          <Row k="grid" v={snap ? `${snap.simW}×${snap.simH}` : DASH} />
          <Row k="canvas" v={snap ? `${snap.w}×${snap.h} @${snap.dpr}x` : DASH} />
          <Row k="gpu" v={snap?.gpu ? snap.gpu.slice(0, 36) : DASH} />
        </Section>
      </div>
    </Panel>
  );
}
