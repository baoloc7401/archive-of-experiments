import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import ScrambleText from "../../../components/ScrambleText";
import { Button, Panel } from "../../../components/ui";
import type { RDParams, RDSnapshot } from "../types";
import { matchPreset } from "../presets";

interface Props {
  snap: RDSnapshot | null;
  params: RDParams;
  running: boolean;
}

const DASH = "-";

/** One-word read of the field state, derived from the readback aggregates. */
function fieldVerdict(snap: RDSnapshot | null, running: boolean): string {
  if (!snap) return DASH;
  if (snap.maxV < 0.02) return "empty (field died)";
  if (snap.active > 0.9 && snap.maxV > 0.6) return "saturated (blew up?)";
  if (snap.active < 0.02) return "near-empty";
  // While running, a delta near zero means the field has stopped evolving.
  if (running && snap.delta < 0.0005) return "patterned (static!)";
  return "patterned";
}

/**
 * Plain-text version for the clipboard. Kept English on purpose: it is meant to
 * be pasted back to Claude for debugging, not read as UI prose.
 */
function buildReport(snap: RDSnapshot | null, params: RDParams, running: boolean): string {
  const n = (v: number | undefined, d = 3) => (snap && v != null ? v.toFixed(d) : DASH);
  const preset = matchPreset(params.feed, params.kill) ?? "custom";
  return [
    "=== REACTION-DIFFUSION DEBUG ===",
    `preset:   ${preset}`,
    `reaction: f ${params.feed.toFixed(4)} | k ${params.kill.toFixed(4)} | dU ${params.du.toFixed(2)} | dV ${params.dv.toFixed(2)} | dt ${params.dt.toFixed(2)}`,
    `look:     palette ${params.palette} | brush ${params.brushSize} | steps/frame ${params.stepsPerFrame}`,
    "",
    "field (96x96 readback)",
    `  verdict ${fieldVerdict(snap, running)}`,
    `  meanU ${n(snap?.meanU)} | meanV ${n(snap?.meanV)} | maxV ${n(snap?.maxV)} | active ${snap ? (snap.active * 100).toFixed(1) : DASH}%`,
    `  delta ${n(snap?.delta, 4)} (V change/sample) | steps ${snap ? snap.steps.toLocaleString() : DASH}`,
    "",
    "runtime",
    `  fps ${snap ? Math.round(snap.fps) : DASH} | running ${running ? "yes" : "no"}`,
    `  grid ${snap ? `${snap.simW}x${snap.simH}` : DASH} | canvas ${snap ? `${snap.w}x${snap.h} @${snap.dpr}x` : DASH}`,
    `  float ${snap?.floatExt || DASH}`,
    `  gpu ${snap?.gpu || DASH}`,
  ].join("\n");
}

function Row({ k, v, hi }: { k: string; v: ReactNode; hi?: boolean }) {
  return (
    <div className="rd-dbg-row">
      <span className="rd-dbg-k">{k}</span>
      <span className={hi ? "rd-dbg-v rd-dbg-v--hi" : "rd-dbg-v"}>{v}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rd-dbg-sec">
      <div className="rd-dbg-sec-title">{title}</div>
      {children}
    </div>
  );
}

/**
 * Debug bridge: a copyable plain-text report plus a live readout. Paste the
 * report back to Claude to describe what the field is doing wrong.
 */
export default function DebugPanel({ snap, params, running }: Props) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  async function copy() {
    const text = buildReport(snap, params, running);
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

  const num = (v: number | undefined, d = 3) => (snap && v != null ? v.toFixed(d) : DASH);
  const preset = matchPreset(params.feed, params.kill) ?? "custom";

  return (
    <Panel title={t("experiments.reaction-diffusion.debug")} defaultOpen={false}>
      <div className="rd-dbg">
        <div className="rd-dbg-top">
          <span className="rd-dbg-badge">{preset}</span>
          <Button
            size="sm"
            variant={copied ? "primary" : "ghost"}
            onClick={copy}
            tooltip={t("experiments.reaction-diffusion.copy_hint")}
          >
            <ScrambleText
              text={
                copied
                  ? t("experiments.reaction-diffusion.copied")
                  : t("experiments.reaction-diffusion.copy")
              }
              duration={400}
            />
          </Button>
        </div>

        <Section title="reaction">
          <Row k="f / k" v={`${params.feed.toFixed(4)} / ${params.kill.toFixed(4)}`} hi />
          <Row k="dU / dV" v={`${params.du.toFixed(2)} / ${params.dv.toFixed(2)}`} />
          <Row k="dt" v={params.dt.toFixed(2)} />
        </Section>

        <Section title="field">
          <Row k="verdict" v={fieldVerdict(snap, running)} hi />
          <Row k="mean U / V" v={`${num(snap?.meanU)} / ${num(snap?.meanV)}`} />
          <Row k="max V" v={num(snap?.maxV)} />
          <Row k="active" v={snap ? `${(snap.active * 100).toFixed(1)}%` : DASH} />
          <Row k="delta" v={num(snap?.delta, 4)} hi />
          <Row k="steps" v={snap ? snap.steps.toLocaleString() : DASH} />
        </Section>

        <Section title="runtime">
          <Row k="fps" v={snap ? Math.round(snap.fps) : DASH} hi />
          <Row k="running" v={running ? "yes" : "no"} />
          <Row k="grid" v={snap ? `${snap.simW}×${snap.simH}` : DASH} />
          <Row k="canvas" v={snap ? `${snap.w}×${snap.h} @${snap.dpr}x` : DASH} />
          <Row k="float" v={snap?.floatExt ? snap.floatExt.replace("EXT_color_buffer_", "") : DASH} />
          <Row k="gpu" v={snap?.gpu ? snap.gpu.slice(0, 36) : DASH} />
        </Section>
      </div>
    </Panel>
  );
}
