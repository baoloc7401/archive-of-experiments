import { useTranslation } from "@/hooks/useTranslation";
import ScrambleText from "@/components/ScrambleText";
import { Button, ControlBar, Panel } from "@/components/ui";
import type { LParams } from "../types";
import { PRESETS } from "../constants";

interface Props {
  running: boolean;
  params: LParams;
  onPlayPause: () => void;
  onResetView: () => void;
  onToggleGrow: () => void;
  onReplay: () => void;
  onChange: (p: Partial<LParams>) => void;
}

export default function Controls({
  running,
  params,
  onPlayPause,
  onResetView,
  onToggleGrow,
  onReplay,
  onChange,
}: Props) {
  const { t } = useTranslation();

  const activePreset = PRESETS.find(
    (p) =>
      p.axiom === params.axiom &&
      p.rules === params.rules &&
      p.angle === params.angle &&
      p.iterations === params.iterations,
  )?.id ?? null;

  return (
    <>
      <Panel>
        <ControlBar
          playing={running}
          onPlayPause={onPlayPause}
          playLabel={t("experiments.l-system.spin")}
          pauseLabel={t("experiments.l-system.pause")}
          onReset={onResetView}
          resetLabel={t("experiments.l-system.recenter")}
          resetHint={t("experiments.l-system.recenter_hint")}
        >
          <div className="ls-actions">
            <Button
              variant={params.grow ? "accent" : "ghost"}
              size="sm"
              onClick={onToggleGrow}
              aria-pressed={params.grow}
              tooltip={t("experiments.l-system.grow_hint")}
            >
              <ScrambleText text={t("experiments.l-system.grow")} duration={400} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onReplay}
              tooltip={t("experiments.l-system.replay_hint")}
            >
              <ScrambleText text={t("experiments.l-system.replay")} duration={400} />
            </Button>
          </div>
        </ControlBar>
      </Panel>

      <Panel title={t("experiments.l-system.presets")}>
        <div className="ls-presets">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`ls-chip${preset.id === activePreset ? " ls-chip--on" : ""}`}
              aria-pressed={preset.id === activePreset}
              onClick={() =>
                onChange({
                  axiom: preset.axiom,
                  rules: preset.rules,
                  angle: preset.angle,
                  iterations: preset.iterations,
                  colorMode: preset.color ?? "depth",
                })
              }
            >
              <ScrambleText text={t(`experiments.l-system.preset_${preset.id}`)} duration={400} />
            </button>
          ))}
        </div>
      </Panel>
    </>
  );
}
