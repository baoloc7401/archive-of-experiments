import ScrambleText from "../../../components/ScrambleText";
import type { AcoParams } from "../types";
import { PARAM_RANGES } from "../constants";

interface Props {
  params: AcoParams;
  onChange: (patch: Partial<AcoParams>) => void;
}

export default function Params({ params, onChange }: Props) {
  return (
    <div className="aco-params">
      <div className="aco-panel-title">
        <ScrambleText text="parameters" duration={500} />
      </div>

      {PARAM_RANGES.map((r) => {
        const value = params[r.key];
        const display = r.key === "ants" ? String(value) : value.toFixed(r.step < 0.1 ? 2 : 1);
        return (
          <label key={r.key} className="aco-param" title={r.hint}>
            <span className="aco-param-head">
              <span className="aco-param-label">
                <ScrambleText text={r.label} duration={500} />
              </span>
              <span className="aco-param-val">{display}</span>
            </span>
            <input
              type="range"
              min={r.min}
              max={r.max}
              step={r.step}
              value={value}
              onChange={(e) => onChange({ [r.key]: Number(e.target.value) })}
              className="aco-slider"
              aria-label={r.label}
            />
          </label>
        );
      })}

      <button
        className={`aco-toggle${params.elitist ? " aco-toggle--on" : ""}`}
        onClick={() => onChange({ elitist: !params.elitist })}
        role="switch"
        aria-checked={params.elitist}
        title="Give the best-so-far tour an extra pheromone dose each iteration — speeds convergence"
      >
        <span className="aco-toggle-dot" aria-hidden="true" />
        <ScrambleText text="elitist reinforcement" duration={500} />
      </button>
    </div>
  );
}
