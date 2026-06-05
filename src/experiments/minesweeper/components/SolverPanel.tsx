import { useTranslation } from "react-i18next";
import ScrambleText from "../../../components/ScrambleText";
import { SOLVERS } from "../solvers";
import type { SolverId, SolverReport } from "../solvers/types";

interface Props {
  solverId: SolverId;
  report: SolverReport | null;
  playing: boolean;
  guess: number | null;
  onSelect: (id: SolverId) => void;
  onRun: (id: SolverId) => void;
  onStop: () => void;
}

/** Interactive auto-solver: pick one of the engines and watch it clear the field
 *  by pure logic (the show-odds overlay lives in the board toolbar; the
 *  side-by-side comparison view is still planned). */
export default function SolverPanel({ solverId, report, playing, guess, onSelect, onRun, onStop }: Props) {
  const { t } = useTranslation();
  const name = (id: SolverId) => t(`experiments.minesweeper.solvers.${id}.name`);
  const guessPct =
    guess != null && report?.probabilities ? Math.round((report.probabilities.get(guess) ?? 0) * 100) : null;

  return (
    <div className="ms-solver">
      <div className="ms-solver-planned">
        <ScrambleText text={t("experiments.minesweeper.solver.comparison_planned")} duration={500} />
      </div>

      <p className="ms-solver-blurb">
        <ScrambleText text={t("experiments.minesweeper.solver.blurb")} duration={500} />
      </p>

      <div className="ms-chip-row" role="radiogroup" aria-label={t("experiments.minesweeper.solver.title")}>
        {SOLVERS.map((s) => (
          <button
            key={s.id}
            className={`ms-chip${solverId === s.id ? " ms-chip--on" : ""}`}
            role="radio"
            aria-checked={solverId === s.id}
            disabled={playing}
            onClick={() => onSelect(s.id)}
            title={t(`experiments.minesweeper.solvers.${s.id}.tagline`)}
          >
            <ScrambleText text={name(s.id)} duration={500} />
          </button>
        ))}
      </div>

      <div className="ms-solver-tagline">
        <ScrambleText text={t(`experiments.minesweeper.solvers.${solverId}.tagline`)} duration={500} />
      </div>

      <button
        className={`ms-btn ${playing ? "ms-btn-ghost" : "ms-btn-accent"}`}
        onClick={() => (playing ? onStop() : onRun(solverId))}
      >
        <ScrambleText
          text={playing ? t("experiments.minesweeper.solver.stop") : t("experiments.minesweeper.solver.run")}
          duration={500}
        />
      </button>

      {report && !playing && (
        <>
          <div className={`ms-solver-verdict ms-solver-verdict--${report.status === "solved" ? "ok" : "bad"}`}>
            <ScrambleText
              text={t(
                report.status === "solved"
                  ? "experiments.minesweeper.solver.solved"
                  : "experiments.minesweeper.solver.stuck",
                { name: name(solverId) },
              )}
              duration={500}
            />
          </div>

          <div className="ms-solver-stats">
            <span>
              {t("experiments.minesweeper.solver.revealed")} <b>{report.revealedCount}</b>
            </span>
            <span>
              {t("experiments.minesweeper.solver.flagged")} <b>{report.identifiedCount}</b>
            </span>
            <span>
              {t("experiments.minesweeper.solver.undecided")} <b>{report.undecided.length}</b>
            </span>
            <span>
              {t("experiments.minesweeper.solver.steps")} <b>{report.steps}</b>
            </span>
            <span>
              {t("experiments.minesweeper.solver.time")} <b>{report.ms.toFixed(1)}ms</b>
            </span>
          </div>

          {guessPct != null && (
            <div className="ms-solver-guess">
              <ScrambleText text={t("experiments.minesweeper.solver.best_guess", { pct: guessPct })} duration={500} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
