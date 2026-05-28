import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ExperimentHeader from '../../components/ExperimentHeader';
import ScrambleText from '../../components/ScrambleText';
import type { AlgorithmId } from './types';
import { ALGORITHM_BY_ID, SPEED_PRESETS, DEFAULT_SPEED_INDEX } from './constants';
import { useSimulation } from './useSimulation';
import AlgorithmPicker from './components/AlgorithmPicker';
import Building from './components/Building';
import CarPanel from './components/CarPanel';
import Controls from './components/Controls';
import StatsPanel from './components/StatsPanel';
import Queue from './components/Queue';
import History from './components/History';
import './Elevator.css';

export default function Elevator() {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<AlgorithmId[]>(['look']);
  const [compareMode, setCompareMode] = useState(false);
  const [speedIndex, setSpeedIndex] = useState<number>(DEFAULT_SPEED_INDEX);

  const tickMs = SPEED_PRESETS[speedIndex].ms;
  const sim = useSimulation({ algorithms: selected, tickMs });
  const comparing = sim.comparing;

  function handleAlgo(id: AlgorithmId, additive: boolean) {
    setSelected(prev => {
      if (!additive) return [id];
      if (prev.includes(id)) {
        const next = prev.filter(x => x !== id);
        return next.length ? next : prev; // keep at least one
      }
      return [...prev, id];
    });
  }

  function handleCompareMode(on: boolean) {
    setCompareMode(on);
    // Leaving compare mode collapses back to the first selected algorithm.
    if (!on && selected.length > 1) setSelected([selected[0]]);
  }

  function handlePlayPause() {
    const anyPending = sim.state.elevators.some(el => el.pending.length > 0);
    if (sim.state.status === 'running') sim.pause();
    else if (anyPending) sim.play();
  }

  const anyPending = sim.state.elevators.some(el => el.pending.length > 0);
  const playDisabled = sim.state.status !== 'running' && !anyPending;

  const headTitle = comparing
    ? t('experiments.elevator.compare_count', { n: selected.length })
    : ALGORITHM_BY_ID[selected[0]].name;

  return (
    <div className="elev-page">
      <ExperimentHeader
        title={t('experiments.elevator.title').toLowerCase()}
        subtitle={headTitle}
      />

      <AlgorithmPicker
        selected={selected}
        compareMode={compareMode}
        onCompareModeChange={handleCompareMode}
        onSelect={handleAlgo}
      />

      {!comparing && (
        <div className="elev-info-strip">
          <div className="elev-info-tagline"><ScrambleText text={t(`experiments.elevator.algos.${selected[0]}.tagline`)} duration={600} /></div>
          <div className="elev-info-desc"><ScrambleText text={t(`experiments.elevator.algos.${selected[0]}.description`)} duration={600} /></div>
        </div>
      )}
      {comparing && (
        <div className="elev-info-strip elev-info-strip--cmp">
          <div className="elev-info-tagline"><ScrambleText text={t('experiments.elevator.comparison_mode')} duration={600} /></div>
          <div className="elev-info-desc">
            <ScrambleText
              text={t('experiments.elevator.comparison_intro', {
                algos: selected.map(id => ALGORITHM_BY_ID[id].name).join(' · '),
              })}
              duration={600}
            />
          </div>
        </div>
      )}

      <div className="elev-layout">
        <section className="elev-side elev-side--outside">
          <div className="elev-side-label">
            <span className="elev-side-tag"><ScrambleText text={t('experiments.elevator.outside')} duration={600} /></span>
            <span className="elev-side-desc">
              <ScrambleText
                text={t(comparing ? 'experiments.elevator.hall_calls_other' : 'experiments.elevator.hall_calls_one')}
                duration={600}
              />
            </span>
          </div>
          <div className="elev-stage">
            <Building
              state={sim.state}
              activeCalls={sim.activeCalls}
              tickMs={tickMs}
              onHallCall={sim.addRequest}
            />
          </div>
        </section>

        <aside className="elev-sidebar">
          <section className="elev-side elev-side--inside">
            <div className="elev-side-label">
              <span className="elev-side-tag"><ScrambleText text={t('experiments.elevator.inside')} duration={600} /></span>
              <span className="elev-side-desc"><ScrambleText text={t('experiments.elevator.cop_desc')} duration={600} /></span>
            </div>
            <CarPanel
              state={sim.state}
              activeCalls={sim.activeCalls}
              onCarCall={(f) => sim.addRequest(f, 'car')}
            />
          </section>

          <StatsPanel state={sim.state} />
          <Controls
            status={sim.state.status}
            speedIndex={speedIndex}
            playDisabled={playDisabled}
            onSpeedChange={setSpeedIndex}
            onPlayPause={handlePlayPause}
            onReset={sim.reset}
            onRandom={() => sim.seedRandom(5)}
            onClear={sim.clearAll}
          />
          <Queue activeCalls={sim.activeCalls} tick={sim.state.tick} />
          <History state={sim.state} speedLabel={SPEED_PRESETS[speedIndex].label} />
          <div className="elev-hint">
            <ScrambleText text={t('experiments.elevator.hint')} duration={600} />
          </div>
        </aside>
      </div>
    </div>
  );
}
