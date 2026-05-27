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
import Controls from './components/Controls';
import StatsPanel from './components/StatsPanel';
import Queue from './components/Queue';
import './Elevator.css';

export default function Elevator() {
  const { theme, toggle } = useTheme();
  const { t } = useTranslation();
  const [algorithm, setAlgorithm] = useState<AlgorithmId>('look');
  const [speedIndex, setSpeedIndex] = useState<number>(DEFAULT_SPEED_INDEX);

  const tickMs = SPEED_PRESETS[speedIndex].ms;
  const sim = useSimulation({ algorithm, tickMs });
  const info = ALGORITHM_BY_ID[algorithm];

  function handleAlgo(id: AlgorithmId) {
    setAlgorithm(id);
  }

  function handlePlayPause() {
    if (sim.state.status === 'running') sim.pause();
    else sim.play();
  }

  return (
    <div className="elev-page">
      <div className="elev-topbar">
        <a href="/" className="elev-back">← experiments</a>
        <div className="elev-topbar-title">
          <span className="elev-topbar-main">{t('experiments.elevator.title').toLowerCase()}</span>
          <span className="elev-topbar-sub">/ {info.name}</span>
        </div>
        <div className="elev-topbar-controls">
          <LangToggle />
          <ThemeToggle theme={theme} onToggle={toggle} />
        </div>
      </div>

      <AlgorithmPicker selected={algorithm} onSelect={handleAlgo} />

      <div className="elev-info-strip">
        <div className="elev-info-tagline">{info.tagline}</div>
        <div className="elev-info-desc">{info.description}</div>
      </div>

      <div className="elev-layout">
        <div className="elev-stage">
          <div className="elev-stage-grid">
            <div aria-hidden="true" className="elev-stage-grid-cell" />
            <div aria-hidden="true" className="elev-stage-grid-cell" />
            <div aria-hidden="true" className="elev-stage-grid-cell" />
            <div aria-hidden="true" className="elev-stage-grid-cell" />
          </div>
          <Building state={sim.state} onCall={sim.addRequest} />
        </div>

        <aside className="elev-sidebar">
          <StatsPanel state={sim.state} />
          <Controls
            status={sim.state.status}
            speedIndex={speedIndex}
            onSpeedChange={setSpeedIndex}
            onPlayPause={handlePlayPause}
            onReset={sim.reset}
            onRandom={() => sim.seedRandom(5)}
            onClear={sim.clearAll}
          />
          <Queue state={sim.state} />
          <div className="elev-hint">
            click any floor's dot to call the elevator, or hit <em>random</em> to seed five calls.
          </div>
        </aside>
      </div>
    </div>
  );
}
