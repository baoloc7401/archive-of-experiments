import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import ScrambleText from "../../../components/ScrambleText";
import type { Config, PuzzleState, SearchStep, StateGraph } from "../types";
import { SEARCH_STEP_MS } from "../constants";
import { startState, stateKey } from "../solver";

interface Props {
  cfg: Config;
  graph: StateGraph;
  /** the materialized search trace - one frame per node expansion */
  steps: SearchStep[];
  algo: string;
  speedIndex: number;
  /** boat-glide duration, so the graph token (and edge draw) match the scene */
  crossMs: number;
  /** live game position */
  state: PuzzleState;
  crossing: boolean;
  /** where the boat is gliding mid-crossing (null when docked) */
  crossTarget: PuzzleState | null;
  /** the ferry auto-player is running */
  isPlaying: boolean;
  /** states the boat has visited, start → current - the trail drawn so far */
  traveled: PuzzleState[];
}

const VB_W = 100;
const VB_H = 64;
const MX = 8;
const MY = 9;
const R = 2.3;
const GLIDE_EASE = "cubic-bezier(0.45, 0.05, 0.3, 1)";

interface XY {
  x: number;
  y: number;
}

function edgeKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Watch the search itself, and follow the ferry as it solves. The reachable
 * state graph is drawn as a node-link diagram; two modes share it:
 *  • **live** (default / while solve & play runs) - the boat token glides edge to
 *    edge and the path is *drawn behind it one segment at a time* as each node is
 *    reached, mirroring the river scene rather than revealing the whole route up
 *    front;
 *  • **explore** - the search transport (◀ / play / ▶) replays the frontier
 *    swelling (BFS) or diving (DFS).
 */
export default function SearchGraph({
  cfg,
  graph,
  steps,
  algo,
  speedIndex,
  crossMs,
  state,
  crossing,
  crossTarget,
  isPlaying,
  traveled,
}: Props) {
  const { t } = useTranslation();
  const [exploreIdx, setExploreIdx] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);

  // A fresh search (config/algorithm change, or each committed crossing) returns
  // to the live view. Sanctioned "adjust state from props during render" pattern.
  const [prevSteps, setPrevSteps] = useState(steps);
  if (steps !== prevSteps) {
    setPrevSteps(steps);
    setExploreIdx(null);
    setPlaying(false);
  }

  const last = steps.length - 1;
  const liveMode = exploreIdx === null || isPlaying;
  const displayIdx = liveMode ? last : Math.min(exploreIdx, last);
  const step = steps[displayIdx];
  const stepMs = SEARCH_STEP_MS[speedIndex] ?? 380;

  // auto-advance the exploration; halts when the ferry takes over or at the end.
  useEffect(() => {
    if (!playing || liveMode || exploreIdx === null || exploreIdx >= last) return;
    const id = window.setTimeout(() => {
      setExploreIdx((c) => (c === null ? null : Math.min(c + 1, last)));
      if (exploreIdx + 1 >= last) setPlaying(false);
    }, stepMs);
    return () => window.clearTimeout(id);
  }, [playing, liveMode, exploreIdx, last, stepMs]);

  const startKey = stateKey(startState(cfg));
  const goalKey = "0,0,R";

  // grid layout: x by missionaries-left (start → goal flows left → right),
  // y by cannibals-left, the two boat sides offset within each cell.
  const pos = useMemo(() => {
    const map = new Map<string, XY>();
    const spanX = VB_W - 2 * MX;
    const spanY = VB_H - 2 * MY;
    const dx = Math.min(2.6, (cfg.m > 0 ? spanX / cfg.m : spanX) * 0.16);
    for (const n of graph.nodes) {
      const fx = cfg.m > 0 ? (cfg.m - n.ml) / cfg.m : 0.5;
      const fy = cfg.c > 0 ? n.cl / cfg.c : 0.5;
      const x = MX + fx * spanX + (n.boat === "L" ? -dx : dx);
      const y = MY + fy * spanY;
      map.set(stateKey(n), { x, y });
    }
    return map;
  }, [graph, cfg]);

  const closed = useMemo(() => new Set(step.closed), [step]);
  const frontier = useMemo(() => new Set(step.frontier), [step]);
  const expandingKey = step.expanded ? stateKey(step.expanded) : null;

  // the trail already walked - committed edges drawn solid, the in-flight edge
  // (state → crossTarget) drawn on as the boat glides.
  const traveledKeys = useMemo(() => traveled.map(stateKey), [traveled]);
  const traveledSet = useMemo(() => new Set(traveledKeys), [traveledKeys]);
  const traveledEdges = useMemo(() => {
    const s = new Set<string>();
    for (let i = 0; i + 1 < traveledKeys.length; i++) {
      s.add(edgeKey(traveledKeys[i], traveledKeys[i + 1]));
    }
    return s;
  }, [traveledKeys]);
  const activeKey =
    liveMode && crossing && crossTarget ? edgeKey(stateKey(state), stateKey(crossTarget)) : null;

  const exploreMode = !liveMode;

  function nodeTint(k: string): string {
    if (exploreMode) {
      if (frontier.has(k)) return "rc-gnode--frontier";
      if (closed.has(k)) return "rc-gnode--closed";
      return "rc-gnode--unseen";
    }
    if (traveledSet.has(k)) return "rc-gnode--route";
    return "rc-gnode--idle";
  }

  const startPos = pos.get(startKey);
  const goalPos = pos.get(goalKey);
  const expandingPos = exploreMode && expandingKey ? pos.get(expandingKey) : undefined;
  const tokenState = crossing && crossTarget ? crossTarget : state;
  const tokenPos = pos.get(stateKey(tokenState)) ?? pos.get(stateKey(state));
  const tokenMs = crossing ? crossMs : 240;

  // ── controls ───────────────────────────────────────────────────────────────
  const di = displayIdx;
  const atEnd = di >= last;
  function playPause() {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (exploreIdx === null || exploreIdx >= last) setExploreIdx(0);
    setPlaying(true);
  }
  function back() {
    setPlaying(false);
    setExploreIdx((c) => Math.max(0, (c === null ? last : c) - 1));
  }
  function forward() {
    setPlaying(false);
    setExploreIdx((c) => Math.min(last, (c === null ? last : c) + 1));
  }
  function goLive() {
    setPlaying(false);
    setExploreIdx(null);
  }

  const playLabel = playing
    ? t("experiments.river-crossing.search.pause")
    : exploreIdx !== null && exploreIdx >= last
      ? t("experiments.river-crossing.search.replay")
      : t("experiments.river-crossing.search.play");

  const legendItems = liveMode
    ? (["live", "route", "start", "goal"] as const)
    : (["frontier", "expanded", "current", "start", "goal"] as const);

  return (
    <section className="rc-graph">
      <div className="rc-graph-head">
        <span className="rc-panel-head rc-panel-head--inline">
          <ScrambleText text={t("experiments.river-crossing.search.title")} duration={500} />
        </span>
        <span className="rc-graph-algo">
          <ScrambleText
            text={t(`experiments.river-crossing.search.algos.${algo}.name`)}
            duration={450}
          />
        </span>
      </div>

      <svg
        className="rc-graph-svg"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        role="img"
        aria-label={t("experiments.river-crossing.search.graph_label", {
          m: cfg.m,
          c: cfg.c,
          k: cfg.k,
        })}
      >
        <g className="rc-graph-edges">
          {graph.edges.map((e) => {
            const a = pos.get(e.a);
            const b = pos.get(e.b);
            if (!a || !b) return null;
            return (
              <line
                key={edgeKey(e.a, e.b)}
                className="rc-gedge"
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
              />
            );
          })}
        </g>

        <g className="rc-graph-nodes">
          {graph.nodes.map((n) => {
            const k = stateKey(n);
            const p = pos.get(k);
            if (!p) return null;
            return (
              <circle key={k} className={`rc-gnode ${nodeTint(k)}`} cx={p.x} cy={p.y} r={R}>
                <title>
                  {t("experiments.river-crossing.search.node_title", {
                    ml: n.ml,
                    cl: n.cl,
                    mr: cfg.m - n.ml,
                    cr: cfg.c - n.cl,
                    boat: n.boat,
                  })}
                </title>
              </circle>
            );
          })}
        </g>

        {/* the trail rides ABOVE the node dots so the path is never hidden under one */}
        {liveMode && (
          <g className="rc-graph-route">
            {graph.edges.map((e) => {
              const ek = edgeKey(e.a, e.b);
              const drawing = ek === activeKey;
              const onTrail = traveledEdges.has(ek);
              if (!drawing && !onTrail) return null;
              const a = pos.get(e.a);
              const b = pos.get(e.b);
              if (!a || !b) return null;
              return (
                <line
                  key={ek}
                  className={`rc-gedge ${drawing ? "rc-gedge--drawing" : "rc-gedge--route"}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  pathLength={drawing ? 1 : undefined}
                  style={drawing ? { animationDuration: `${crossMs}ms` } : undefined}
                />
              );
            })}
          </g>
        )}

        {/* overlays: start / goal markers, expansion pulse, gliding boat token */}
        {startPos && (
          <circle className="rc-gmark rc-gmark--start" cx={startPos.x} cy={startPos.y} r={R + 1.5} />
        )}
        {goalPos && (
          <circle className="rc-gmark rc-gmark--goal" cx={goalPos.x} cy={goalPos.y} r={R + 1.5} />
        )}
        {expandingPos && (
          <g
            className="rc-gring"
            style={{ transform: `translate(${expandingPos.x}px, ${expandingPos.y}px)` }}
          >
            <circle r={R} />
          </g>
        )}
        {liveMode && tokenPos && (
          <g
            className={`rc-gtoken${crossing ? " rc-gtoken--crossing" : ""}`}
            style={{
              transform: `translate(${tokenPos.x}px, ${tokenPos.y}px)`,
              transition: `transform ${tokenMs}ms ${GLIDE_EASE}`,
            }}
          >
            <circle className="rc-gtoken-halo" r={R + 1.6} />
            <circle className="rc-gtoken-dot" r={R - 0.2} />
          </g>
        )}
      </svg>

      <div className="rc-graph-legend">
        {legendItems.map((item) => (
          <span key={item} className={`rc-glegend rc-glegend--${item}`}>
            {t(`experiments.river-crossing.search.legend.${item}`)}
          </span>
        ))}
      </div>

      <div className="rc-graph-controls">
        <button
          type="button"
          className="rc-btn"
          onClick={back}
          disabled={di <= 0}
          aria-label={t("experiments.river-crossing.search.back")}
        >
          ◀
        </button>
        <button type="button" className="rc-btn rc-btn--primary" onClick={playPause}>
          <ScrambleText text={playLabel} duration={450} />
        </button>
        <button
          type="button"
          className="rc-btn"
          onClick={forward}
          disabled={atEnd}
          aria-label={t("experiments.river-crossing.search.forward")}
        >
          ▶
        </button>
        <button
          type="button"
          className="rc-btn rc-btn--accent"
          onClick={goLive}
          disabled={exploreIdx === null}
        >
          <ScrambleText text={t("experiments.river-crossing.search.live")} duration={450} />
        </button>
      </div>

      <div className="rc-graph-stats">
        <span>
          {t("experiments.river-crossing.search.step")} <b>{di + 1}</b>/{steps.length}
        </span>
        <span>
          {t("experiments.river-crossing.search.expanded")} <b>{step.expandedCount}</b>
        </span>
        <span>
          {t("experiments.river-crossing.search.frontier")} <b>{step.frontier.length}</b>
        </span>
        {step.limit != null && (
          <span>
            {t("experiments.river-crossing.search.depth_limit")} <b>{step.limit}</b>
          </span>
        )}
      </div>
    </section>
  );
}
