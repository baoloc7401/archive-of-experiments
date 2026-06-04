import ScrambleText from "../../../components/ScrambleText";
import type { Move, SearchAlgo, SearchResult, Status } from "../types";
import { ALGO_BY_ID, ALGOS } from "../constants";
import { loadLabel, moveArrow } from "../solver";

interface Props {
  algo: SearchAlgo;
  solution: SearchResult;
  /** moves left in the plan being executed; falls back to the solver's plan */
  plan: Move[];
  status: Status;
  crossing: boolean;
  isPlaying: boolean;
  onAlgo: (a: SearchAlgo) => void;
  onPlay: () => void;
  onPause: () => void;
  onStep: () => void;
}

export default function SolverPanel({
  algo,
  solution,
  plan,
  status,
  crossing,
  isPlaying,
  onAlgo,
  onPlay,
  onPause,
  onStep,
}: Props) {
  const atGoal = status === "won";
  const stuck = !solution.solvable && !atGoal;
  const canDrive = status === "playing" && solution.solvable && solution.moves.length > 0;
  // While a plan executes, show *it* so the list matches what's running; DFS's
  // recomputed solution-from-here would otherwise disagree move to move.
  const planMoves = plan.length > 0 ? plan : solution.moves;
  const meta = ALGO_BY_ID[algo];
  // Only the shortest-path searches earn "optimal"; UCS is least-cost, the rest
  // return *a* valid path.
  const planHead =
    meta.kind === "optimal"
      ? "optimal plan from here"
      : meta.kind === "cost"
        ? "least-cost plan from here"
        : `${meta.name.toLowerCase()} plan from here`;

  return (
    <section className="rc-solver">
      <div className="rc-panel-head">solver</div>

      <div className="rc-algo-row">
        {ALGOS.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`rc-algo-pill${a.id === algo ? " rc-algo-pill--on" : ""}`}
            onClick={() => onAlgo(a.id)}
            title={a.tagline}
          >
            <span className="rc-algo-name">{a.name}</span>
            <span className="rc-algo-tag">
              <ScrambleText text={a.tagline} duration={500} />
            </span>
          </button>
        ))}
      </div>

      <div className="rc-solver-actions">
        {isPlaying ? (
          <button type="button" className="rc-btn rc-btn--pause" onClick={onPause}>
            ⏸ pause
          </button>
        ) : (
          <button
            type="button"
            className="rc-btn rc-btn--primary"
            onClick={onPlay}
            disabled={!canDrive}
          >
            ▶ solve &amp; play
          </button>
        )}
        <button
          type="button"
          className="rc-btn"
          onClick={onStep}
          disabled={!canDrive || crossing}
        >
          → hint step
        </button>
      </div>

      <div className="rc-solver-stats">
        <div className="rc-stat">
          <span className="rc-stat-num">
            {atGoal ? "0" : solution.solvable ? planMoves.length : "—"}
          </span>
          <span className="rc-stat-lbl">crossings left</span>
        </div>
        <div className="rc-stat">
          <span className="rc-stat-num">{solution.expanded}</span>
          <span className="rc-stat-lbl">expanded</span>
        </div>
        <div className="rc-stat">
          <span className="rc-stat-num">{solution.discovered}</span>
          <span className="rc-stat-lbl">discovered</span>
        </div>
        <div className="rc-stat">
          <span className="rc-stat-num">{solution.frontierPeak}</span>
          <span className="rc-stat-lbl">frontier peak</span>
        </div>
      </div>

      {stuck && (
        <div className="rc-solver-note rc-solver-note--stuck">
          <ScrambleText text="no solution from here — undo or reset" duration={500} />
        </div>
      )}
      {atGoal && (
        <div className="rc-solver-note rc-solver-note--win">
          <ScrambleText text="solved — everyone is across" duration={500} />
        </div>
      )}

      {meta.kind === "cost" && solution.solvable && (
        <div className="rc-solver-note rc-solver-note--cost">
          <ScrambleText
            text={`least cost: ${solution.cost} people ferried (weighted edges)`}
            duration={500}
          />
        </div>
      )}

      {solution.solvable && planMoves.length > 0 && (
        <div className="rc-plan">
          <div className="rc-plan-head">{planHead}</div>
          <ol className="rc-plan-list">
            {planMoves.map((mv, i) => (
              <li key={i} className="rc-plan-item">
                <span className="rc-plan-arrow">{moveArrow(mv.from)}</span>
                <span className="rc-plan-load">{loadLabel(mv)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
