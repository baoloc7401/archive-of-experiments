import { useState } from 'react';
import type { AlgorithmId, AppScreen, GridConfig } from './types';
import { DEFAULT_ROWS, DEFAULT_COLS } from './constants';
import { makeDefaultGrid } from './maze';
import AlgorithmSelect from './components/AlgorithmSelect';
import MazeBuilder from './components/MazeBuilder';
import Run from './components/Run';
import ThemeToggle from '../../components/ThemeToggle';
import { useTheme } from '../../hooks/useTheme';
import './Pathfinding.css';

export default function Pathfinding() {
  const { theme, toggle } = useTheme();
  const [screen, setScreen] = useState<AppScreen>('algorithm-select');
  const [selected, setSelected] = useState<Set<AlgorithmId>>(new Set());
  const [grid, setGrid] = useState<GridConfig>(() =>
    makeDefaultGrid(DEFAULT_ROWS, DEFAULT_COLS)
  );

  function toggleAlgorithm(id: AlgorithmId) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const STEP_LABEL: Record<AppScreen, string> = {
    'algorithm-select': '',
    'maze-builder': '/ maze builder',
    run: '/ run',
  };

  return (
    <div className="pf-page">
      <div className="pf-topbar">
        <a href="/" className="pf-back">← experiments</a>
        <div className="pf-topbar-center">
          <span className="pf-topbar-title">pathfinding</span>
          {STEP_LABEL[screen] && (
            <span className="pf-topbar-step">{STEP_LABEL[screen]}</span>
          )}
        </div>
        <ThemeToggle theme={theme} onToggle={toggle} />
      </div>

      <div className="pf-content">
        {screen === 'algorithm-select' && (
          <AlgorithmSelect
            selected={selected}
            onToggle={toggleAlgorithm}
            onContinue={() => setScreen('maze-builder')}
          />
        )}
        {screen === 'maze-builder' && (
          <MazeBuilder
            grid={grid}
            selected={selected}
            onGridChange={setGrid}
            onBack={() => setScreen('algorithm-select')}
            onRun={() => setScreen('run')}
          />
        )}
        {screen === 'run' && (
          <Run
            grid={grid}
            selected={selected}
            onBack={() => setScreen('maze-builder')}
          />
        )}
      </div>
    </div>
  );
}
