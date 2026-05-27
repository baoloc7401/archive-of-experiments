import type { AlgorithmId } from '../types';
import { ALGORITHMS } from '../constants';

interface Props {
  selected: AlgorithmId;
  onSelect: (id: AlgorithmId) => void;
}

export default function AlgorithmPicker({ selected, onSelect }: Props) {
  return (
    <div className="elev-algo-picker" role="tablist" aria-label="elevator scheduling algorithm">
      {ALGORITHMS.map(algo => {
        const active = algo.id === selected;
        return (
          <button
            key={algo.id}
            role="tab"
            aria-selected={active}
            className={`elev-algo-pill${active ? ' elev-algo-pill--on' : ''}`}
            onClick={() => onSelect(algo.id)}
          >
            <span className="elev-algo-pill-name">{algo.name}</span>
            <span className="elev-algo-pill-tag">{algo.short}</span>
          </button>
        );
      })}
    </div>
  );
}
