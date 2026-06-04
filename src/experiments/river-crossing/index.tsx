import { useTranslation } from "react-i18next";
import ExperimentHeader from "../../components/ExperimentHeader";
import ScrambleText from "../../components/ScrambleText";
import { useRiverCrossing } from "./useRiverCrossing";
import RiverScene from "./components/RiverScene";
import Controls from "./components/Controls";
import SetupPanel from "./components/SetupPanel";
import SolverPanel from "./components/SolverPanel";
import SearchGraph from "./components/SearchGraph";
import StoryPanel from "./components/StoryPanel";
import DebugLog from "./components/DebugLog";
import "./RiverCrossing.css";

export default function RiverCrossing() {
  const { t } = useTranslation();
  const rc = useRiverCrossing();

  return (
    <div className="rc-page">
      <ExperimentHeader
        crumbs={[
          { label: t("experiments.river-crossing.title").toLowerCase(), to: "/experiments/river-crossing" },
          { label: `${rc.cfg.m}M · ${rc.cfg.c}C · boat ${rc.cfg.k}` },
        ]}
      />

      <div className="rc-info-strip">
        <div className="rc-info-tagline">
          <ScrambleText text={t("experiments.river-crossing.tagline")} duration={600} />
        </div>
        <div className="rc-info-desc">
          <ScrambleText
            text={t("experiments.river-crossing.intro", { m: rc.cfg.m, c: rc.cfg.c, k: rc.cfg.k })}
            duration={600}
          />
        </div>
      </div>

      <div className="rc-layout">
        <section className="rc-stage">
          <div className="rc-legend">
            <span className="rc-legend-item rc-legend-item--m">
              <span className="rc-legend-dot" /> missionary
            </span>
            <span className="rc-legend-item rc-legend-item--c">
              <span className="rc-legend-dot" /> cannibal
            </span>
          </div>
          <RiverScene
            leftBank={rc.leftBank}
            rightBank={rc.rightBank}
            board={rc.board}
            dock={rc.dock}
            boatSide={rc.boatSide}
            crossing={rc.crossing}
            status={rc.status}
            deathShoutIndex={rc.deathShoutIndex}
            capacity={rc.cfg.k}
            crossMs={rc.crossMs}
            onBoard={rc.boardPerson}
            onUnboard={rc.unboard}
          />
          <div className="rc-hint">
            <ScrambleText text={t("experiments.river-crossing.hint")} duration={600} />
          </div>
          <SearchGraph
            key={rc.searchKey}
            cfg={rc.cfg}
            graph={rc.graph}
            steps={rc.searchTrace}
            algo={rc.algo}
            speedIndex={rc.speedIndex}
            crossMs={rc.crossMs}
            state={rc.state}
            crossing={rc.crossing}
            crossTarget={rc.crossTarget}
            isPlaying={rc.isPlaying}
            traveled={rc.traveled}
          />
          <StoryPanel cfg={rc.cfg} moves={rc.moveLog} status={rc.status} />
        </section>

        <aside className="rc-sidebar">
          <Controls
            status={rc.status}
            seats={rc.seats}
            capacity={rc.cfg.k}
            canCross={rc.canCross}
            canUndo={rc.canUndo}
            moveCount={rc.moveLog.length}
            speedIndex={rc.speedIndex}
            onCross={rc.cross}
            onUndo={rc.undo}
            onReset={rc.reset}
            onSpeed={rc.setSpeedIndex}
          />
          <SetupPanel cfg={rc.cfg} onChange={rc.setConfig} />
          <SolverPanel
            algo={rc.algo}
            solution={rc.solution}
            plan={rc.plan}
            status={rc.status}
            crossing={rc.crossing}
            isPlaying={rc.isPlaying}
            onAlgo={rc.setAlgo}
            onPlay={rc.play}
            onPause={rc.pause}
            onStep={rc.step}
          />
          <DebugLog entries={rc.log} buildReport={rc.buildReport} onClear={rc.clearLog} />
        </aside>
      </div>
    </div>
  );
}
