import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ThemeToggle from '../../components/ThemeToggle';
import LangToggle from '../../components/LangToggle';
import { useTheme } from '../../hooks/useTheme';
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
  const { theme, toggle } = useTheme();
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
    ? `compare ×${selected.length}`
    : ALGORITHM_BY_ID[selected[0]].name;

  return (
    <div className="elev-page">
      <div className="elev-topbar">
        <a href="/" className="elev-back">← experiments</a>
        <div className="elev-topbar-title">
          <span className="elev-topbar-main">{t('experiments.elevator.title').toLowerCase()}</span>
          <span className="elev-topbar-sub">/ {headTitle}</span>
        </div>
        <div className="elev-topbar-controls">
          <LangToggle />
          <ThemeToggle theme={theme} onToggle={toggle} />
        </div>
      </div>

      <AlgorithmPicker
        selected={selected}
        compareMode={compareMode}
        onCompareModeChange={handleCompareMode}
        onSelect={handleAlgo}
      />

      {!comparing && (
        <div className="elev-info-strip">
          <div className="elev-info-tagline">{ALGORITHM_BY_ID[selected[0]].tagline}</div>
          <div className="elev-info-desc">{ALGORITHM_BY_ID[selected[0]].description}</div>
        </div>
      )}
      {comparing && (
        <div className="elev-info-strip elev-info-strip--cmp">
          <div className="elev-info-tagline">comparison mode</div>
          <div className="elev-info-desc">
            {selected.map(id => ALGORITHM_BY_ID[id].name).join(' · ')} — same calls, separate cars.
            watch the stats table to see who wins.
          </div>
        </div>
      )}

      <div className="elev-layout">
        <section className="elev-side elev-side--outside">
          <div className="elev-side-label">
            <span className="elev-side-tag">outside</span>
            <span className="elev-side-desc">hall calls — press ▲ / ▼ to summon the car{comparing ? 's' : ''}</span>
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
              <span className="elev-side-tag">inside</span>
              <span className="elev-side-desc">car panel — pick your destination</span>
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
            <em>outside</em> riders tap the hall buttons; <em>inside</em> riders use the car panel.
            toggle <em>compare</em> (or hold ⌃/⌘) to race algorithms on the same calls.
          </div>
        </aside>
      </div>
    </div>
  );
}
