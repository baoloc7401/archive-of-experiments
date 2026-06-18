import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ExperimentLayout } from "../../components/ui";
import ScrambleText from "../../components/ScrambleText";
import { useMinesweeper } from "./useMinesweeper";
import Board from "./components/Board";
import Hud from "./components/Hud";
import BoardTools from "./components/BoardTools";
import Section from "./components/Section";
import SetupPanel from "./components/SetupPanel";
import GenStats from "./components/GenStats";
import SolverPanel from "./components/SolverPanel";
import DebugLog from "./components/DebugLog";
import "./Minesweeper.css";

export default function Minesweeper() {
  const { t } = useTranslation();
  const ms = useMinesweeper();
  const [flagMode, setFlagMode] = useState(false);

  const banner =
    ms.status === "won"
      ? t("experiments.minesweeper.won")
      : ms.status === "lost"
        ? t("experiments.minesweeper.lost")
        : null;

  // Single polite announcement for screen readers: win/loss, a stuck auto-solve,
  // or (otherwise) the latest generation verdict.
  const solverName = t(`experiments.minesweeper.solvers.${ms.solverId}.name`);
  const live = banner
    ? banner
    : ms.solverReport && !ms.solverPlaying && ms.solverReport.status !== "solved"
      ? t("experiments.minesweeper.solver.stuck", { name: solverName })
      : ms.stats
        ? t(ms.stats.solved ? "experiments.minesweeper.gen.verdict_ok" : "experiments.minesweeper.gen.verdict_bad")
        : "";

  return (
    <ExperimentLayout
      crumbs={[
        { label: t("experiments.minesweeper.title").toLowerCase(), to: "/experiments/minesweeper" },
        { label: `${ms.cfg.width}×${ms.cfg.height} · ${ms.cfg.mines} ${t('experiments.minesweeper.setup.mines')}` },
      ]}
      glow="accent2"
      sidebarWidth="330px"
      info={
        <>
          <div className="ms-info-tagline">
            <ScrambleText text={t("experiments.minesweeper.tagline")} duration={600} />
          </div>
          <div className="ms-info-desc">
            <ScrambleText text={t("experiments.minesweeper.intro")} duration={600} />
          </div>
        </>
      }
      sidebar={
        <>
          <Section title={t("experiments.minesweeper.setup.title")}>
            <SetupPanel
              difficulty={ms.difficulty}
              cfg={ms.cfg}
              onDifficulty={ms.applyDifficulty}
              onPatch={ms.patchConfig}
              onNew={ms.newField}
            />
          </Section>

          <Section title={t("experiments.minesweeper.gen.title")}>
            <GenStats stats={ms.stats} onInspect={ms.forgeCenter} />
          </Section>

          <Section title={t("experiments.minesweeper.solver.title")}>
            <SolverPanel
              solverId={ms.solverId}
              report={ms.solverReport}
              playing={ms.solverPlaying}
              guess={ms.solverGuess}
              onSelect={ms.selectSolver}
              onRun={ms.runSolver}
              onStop={ms.stopSolver}
            />
          </Section>

          <Section title={t("experiments.minesweeper.debug.title")} defaultOpen={false}>
            <DebugLog entries={ms.log} buildReport={ms.buildReport} onClear={ms.clearLog} />
          </Section>
        </>
      }
    >
      <div className="ms-sr-only" role="status" aria-live="polite">
        {live}
      </div>

      <Hud minesLeft={ms.minesLeft} status={ms.status} onReset={ms.newField} />

      <BoardTools
        flagMode={flagMode}
        onFlagMode={setFlagMode}
        peek={ms.peek}
        onPeek={ms.setPeek}
        hasField={ms.field !== null}
        showOdds={ms.showOdds}
        onShowOdds={ms.setShowOdds}
        hasOdds={ms.solverProbs !== null}
        disabled={ms.solverPlaying}
      />

      <div className="ms-board-wrap">
        <div className="ms-board-scroll">
          <Board
            field={ms.field}
            view={ms.view}
            width={ms.cfg.width}
            height={ms.cfg.height}
            status={ms.status}
            mineHit={ms.mineHit}
            peek={ms.peek}
            undecided={ms.stats?.undecided ?? []}
            flagMode={flagMode}
            locked={ms.solverPlaying || ms.forging}
            bestGuess={ms.solverGuess}
            probabilities={ms.showOdds ? ms.solverProbs : null}
            onReveal={ms.revealCell}
            onChord={ms.chord}
            onFlag={ms.toggleFlag}
          />
        </div>
        {banner && (
          <div className={`ms-banner ms-banner--${ms.status}`} aria-hidden="true">
            <ScrambleText text={banner} duration={500} />
          </div>
        )}
        {ms.forging && (
          <div className="ms-overlay" aria-hidden="true">
            <ScrambleText text={t("experiments.minesweeper.forging")} duration={600} />
          </div>
        )}
        {ms.status === "fresh" && !ms.forging && (
          <div className="ms-overlay" aria-hidden="true">
            <ScrambleText text={t("experiments.minesweeper.first_click")} duration={600} />
          </div>
        )}
      </div>

      <div className="ms-hint">
        <ScrambleText text={t("experiments.minesweeper.hint")} duration={600} />
      </div>
    </ExperimentLayout>
  );
}
