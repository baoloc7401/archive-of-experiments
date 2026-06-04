import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const atGoal = status === "won";
  const stuck = !solution.solvable && !atGoal;
  const canDrive = status === "playing" && solution.solvable && solution.moves.length > 0;
  // While a plan executes, show *it* so the list matches what's running; DFS's
  // recomputed solution-from-here would otherwise disagree move to move.
  const planMoves = plan.length > 0 ? plan : solution.moves;
  const meta = ALGO_BY_ID[algo];
  const algoName = t(`experiments.river-crossing.search.algos.${algo}.name`);
  // Only the shortest-path searches earn "optimal"; UCS is least-cost, the rest
  // return *a* valid path.
  const planHead =
    meta.kind === "optimal"
      ? t("experiments.river-crossing.solver.plan_optimal")
      : meta.kind === "cost"
        ? t("experiments.river-crossing.solver.plan_cost")
        : t("experiments.river-crossing.solver.plan_generic", { name: algoName.toLowerCase() });

  return (
    <section className="rc-solver">
      <div className="rc-panel-head">
        <ScrambleText text={t("experiments.river-crossing.solver.title")} duration={500} />
      </div>

      <div className="rc-algo-row">
        {ALGOS.map((a) => {
          const name = t(`experiments.river-crossing.search.algos.${a.id}.name`);
          const tagline = t(`experiments.river-crossing.search.algos.${a.id}.tagline`);
          return (
            <button
              key={a.id}
              type="button"
              className={`rc-algo-pill${a.id === algo ? " rc-algo-pill--on" : ""}`}
              onClick={() => onAlgo(a.id)}
              title={tagline}
            >
              <span className="rc-algo-name">{name}</span>
              <span className="rc-algo-tag">
                <ScrambleText text={tagline} duration={500} />
              </span>
            </button>
          );
        })}
      </div>

      <div className="rc-solver-actions">
        {isPlaying ? (
          <button type="button" className="rc-btn rc-btn--pause" onClick={onPause}>
            <ScrambleText text={t("experiments.river-crossing.solver.pause")} duration={450} />
          </button>
        ) : (
          <button
            type="button"
            className="rc-btn rc-btn--primary"
            onClick={onPlay}
            disabled={!canDrive}
          >
            <ScrambleText text={t("experiments.river-crossing.solver.solve_play")} duration={450} />
          </button>
        )}
        <button type="button" className="rc-btn" onClick={onStep} disabled={!canDrive || crossing}>
          <ScrambleText text={t("experiments.river-crossing.solver.hint_step")} duration={450} />
        </button>
      </div>

      <div className="rc-solver-stats">
        <div className="rc-stat">
          <span className="rc-stat-num">
            {atGoal ? "0" : solution.solvable ? planMoves.length : "—"}
          </span>
          <span className="rc-stat-lbl">{t("experiments.river-crossing.solver.crossings_left")}</span>
        </div>
        <div className="rc-stat">
          <span className="rc-stat-num">{solution.expanded}</span>
          <span className="rc-stat-lbl">{t("experiments.river-crossing.solver.expanded")}</span>
        </div>
        <div className="rc-stat">
          <span className="rc-stat-num">{solution.discovered}</span>
          <span className="rc-stat-lbl">{t("experiments.river-crossing.solver.discovered")}</span>
        </div>
        <div className="rc-stat">
          <span className="rc-stat-num">{solution.frontierPeak}</span>
          <span className="rc-stat-lbl">{t("experiments.river-crossing.solver.frontier_peak")}</span>
        </div>
      </div>

      {stuck && (
        <div className="rc-solver-note rc-solver-note--stuck">
          <ScrambleText text={t("experiments.river-crossing.solver.stuck")} duration={500} />
        </div>
      )}
      {atGoal && (
        <div className="rc-solver-note rc-solver-note--win">
          <ScrambleText text={t("experiments.river-crossing.solver.solved")} duration={500} />
        </div>
      )}

      {meta.kind === "cost" && solution.solvable && (
        <div className="rc-solver-note rc-solver-note--cost">
          <ScrambleText
            text={t("experiments.river-crossing.solver.cost_note", { n: solution.cost })}
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
