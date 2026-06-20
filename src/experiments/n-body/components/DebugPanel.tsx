import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import ScrambleText from "../../../components/ScrambleText";
import { Button, Panel } from "../../../components/ui";
import { SUBSTEP } from "../constants";
import type { NBodyParams, NBodySnapshot } from "../types";

interface Props {
  snap: NBodySnapshot | null;
  params: NBodyParams;
  running: boolean;
  theme: string;
  reduced: boolean;
}

const DEG = 180 / Math.PI;
const DASH = "-";

/** Wrap a radian angle into a readable 0-359 degree integer. */
function wrapDeg(rad: number): number {
  return Math.round((((rad * DEG) % 360) + 360) % 360);
}

/**
 * Plain-text version for the clipboard. Kept English on purpose: it is meant
 * to be pasted back to Claude for debugging, not read as UI prose.
 */
function buildReport(
  snap: NBodySnapshot | null,
  params: NBodyParams,
  running: boolean,
  theme: string,
  reduced: boolean,
): string {
  const n = (v: number | undefined, d = 2) => (snap && v != null ? v.toFixed(d) : DASH);
  return [
    "=== N-BODY DEBUG ===",
    `preset:     ${params.preset} | bodies ${snap ? snap.count.toLocaleString() : DASH} (req ${params.count})`,
    `engine:     ${snap?.gpuActive ? "gpu (webgpu brute-force)" : "cpu (barnes-hut)"}`,
    `physics:    G ${params.gravity.toFixed(1)} | eps ${params.softening.toFixed(3)} | theta ${params.theta.toFixed(2)} | ${params.integrator} | h ${SUBSTEP} | merge ${params.merging ? "on" : "off"}`,
    `time:       scale ${params.timeScale.toFixed(1)}x | simTime ${n(snap?.simTime, 1)}s`,
    "",
    "energy",
    `  total ${snap ? snap.total.toExponential(3) : DASH} | kinetic ${snap ? snap.kinetic.toExponential(3) : DASH} | drift ${snap ? (snap.drift * 100).toFixed(3) : DASH}%`,
    `  evals/substep ${snap ? snap.evals.toLocaleString() : DASH} (${n(snap?.evalsPct, 1)}% of exact)`,
    "",
    "view",
    `  yaw ${snap ? wrapDeg(snap.yaw) : DASH}deg  pitch ${snap ? wrapDeg(snap.pitch) : DASH}deg  zoom ${n(snap?.zoom)}  follow ${snap && snap.follow >= 0 ? `#${snap.follow} (m ${snap.followMass.toExponential(1)}, v ${n(snap?.followSpeed)})` : "off"}`,
    "",
    "look",
    `  color ${params.colorMode} | trails ${params.trails.toFixed(1)}s | spin ${params.spin ? "on" : "off"}`,
    "",
    "runtime",
    `  fps ${snap ? Math.round(snap.fps) : DASH} | running ${running ? "yes" : "no"} | reduced-motion ${reduced ? "yes" : "no"} | theme ${theme}`,
    `  canvas ${snap ? `${Math.round(snap.w)}x${Math.round(snap.h)} @${snap.dpr}x` : DASH}`,
    `  gpu ${snap?.gpu || DASH}`,
  ].join("\n");
}

function Row({ k, v, hi }: { k: string; v: ReactNode; hi?: boolean }) {
  return (
    <div className="nb-dbg-row">
      <span className="nb-dbg-k">{k}</span>
      <span className={hi ? "nb-dbg-v nb-dbg-v--hi" : "nb-dbg-v"}>{v}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="nb-dbg-sec">
      <div className="nb-dbg-sec-title">{title}</div>
      {children}
    </div>
  );
}

export default function DebugPanel({ snap, params, running, theme, reduced }: Props) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  async function copy() {
    const text = buildReport(snap, params, running, theme, reduced);
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

  const num = (v: number | undefined, d = 2) => (snap && v != null ? v.toFixed(d) : DASH);

  return (
    <Panel title={t("experiments.n-body.debug")} defaultOpen={false}>
      <div className="nb-dbg">
        <div className="nb-dbg-top">
          <span className="nb-dbg-badge">{params.preset}</span>
          <Button
            size="sm"
            variant={copied ? "primary" : "ghost"}
            onClick={copy}
            tooltip={t("experiments.n-body.copy_hint")}
          >
            <ScrambleText
              text={copied ? t("experiments.n-body.copied") : t("experiments.n-body.copy")}
              duration={400}
            />
          </Button>
        </div>

        <Section title="physics">
          <Row k="engine" v={snap?.gpuActive ? "gpu (webgpu)" : "cpu (barnes-hut)"} hi />
          <Row k="bodies" v={snap ? snap.count.toLocaleString() : DASH} />
          <Row k="G / eps" v={`${params.gravity.toFixed(1)} / ${params.softening.toFixed(3)}`} />
          <Row k="theta" v={params.theta === 0 ? "0 (exact)" : params.theta.toFixed(2)} />
          <Row k="integrator" v={params.integrator} />
          <Row k="merging" v={params.merging ? "on" : "off"} />
        </Section>

        <Section title="energy">
          <Row k="total" v={snap ? snap.total.toExponential(3) : DASH} />
          <Row k="drift" v={snap ? `${(snap.drift * 100).toFixed(3)}%` : DASH} hi />
          <Row k="evals" v={snap ? `${snap.evals.toLocaleString()} (${num(snap?.evalsPct, 1)}%)` : DASH} />
        </Section>

        <Section title="view">
          <Row k="yaw / pitch" v={`${snap ? wrapDeg(snap.yaw) : DASH}° / ${snap ? wrapDeg(snap.pitch) : DASH}°`} />
          <Row k="zoom" v={num(snap?.zoom)} />
          <Row k="follow" v={snap && snap.follow >= 0 ? `#${snap.follow}` : "off"} />
        </Section>

        <Section title="runtime">
          <Row k="fps" v={snap ? Math.round(snap.fps) : DASH} hi />
          <Row k="sim time" v={snap ? `${snap.simTime.toFixed(1)}s` : DASH} />
          <Row k="theme" v={theme} />
          <Row k="canvas" v={snap ? `${Math.round(snap.w)}×${Math.round(snap.h)} @${snap.dpr}x` : DASH} />
          <Row k="gpu" v={snap?.gpu ? snap.gpu.slice(0, 36) : DASH} />
        </Section>
      </div>
    </Panel>
  );
}
