import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import ScrambleText from "../../components/ScrambleText";
import { ExperimentLayout } from "../../components/ui";
import { useTheme } from "../../hooks/useTheme";
import type { AcoParams, ColonySnapshot, LayoutId, LogEntry, Point } from "./types";
import {
  DEFAULT_PARAMS,
  DEFAULT_LAYOUT,
  DEFAULT_CITY_COUNT,
  DEFAULT_SPEED,
} from "./constants";
import { generateCities } from "./layouts";
import ColonyCanvas, { type ColonyHandle } from "./components/ColonyCanvas";
import Controls from "./components/Controls";
import Params from "./components/Params";
import Setup from "./components/Setup";
import Stats from "./components/Stats";
import Legend from "./components/Legend";
import DebugLog from "./components/DebugLog";
import "./Aco.css";

export default function Aco() {
  const { t } = useTranslation();
  const { theme } = useTheme();

  const [layout, setLayout] = useState<LayoutId>(DEFAULT_LAYOUT);
  const [count, setCount] = useState(DEFAULT_CITY_COUNT);
  const [cities, setCities] = useState<Point[]>(() =>
    generateCities(DEFAULT_LAYOUT, DEFAULT_CITY_COUNT),
  );
  const [params, setParams] = useState<AcoParams>(DEFAULT_PARAMS);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [trail, setTrail] = useState(70); // pheromone-web visibility (view-only)
  const [resetKey, setResetKey] = useState(0);
  const [snap, setSnap] = useState<ColonySnapshot | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);

  const canvasRef = useRef<ColonyHandle>(null);
  const logIdRef = useRef(0);
  const lastBestRef = useRef(Infinity); // last logged best length
  const convergedRef = useRef(false);

  const pushLog = useCallback((kind: LogEntry["kind"], text: string, iter: number | null = null) => {
    setLog((prev) => {
      const next = [...prev, { id: ++logIdRef.current, iter, kind, text }];
      return next.length > 600 ? next.slice(-600) : next;
    });
  }, []);

  // Reset the derived-event trackers whenever the colony is rebuilt/reset.
  const resetTrackers = useCallback(() => {
    lastBestRef.current = Infinity;
    convergedRef.current = false;
  }, []);

  // Derive "new best" and "converged" events from the stats stream.
  useEffect(() => {
    if (!snap) return;
    if (Number.isFinite(snap.bestLength) && snap.bestLength < lastBestRef.current - 1e-6) {
      lastBestRef.current = snap.bestLength;
      const gain = snap.nnLength > 0 ? ((snap.nnLength - snap.bestLength) / snap.nnLength) * 100 : 0;
      pushLog(
        "best",
        `new best ${Math.round(snap.bestLength).toLocaleString()} (${gain >= 0 ? "−" : "+"}${Math.abs(gain).toFixed(1)}% vs greedy)`,
        snap.iteration,
      );
    }
    if (snap.converged && !convergedRef.current) {
      convergedRef.current = true;
      pushLog("milestone", `converged · best ${Math.round(snap.bestLength).toLocaleString()}`, snap.iteration);
    } else if (!snap.converged) {
      convergedRef.current = false;
    }
  }, [snap, pushLog]);

  const scatter = useCallback(() => {
    setRunning(false);
    resetTrackers();
    setCities(generateCities(layout, count));
    pushLog("setup", `scatter · ${count} cities · ${layout}`, null);
  }, [layout, count, pushLog, resetTrackers]);

  function handleLayout(id: LayoutId) {
    setLayout(id);
    setRunning(false);
    resetTrackers();
    setCities(generateCities(id, count));
    pushLog("setup", `layout → ${id} · ${count} cities`, null);
  }

  function handleCount(n: number) {
    setCount(n);
    setRunning(false);
    resetTrackers();
    setCities(generateCities(layout, n));
  }

  function handleClear() {
    setRunning(false);
    resetTrackers();
    setCities([]);
    setSnap(null);
    pushLog("setup", "cleared board", null);
  }

  function handleAddCity(p: Point) {
    setRunning(false);
    resetTrackers();
    setCities((prev) => {
      pushLog("setup", `+city (${p.x.toFixed(2)}, ${p.y.toFixed(2)}) · ${prev.length + 1} total`, null);
      return [...prev, p];
    });
  }

  function handleParams(patch: Partial<AcoParams>) {
    setParams((prev) => ({ ...prev, ...patch }));
    if (patch.elitist !== undefined) {
      pushLog("setup", `elitist ${patch.elitist ? "on" : "off"}`, snap?.iteration ?? null);
    }
  }

  function handlePlayPause() {
    if (cities.length < 2) return; // can't run with fewer than two cities
    setRunning((r) => {
      const next = !r;
      pushLog("run", next ? "run started" : "paused", snap?.iteration ?? null);
      return next;
    });
  }

  function handleReset() {
    setRunning(false);
    resetTrackers();
    setSnap(null);
    setResetKey((k) => k + 1);
    pushLog("setup", "pheromone reset", null);
  }

  // Assemble the full copyable report on demand (heavy colony dump included).
  const buildReport = useCallback((): string => {
    const d = canvasRef.current?.dump();
    const lines: string[] = [];
    lines.push("ant colony optimization — TSP — debug report");
    lines.push(new Date().toISOString());
    lines.push("─".repeat(50));
    lines.push("[environment]");
    lines.push(`cities=${cities.length} layout=${layout} count=${count} speed=${speed} trail=${trail} running=${running} theme=${theme}`);
    lines.push("[params]");
    lines.push(`ants=${params.ants} alpha=${params.alpha} beta=${params.beta} rho=${params.rho} elitist=${params.elitist}`);
    if (d) {
      lines.push("[colony]");
      lines.push(`iteration=${d.iteration} converged=${d.converged}`);
      lines.push(`best=${d.bestLength} genBest=${d.lastBestLength} genAvg=${d.lastAvgLength} greedyNN=${d.nnLength}`);
      if (Number.isFinite(d.bestLength) && d.nnLength > 0) {
        const gain = ((d.nnLength - d.bestLength) / d.nnLength) * 100;
        lines.push(`gain_vs_greedy=${gain.toFixed(2)}%`);
      }
      lines.push(`[pheromone] tau0=${d.tau0} min=${d.pheromone.min} max=${d.pheromone.max} mean=${d.pheromone.mean} aboveHalf=${d.pheromone.aboveHalf}/${d.pheromone.edges}`);
      lines.push(`[anim] progress=${d.progress} genActive=${d.genActive} canvas=${d.canvas.w}x${d.canvas.h}@${d.canvas.dpr}x`);
      if (d.bestPath) lines.push(`[bestPath] ${d.bestPath.join(" ")}`);
      lines.push(`[cities xy] ${d.cityCoords.map(([x, y]) => `(${x},${y})`).join(" ")}`);
    } else {
      lines.push("[colony] (no colony — fewer than 2 cities)");
    }
    if (snap?.history?.length) {
      const tail = snap.history.slice(-24).map((v) => Math.round(v));
      lines.push(`[best-history tail] ${tail.join(" ")}`);
    }
    lines.push("─".repeat(50));
    lines.push(`[events] (${log.length} total, last 60)`);
    for (const e of log.slice(-60)) {
      lines.push(`${e.iter != null ? `i${e.iter}` : "—"}\t${e.kind}\t${e.text}`);
    }
    return lines.join("\n");
  }, [cities, layout, count, speed, trail, running, theme, params, snap, log]);

  const disabled = cities.length < 2;

  return (
    <ExperimentLayout
      crumbs={[
        { label: t("experiments.aco.title").toLowerCase(), to: "/experiments/aco" },
        { label: t("experiments.aco.subtitle") },
      ]}
      info={
        <>
          <div className="aco-info-tagline">
            <ScrambleText text={t("experiments.aco.tagline")} duration={600} />
          </div>
          <div className="aco-info-desc">
            <ScrambleText text={t("experiments.aco.intro")} duration={600} />
          </div>
        </>
      }
      sidebar={
        <>
          <Controls
            running={running}
            disabled={disabled}
            speed={speed}
            trail={trail}
            onPlayPause={handlePlayPause}
            onStep={() => canvasRef.current?.step()}
            onReset={handleReset}
            onSpeed={setSpeed}
            onTrail={setTrail}
          />
          <Stats snap={snap} theme={theme} />
          <Params params={params} onChange={handleParams} />
          <Setup
            layout={layout}
            count={count}
            onLayout={handleLayout}
            onCount={handleCount}
            onScatter={scatter}
            onClear={handleClear}
          />
          <DebugLog entries={log} buildReport={buildReport} onClear={() => setLog([])} />
          <div className="aco-hint">
            <ScrambleText text={t("experiments.aco.hint")} duration={600} />
          </div>
        </>
      }
    >
      <ColonyCanvas
        ref={canvasRef}
        cities={cities}
        params={params}
        running={running}
        speed={speed}
        trail={trail}
        theme={theme}
        resetKey={resetKey}
        onStats={setSnap}
        onAddCity={handleAddCity}
      />
      <Legend />
      {disabled && (
        <div className="aco-empty">
          <ScrambleText
            text={
              cities.length === 0
                ? t("experiments.aco.empty_place")
                : t("experiments.aco.empty_add")
            }
            duration={600}
          />
        </div>
      )}
    </ExperimentLayout>
  );
}
