import { useEffect, useState } from 'react';
import type { AlgorithmId, AppScreen, GridConfig, MazeOptions } from './types';
import { DEFAULT_ROWS, DEFAULT_COLS, DEFAULT_MAZE_OPTIONS } from './constants';
import { makeDefaultGrid, computeTerrainWeights } from './maze';
import AlgorithmSelect from './components/AlgorithmSelect';
import MazeBuilder from './components/MazeBuilder';
import Run from './components/Run';
import ExperimentHeader from '../../components/ExperimentHeader';
import './Pathfinding.css';

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

function loadSelected(): Set<AlgorithmId> {
  try {
    const raw = localStorage.getItem('pf-selected');
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as AlgorithmId[]);
  } catch { return new Set(); }
}

function loadGrid(): GridConfig {
  try {
    const raw = localStorage.getItem('pf-grid');
    if (!raw) return makeDefaultGrid(DEFAULT_ROWS, DEFAULT_COLS);
    const g = JSON.parse(raw) as GridConfig;
    // Validate minimal structure
    if (!g.cells || !g.start || !g.end || !g.rows || !g.cols) {
      return makeDefaultGrid(DEFAULT_ROWS, DEFAULT_COLS);
    }
    return g;
  } catch { return makeDefaultGrid(DEFAULT_ROWS, DEFAULT_COLS); }
}

function loadOptions(): MazeOptions {
  try {
    const raw = localStorage.getItem('pf-options');
    if (!raw) return DEFAULT_MAZE_OPTIONS;
    // Deep-merge with defaults to handle new fields added in future
    const saved = JSON.parse(raw) as Partial<MazeOptions>;
    return {
      ...DEFAULT_MAZE_OPTIONS,
      ...saved,
      terrainConfig: {
        ...DEFAULT_MAZE_OPTIONS.terrainConfig,
        ...saved.terrainConfig,
      },
    };
  } catch { return DEFAULT_MAZE_OPTIONS; }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Pathfinding() {
  const [screen, setScreen] = useState<AppScreen>('algorithm-select');
  const [selected, setSelected] = useState<Set<AlgorithmId>>(loadSelected);
  const [grid, setGrid] = useState<GridConfig>(loadGrid);
  const [options, setOptions] = useState<MazeOptions>(loadOptions);

  // Persist state
  useEffect(() => {
    localStorage.setItem('pf-selected', JSON.stringify([...selected]));
  }, [selected]);

  useEffect(() => {
    localStorage.setItem('pf-grid', JSON.stringify(grid));
  }, [grid]);

  useEffect(() => {
    localStorage.setItem('pf-options', JSON.stringify(options));
  }, [options]);

  // When terrain weights change, sync them into the grid so algorithms use them
  useEffect(() => {
    if (options.weighted) {
      const weights = computeTerrainWeights(options.terrainConfig);
      setGrid((prev) => ({ ...prev, terrainWeights: weights }));
    } else {
      setGrid((prev) => {
        if (!prev.terrainWeights) return prev;
        return { ...prev, terrainWeights: undefined };
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.terrainConfig, options.weighted]);

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
    'maze-builder': 'maze builder',
    run: 'run',
  };

  return (
    <div className="pf-page">
      <ExperimentHeader title="pathfinding" subtitle={STEP_LABEL[screen] || undefined} />

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
            options={options}
            onGridChange={setGrid}
            onOptionsChange={setOptions}
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
