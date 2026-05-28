import type { MouseEvent } from 'react';
import ScrambleText from '../../../components/ScrambleText';
import type { AlgorithmId } from '../types';
import { ALGORITHMS, SHAFT_COLORS } from '../constants';

interface Props {
  selected: AlgorithmId[];
  compareMode: boolean;
  onCompareModeChange: (on: boolean) => void;
  /** additive = true means toggle membership (compare); false = replace. */
  onSelect: (id: AlgorithmId, additive: boolean) => void;
}

export default function AlgorithmPicker({
  selected, compareMode, onCompareModeChange, onSelect,
}: Props) {
  const selectedSet = new Set(selected);

  function handleClick(e: MouseEvent, id: AlgorithmId) {
    const additive = compareMode || e.ctrlKey || e.metaKey;
    onSelect(id, additive);
  }

  return (
    <div className="elev-algo-bar">
      <div className="elev-algo-picker" role="tablist" aria-label="elevator scheduling algorithm">
        {ALGORITHMS.map((algo) => {
          const active = selectedSet.has(algo.id);
          const order = active ? selected.indexOf(algo.id) + 1 : 0;
          const color = active ? SHAFT_COLORS[(order - 1) % SHAFT_COLORS.length] : undefined;
          return (
            <button
              key={algo.id}
              role="tab"
              aria-selected={active}
              className={`elev-algo-pill${active ? ' elev-algo-pill--on' : ''}`}
              onClick={(e) => handleClick(e, algo.id)}
              style={color ? ({ '--shaft-color': color } as React.CSSProperties) : undefined}
            >
              {compareMode && (
                <span className="elev-algo-badge" aria-hidden="true">
                  {active ? order : ''}
                </span>
              )}
              <span className="elev-algo-pill-name"><ScrambleText text={algo.name} duration={600} /></span>
              <span className="elev-algo-pill-tag"><ScrambleText text={algo.short} duration={600} /></span>
            </button>
          );
        })}
      </div>

      <label className="elev-compare-toggle" title="Run several algorithms side by side on the same calls">
        <input
          type="checkbox"
          checked={compareMode}
          onChange={(e) => onCompareModeChange(e.target.checked)}
        />
        <span className="elev-compare-track"><span className="elev-compare-knob" /></span>
        <span className="elev-compare-label">
          <ScrambleText text="compare" duration={600} />
          {compareMode && <span className="elev-compare-hint"> · <ScrambleText text="click to add/remove" duration={600} /></span>}
          {!compareMode && <span className="elev-compare-hint"> · <ScrambleText text="or hold ⌃/⌘" duration={600} /></span>}
        </span>
      </label>
    </div>
  );
}
