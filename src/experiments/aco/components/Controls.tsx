import ScrambleText from "../../../components/ScrambleText";
import { MIN_SPEED, MAX_SPEED } from "../constants";

interface Props {
  running: boolean;
  disabled: boolean;
  speed: number;
  trail: number;
  onPlayPause: () => void;
  onStep: () => void;
  onReset: () => void;
  onSpeed: (v: number) => void;
  onTrail: (v: number) => void;
}

export default function Controls({
  running,
  disabled,
  speed,
  trail,
  onPlayPause,
  onStep,
  onReset,
  onSpeed,
  onTrail,
}: Props) {
  return (
    <div className="aco-controls">
      <div className="aco-control-btns">
        <button
          className="aco-btn aco-btn-accent"
          onClick={onPlayPause}
          disabled={disabled}
        >
          <ScrambleText text={running ? "⏸ pause" : "▶ run"} duration={500} />
        </button>
        <button
          className="aco-btn aco-btn-ghost"
          onClick={onStep}
          disabled={disabled || running}
          title="Run one iteration instantly"
        >
          <ScrambleText text="step" duration={500} />
        </button>
        <button className="aco-btn aco-btn-ghost" onClick={onReset} title="Reset pheromone">
          <ScrambleText text="↺ reset" duration={500} />
        </button>
      </div>

      <label className="aco-speed">
        <span className="aco-speed-label">
          <ScrambleText text="speed" duration={500} />
        </span>
        <input
          type="range"
          min={MIN_SPEED}
          max={MAX_SPEED}
          value={speed}
          onChange={(e) => onSpeed(Number(e.target.value))}
          className="aco-slider"
          aria-label="animation speed"
        />
        <span className="aco-speed-val">{speed}</span>
      </label>

      <label className="aco-speed" title="How much of the faint pheromone web to show — low keeps only the strongest trails">
        <span className="aco-speed-label">
          <ScrambleText text="trails" duration={500} />
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={trail}
          onChange={(e) => onTrail(Number(e.target.value))}
          className="aco-slider"
          aria-label="trail visibility"
        />
        <span className="aco-speed-val">{trail}</span>
      </label>
    </div>
  );
}
