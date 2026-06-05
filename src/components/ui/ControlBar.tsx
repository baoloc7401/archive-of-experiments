import type { ReactNode } from "react";
import ScrambleText from "../ScrambleText";
import Button from "./Button";
import "./ControlBar.css";

interface Props {
  playing: boolean;
  onPlayPause: () => void;
  playLabel: string;
  pauseLabel: string;
  onStep?: () => void;
  stepLabel?: string;
  stepHint?: string;
  onReset?: () => void;
  resetLabel?: string;
  resetHint?: string;
  disabled?: boolean;
  /** Extra controls (e.g. sliders) rendered below the transport row. */
  children?: ReactNode;
}

/**
 * Transport row: play/pause (primary→pause), optional step and reset, plus any
 * extra controls below. Labels are passed in so i18n stays with the caller;
 * the toggling play/pause label is scrambled on change.
 */
export default function ControlBar({
  playing,
  onPlayPause,
  playLabel,
  pauseLabel,
  onStep,
  stepLabel = "step",
  stepHint,
  onReset,
  resetLabel = "reset",
  resetHint,
  disabled,
  children,
}: Props) {
  return (
    <div className="ui-controlbar">
      <div className="ui-controlbar-row">
        <Button
          variant={playing ? "pause" : "primary"}
          onClick={onPlayPause}
          disabled={disabled}
          aria-pressed={playing}
        >
          <ScrambleText text={playing ? pauseLabel : playLabel} duration={400} />
        </Button>
        {onStep && (
          <Button onClick={onStep} disabled={disabled || playing} tooltip={stepHint}>
            <ScrambleText text={stepLabel} duration={400} />
          </Button>
        )}
        {onReset && (
          <Button variant="accent" onClick={onReset} tooltip={resetHint}>
            <ScrambleText text={resetLabel} duration={400} />
          </Button>
        )}
      </div>
      {children}
    </div>
  );
}
