import ScrambleText from "../../../components/ScrambleText";
import type { LayoutId } from "../types";
import { LAYOUTS, MIN_CITIES, MAX_CITIES } from "../constants";

interface Props {
  layout: LayoutId;
  count: number;
  onLayout: (id: LayoutId) => void;
  onCount: (n: number) => void;
  onScatter: () => void;
  onClear: () => void;
}

export default function Setup({
  layout,
  count,
  onLayout,
  onCount,
  onScatter,
  onClear,
}: Props) {
  return (
    <div className="aco-setup">
      <div className="aco-panel-title">
        <ScrambleText text="cities" duration={500} />
      </div>

      <div className="aco-layout-row">
        {LAYOUTS.map((l) => (
          <button
            key={l.id}
            className={`aco-chip${layout === l.id ? " aco-chip--on" : ""}`}
            onClick={() => onLayout(l.id)}
            title={l.hint}
          >
            <ScrambleText text={l.label} duration={500} />
          </button>
        ))}
      </div>

      <label className="aco-param" title="number of cities to scatter">
        <span className="aco-param-head">
          <span className="aco-param-label">
            <ScrambleText text="count" duration={500} />
          </span>
          <span className="aco-param-val">{count}</span>
        </span>
        <input
          type="range"
          min={MIN_CITIES}
          max={MAX_CITIES}
          value={count}
          onChange={(e) => onCount(Number(e.target.value))}
          className="aco-slider"
          aria-label="city count"
        />
      </label>

      <div className="aco-setup-btns">
        <button className="aco-btn aco-btn-ghost" onClick={onScatter}>
          <ScrambleText text="✦ scatter" duration={500} />
        </button>
        <button className="aco-btn aco-btn-ghost" onClick={onClear} title="Remove all cities">
          <ScrambleText text="⌫ clear" duration={500} />
        </button>
      </div>
    </div>
  );
}
