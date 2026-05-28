import { ALGORITHMS } from '../constants';
import type { AlgorithmId } from '../types';

interface Props {
  selected: Set<AlgorithmId>;
  onToggle: (id: AlgorithmId) => void;
  onContinue: () => void;
}

const CATEGORY_LABEL = {
  unweighted: 'unweighted',
  weighted: 'weighted',
  heuristic: 'heuristic',
} as const;

export default function AlgorithmSelect({ selected, onToggle, onContinue }: Props) {
  return (
    <div className="pf-algo-select">
      <div className="pf-section-header">
        <h2 className="pf-section-title">select algorithms</h2>
        <p className="pf-section-sub">
          pick one or more to run side-by-side on your maze
        </p>
      </div>

      <div className="pf-algo-grid">
        {ALGORITHMS.map((algo) => {
          const isSelected = selected.has(algo.id);
          return (
            <button
              key={algo.id}
              className={`pf-algo-card${isSelected ? ' pf-algo-card--selected' : ''}`}
              onClick={() => onToggle(algo.id)}
              aria-pressed={isSelected}
            >
              <div className="pf-algo-card-top">
                <span className={`pf-cat-badge pf-cat-${algo.category}`}>
                  {CATEGORY_LABEL[algo.category]}
                </span>
                <span className={`pf-check-mark${isSelected ? ' pf-check-mark--visible' : ''}`}>
                  ✓
                </span>
              </div>

              <h3 className="pf-algo-name">{algo.name}</h3>
              <p className="pf-algo-desc">{algo.description}</p>

              <div className="pf-algo-meta">
                <span className="pf-badge pf-badge-dim">T: {algo.timeComplexity}</span>
                <span className="pf-badge pf-badge-dim">S: {algo.spaceComplexity}</span>
                <span
                  className={`pf-badge ${
                    algo.guaranteesShortest ? 'pf-badge-optimal' : 'pf-badge-suboptimal'
                  }`}
                >
                  {algo.guaranteesShortest ? '✓ optimal' : '✗ optimal'}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="pf-algo-footer">
        <span className="pf-sel-count">
          {selected.size === 0
            ? 'no algorithms selected'
            : `${selected.size} algorithm${selected.size > 1 ? 's' : ''} selected`}
        </span>
        <button
          className="pf-btn pf-btn-primary"
          disabled={selected.size === 0}
          onClick={onContinue}
        >
          build maze →
        </button>
      </div>
    </div>
  );
}
