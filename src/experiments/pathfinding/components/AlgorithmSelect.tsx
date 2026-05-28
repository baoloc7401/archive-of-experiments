import ScrambleText from '../../../components/ScrambleText';
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
        <h2 className="pf-section-title"><ScrambleText text="select algorithms" duration={600} /></h2>
        <p className="pf-section-sub">
          <ScrambleText text="pick one or more to run side-by-side on your maze" duration={600} />
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
                  <ScrambleText text={CATEGORY_LABEL[algo.category]} duration={600} />
                </span>
                <span className={`pf-check-mark${isSelected ? ' pf-check-mark--visible' : ''}`}>
                  ✓
                </span>
              </div>

              <h3 className="pf-algo-name"><ScrambleText text={algo.name} duration={600} /></h3>
              <p className="pf-algo-desc"><ScrambleText text={algo.description} duration={600} /></p>

              <div className="pf-algo-meta">
                <span className="pf-badge pf-badge-dim">T: {algo.timeComplexity}</span>
                <span className="pf-badge pf-badge-dim">S: {algo.spaceComplexity}</span>
                <span
                  className={`pf-badge ${
                    algo.guaranteesShortest ? 'pf-badge-optimal' : 'pf-badge-suboptimal'
                  }`}
                >
                  <ScrambleText text={algo.guaranteesShortest ? '✓ optimal' : '✗ optimal'} duration={600} />
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="pf-algo-footer">
        <span className="pf-sel-count">
          <ScrambleText
            text={selected.size === 0
              ? 'no algorithms selected'
              : `${selected.size} algorithm${selected.size > 1 ? 's' : ''} selected`}
            duration={600}
          />
        </span>
        <button
          className="pf-btn pf-btn-primary"
          disabled={selected.size === 0}
          onClick={onContinue}
        >
          <ScrambleText text="build maze →" duration={600} />
        </button>
      </div>
    </div>
  );
}
