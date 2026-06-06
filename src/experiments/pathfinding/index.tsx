import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
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

// URL segment <-> screen mapping. The first screen lives at the experiment
// root (no segment); the rest get a path segment so navigation is linkable.
const SCREEN_SLUG: Record<AppScreen, string> = {
  'algorithm-select': '',
  'maze-builder': 'maze-builder',
  run: 'run',
};
const SLUG_SCREEN: Record<string, AppScreen> = {
  'maze-builder': 'maze-builder',
  run: 'run',
};

// Ordered steps of the flow. The header renders the trail up to the current
// step (e.g. on "run": pathfinding / maze builder / run). Labels are resolved
// via i18n in the component.
const PF_STEPS: { screen: AppScreen }[] = [
  { screen: 'algorithm-select' },
  { screen: 'maze-builder' },
  { screen: 'run' },
];

function pathFor(screen: AppScreen) {
  const seg = SCREEN_SLUG[screen];
  return seg ? `/experiments/pathfinding/${seg}` : '/experiments/pathfinding';
}

export default function Pathfinding() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { screen: slug } = useParams();
  const screen: AppScreen = slug ? SLUG_SCREEN[slug] : 'algorithm-select';
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

  // Keep terrain weights baked into the grid in sync with options. Done in the
  // change handler (not an effect) so both states update together, and only
  // when the weighting actually changed.
  function handleOptionsChange(next: MazeOptions) {
    const weightsChanged =
      next.weighted !== options.weighted || next.terrainConfig !== options.terrainConfig;
    setOptions(next);
    if (!weightsChanged) return;
    setGrid((prev) => {
      if (!next.weighted) {
        return prev.terrainWeights ? { ...prev, terrainWeights: undefined } : prev;
      }
      return { ...prev, terrainWeights: computeTerrainWeights(next.terrainConfig) };
    });
  }

  function toggleAlgorithm(id: AlgorithmId) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function goScreen(next: AppScreen) {
    navigate(pathFor(next));
  }

  // Unknown slug, or a deep-link into a later step before any algorithm has
  // been picked - bounce back to the start of the flow.
  if ((slug && !SLUG_SCREEN[slug]) || (screen !== 'algorithm-select' && selected.size === 0)) {
    return <Navigate to="/experiments/pathfinding" replace />;
  }

  const crumbLabel = (s: AppScreen) =>
    s === 'algorithm-select'
      ? t('experiments.pathfinding.title').toLowerCase()
      : s === 'maze-builder'
        ? t('experiments.pathfinding.crumb_maze')
        : t('experiments.pathfinding.crumb_run');

  const currentStep = PF_STEPS.findIndex((s) => s.screen === screen);
  const crumbs = PF_STEPS.slice(0, currentStep + 1).map((s) => ({
    label: crumbLabel(s.screen),
    to: pathFor(s.screen),
  }));

  return (
    <div className="pf-page">
      <ExperimentHeader crumbs={crumbs} />

      <div className="pf-content">
        {screen === 'algorithm-select' && (
          <AlgorithmSelect
            selected={selected}
            onToggle={toggleAlgorithm}
            onContinue={() => goScreen('maze-builder')}
          />
        )}
        {screen === 'maze-builder' && (
          <MazeBuilder
            grid={grid}
            selected={selected}
            options={options}
            onGridChange={setGrid}
            onOptionsChange={handleOptionsChange}
            onBack={() => goScreen('algorithm-select')}
            onRun={() => goScreen('run')}
          />
        )}
        {screen === 'run' && (
          <Run
            grid={grid}
            selected={selected}
            onBack={() => goScreen('maze-builder')}
          />
        )}
      </div>
    </div>
  );
}
