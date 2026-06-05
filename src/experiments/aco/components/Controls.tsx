import { useTranslation } from "react-i18next";
import { ControlBar, Panel, Slider } from "../../../components/ui";
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
  const { t } = useTranslation();
  return (
    <Panel>
      <ControlBar
        playing={running}
        disabled={disabled}
        onPlayPause={onPlayPause}
        playLabel={t("experiments.aco.run")}
        pauseLabel={t("experiments.aco.pause")}
        onStep={onStep}
        stepLabel={t("experiments.aco.step")}
        stepHint={t("experiments.aco.step_hint")}
        onReset={onReset}
        resetLabel={t("experiments.aco.reset")}
        resetHint={t("experiments.aco.reset_hint")}
      >
        <Slider
          label={t("experiments.aco.speed")}
          value={speed}
          min={MIN_SPEED}
          max={MAX_SPEED}
          onChange={onSpeed}
        />
        <Slider
          label={t("experiments.aco.trails")}
          value={trail}
          min={0}
          max={100}
          onChange={onTrail}
          hint={t("experiments.aco.trails_hint")}
        />
      </ControlBar>
    </Panel>
  );
}
