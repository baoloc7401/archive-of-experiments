import { useEffect, useMemo, useState } from "react";
import ScrambleText from "../../../components/ScrambleText";
import type { Config, SearchAlgo, SearchResult, SearchStep, StateGraph } from "../types";
import { ALGO_BY_ID, SEARCH_STEP_MS } from "../constants";
import { stateKey, startState } from "../solver";

interface Props {
  cfg: Config;
  graph: StateGraph;
  /** the materialized search trace — one frame per node expansion */
  steps: SearchStep[];
  solution: SearchResult;
  algo: SearchAlgo;
  speedIndex: number;
}

const VB_W = 100;
const VB_H = 64;
const MX = 8;
const MY = 9;
const R = 2.3;

interface XY {
  x: number;
  y: number;
}

/**
 * Watch the search itself. The reachable state graph is drawn as a node-link
 * diagram (missionaries-on-left across, cannibals-on-left down, the boat side
 * splitting each cell), and the materialized trace is replayed step by step so
 * the frontier visibly swells (BFS) or dives (DFS) before the path is revealed.
 */
export default function SearchGraph({ cfg, graph, steps, solution, algo, speedIndex }: Props) {
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);

  const last = steps.length - 1;
  const safeCursor = Math.min(cursor, last);
  const step = steps[safeCursor];
  const stepMs = SEARCH_STEP_MS[speedIndex] ?? 380;
  const meta = ALGO_BY_ID[algo];

  // auto-advance one frame at a time; stop on the last frame.
  useEffect(() => {
    if (!playing || safeCursor >= last) return;
    const id = window.setTimeout(() => {
      setCursor((c) => Math.min(c + 1, last));
      if (safeCursor + 1 >= last) setPlaying(false);
    }, stepMs);
    return () => window.clearTimeout(id);
  }, [playing, safeCursor, last, stepMs]);

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
  const discovered = useMemo(() => new Set(step.discovered), [step]);
  const currentKey = step.expanded ? stateKey(step.expanded) : null;

  const atEnd = safeCursor >= last;
  const pathKeys = useMemo(
    () => (solution.solvable ? solution.path.map(stateKey) : []),
    [solution]
  );
  const pathSet = useMemo(() => new Set(pathKeys), [pathKeys]);
  const pathEdges = useMemo(() => {
    const s = new Set<string>();
    for (let i = 0; i + 1 < pathKeys.length; i++) {
      const a = pathKeys[i];
      const b = pathKeys[i + 1];
      s.add(a < b ? `${a}|${b}` : `${b}|${a}`);
    }
    return s;
  }, [pathKeys]);

  function nodeClass(k: string): string {
    let cls = "rc-gnode";
    if (k === currentKey) cls += " rc-gnode--current";
    else if (frontier.has(k)) cls += " rc-gnode--frontier";
    else if (closed.has(k)) cls += " rc-gnode--closed";
    else if (!discovered.has(k)) cls += " rc-gnode--unseen";
    if (atEnd && pathSet.has(k)) cls += " rc-gnode--path";
    if (k === startKey) cls += " rc-gnode--start";
    if (k === goalKey) cls += " rc-gnode--goal";
    return cls;
  }

  function play() {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (atEnd) setCursor(0);
    setPlaying(true);
  }
  function stepBack() {
    setPlaying(false);
    setCursor((c) => Math.max(0, Math.min(c, last) - 1));
  }
  function stepForward() {
    setPlaying(false);
    setCursor((c) => Math.min(c + 1, last));
  }
  function restart() {
    setPlaying(false);
    setCursor(0);
  }

  return (
    <section className="rc-graph">
      <div className="rc-graph-head">
        <span className="rc-panel-head rc-panel-head--inline">state-space search</span>
        <span className="rc-graph-algo">
          <ScrambleText text={meta.name} duration={450} />
        </span>
      </div>

      <svg
        className="rc-graph-svg"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        role="img"
        aria-label={`state graph for ${cfg.m} missionaries, ${cfg.c} cannibals, boat ${cfg.k}`}
      >
        <g className="rc-graph-edges">
          {graph.edges.map((e) => {
            const a = pos.get(e.a);
            const b = pos.get(e.b);
            if (!a || !b) return null;
            const ek = e.a < e.b ? `${e.a}|${e.b}` : `${e.b}|${e.a}`;
            const onPath = atEnd && pathEdges.has(ek);
            return (
              <line
                key={ek}
                className={`rc-gedge${onPath ? " rc-gedge--path" : ""}`}
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
            const r = rightOf(cfg, n);
            return (
              <circle key={k} className={nodeClass(k)} cx={p.x} cy={p.y} r={R}>
                <title>{`L: ${n.ml}M ${n.cl}C · R: ${r.m}M ${r.c}C · boat ${n.boat}`}</title>
              </circle>
            );
          })}
        </g>
      </svg>

      <div className="rc-graph-legend">
        <span className="rc-glegend rc-glegend--start">start</span>
        <span className="rc-glegend rc-glegend--goal">goal</span>
        <span className="rc-glegend rc-glegend--frontier">frontier</span>
        <span className="rc-glegend rc-glegend--closed">expanded</span>
        <span className="rc-glegend rc-glegend--current">current</span>
        <span className="rc-glegend rc-glegend--path">solution</span>
      </div>

      <div className="rc-graph-controls">
        <button type="button" className="rc-btn" onClick={stepBack} disabled={safeCursor === 0}>
          ◀
        </button>
        <button type="button" className="rc-btn rc-btn--primary" onClick={play}>
          <ScrambleText text={playing ? "⏸ pause" : atEnd ? "↻ replay" : "▶ play"} duration={450} />
        </button>
        <button type="button" className="rc-btn" onClick={stepForward} disabled={atEnd}>
          ▶
        </button>
        <button type="button" className="rc-btn rc-btn--accent" onClick={restart} disabled={safeCursor === 0}>
          ↺
        </button>
      </div>

      <div className="rc-graph-stats">
        <span>
          step <b>{safeCursor + 1}</b>/{steps.length}
        </span>
        <span>
          expanded <b>{step.expandedCount}</b>
        </span>
        <span>
          frontier <b>{step.frontier.length}</b>
        </span>
        {step.limit != null && (
          <span>
            depth limit <b>{step.limit}</b>
          </span>
        )}
      </div>
    </section>
  );
}

function rightOf(cfg: Config, n: { ml: number; cl: number }): { m: number; c: number } {
  return { m: cfg.m - n.ml, c: cfg.c - n.cl };
}
