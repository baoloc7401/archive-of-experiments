import { useState, type ReactNode } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import ScrambleText from "@/components/ScrambleText";
import { Button, Panel } from "@/components/ui";
import { PRESETS } from "../constants";
import type { LParams, LSnapshot } from "../types";

interface Props {
  snap: LSnapshot | null;
  params: LParams;
  running: boolean;
  theme: string;
}

const DEG = 180 / Math.PI;
const DASH = "-";

/** Wrap a radian angle into a readable 0-359 degree integer. */
function wrapDeg(rad: number): number {
  return Math.round((((rad * DEG) % 360) + 360) % 360);
}

/** Which preset (if any) the live params still match exactly. */
function matchPreset(params: LParams): string {
  const hit = PRESETS.find(
    (p) =>
      p.axiom === params.axiom &&
      p.rules === params.rules &&
      p.angle === params.angle &&
      p.iterations === params.iterations,
  );
  return hit ? hit.id : "custom";
}

/**
 * Plain-text version for the clipboard. Kept English on purpose: it is meant to
 * be pasted back to Claude for debugging, not read as UI prose.
 */
function buildReport(snap: LSnapshot | null, params: LParams, running: boolean, theme: string): string {
  const rules = params.rules.split("\n").map((r) => r.trim()).filter(Boolean).join("  |  ");
  const n = (v: number | undefined, d = 0) => (snap && v != null ? v.toFixed(d) : DASH);
  return [
    "=== L-SYSTEM DEBUG ===",
    `preset:      ${matchPreset(params)}`,
    `axiom:       ${params.axiom}`,
    `rules:       ${rules}`,
    `iterations:  ${params.iterations}`,
    `angle:       ${params.angle}deg`,
    "",
    "geometry",
    `  symbols:   ${snap ? snap.symbolCount.toLocaleString() : DASH}`,
    `  segments:  ${snap ? snap.segments.toLocaleString() : DASH}`,
    `  max depth: ${snap ? snap.maxDepth : DASH}`,
    `  bounds:    ${snap ? `${n(snap.size.x, 1)} x ${n(snap.size.y, 1)} x ${n(snap.size.z, 1)}` : DASH} (WxHxD)`,
    "",
    "view",
    `  yaw ${snap ? wrapDeg(snap.yaw) : DASH}deg  pitch ${
      snap ? wrapDeg(snap.pitch) : DASH
    }deg  zoom ${n(snap?.zoom, 2)}  reveal ${snap ? Math.round(snap.reveal * 100) : DASH}%`,
    "",
    "style",
    `  color ${params.colorMode} | thickness ${params.thickness.toFixed(1)} | taper ${params.taper.toFixed(
      2,
    )} | fog ${params.fog.toFixed(2)}`,
    "",
    "runtime",
    `  fps ${snap ? Math.round(snap.fps) : DASH} | spin ${running ? "on" : "off"} (${params.spinSpeed.toFixed(
      2,
    )}) | grow ${params.grow ? "on" : "off"}`,
    `  theme ${theme} | canvas ${snap ? `${Math.round(snap.w)}x${Math.round(snap.h)} @${snap.dpr}x` : DASH}`,
  ].join("\n");
}

function Row({ k, v, hi }: { k: string; v: ReactNode; hi?: boolean }) {
  return (
    <div className="ls-dbg-row">
      <span className="ls-dbg-k">{k}</span>
      <span className={hi ? "ls-dbg-v ls-dbg-v--hi" : "ls-dbg-v"}>{v}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="ls-dbg-sec">
      <div className="ls-dbg-sec-title">{title}</div>
      {children}
    </div>
  );
}

export default function DebugPanel({ snap, params, running, theme }: Props) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  async function copy() {
    const text = buildReport(snap, params, running, theme);
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

  const num = (v: number | undefined, d = 0) => (snap && v != null ? v.toFixed(d) : DASH);
  const bounds = snap
    ? `${num(snap.size.x, 1)} x ${num(snap.size.y, 1)} x ${num(snap.size.z, 1)}`
    : DASH;

  return (
    <Panel title={t("experiments.l-system.debug")} defaultOpen={false}>
      <div className="ls-dbg">
        <div className="ls-dbg-top">
          <span className="ls-dbg-badge">{matchPreset(params)}</span>
          <Button
            size="sm"
            variant={copied ? "primary" : "ghost"}
            onClick={copy}
            tooltip={t("experiments.l-system.copy_hint")}
          >
            <ScrambleText
              text={copied ? t("experiments.l-system.copied") : t("experiments.l-system.copy")}
              duration={400}
            />
          </Button>
        </div>

        <div className="ls-dbg-grammar">
          <Row k="axiom" v={params.axiom} />
          <div className="ls-dbg-rules">
            <span className="ls-dbg-k">rules</span>
            <code className="ls-dbg-code">{params.rules}</code>
          </div>
          <Row k="iterations" v={params.iterations} />
          <Row k="angle" v={`${params.angle}°`} />
        </div>

        <Section title="geometry">
          <Row k="symbols" v={snap ? snap.symbolCount.toLocaleString() : DASH} hi />
          <Row k="segments" v={snap ? snap.segments.toLocaleString() : DASH} />
          <Row k="max depth" v={snap ? snap.maxDepth : DASH} />
          <Row k="bounds" v={`${bounds} ${t("experiments.l-system.debug_units")}`} />
        </Section>

        <Section title="view">
          <Row k="yaw / pitch" v={`${snap ? wrapDeg(snap.yaw) : DASH}° / ${snap ? wrapDeg(snap.pitch) : DASH}°`} />
          <Row k="zoom" v={num(snap?.zoom, 2)} />
          <Row k="reveal" v={`${snap ? Math.round(snap.reveal * 100) : DASH}%`} />
        </Section>

        <Section title="style">
          <Row k="color" v={params.colorMode} />
          <Row k="thickness" v={params.thickness.toFixed(1)} />
          <Row k="taper / fog" v={`${params.taper.toFixed(2)} / ${params.fog.toFixed(2)}`} />
        </Section>

        <Section title="runtime">
          <Row k="fps" v={snap ? Math.round(snap.fps) : DASH} hi />
          <Row k="spin / grow" v={`${running ? "on" : "off"} / ${params.grow ? "on" : "off"}`} />
          <Row k="theme" v={theme} />
          <Row k="canvas" v={snap ? `${Math.round(snap.w)}×${Math.round(snap.h)} @${snap.dpr}x` : DASH} />
        </Section>
      </div>
    </Panel>
  );
}
