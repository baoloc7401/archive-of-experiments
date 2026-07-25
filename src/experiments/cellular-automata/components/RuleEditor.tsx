import { useTranslation } from "@/hooks/useTranslation";
import ScrambleText from "@/components/ScrambleText";
import { Panel, Slider } from "@/components/ui";
import type { RuleGenome } from "../types";
import { MAX_STATES, MIN_STATES } from "../constants";
import { PRESETS, hasBit, matchPreset, ruleToString, toggleBit, type RulePreset } from "../rules";

interface Props {
  genome: RuleGenome;
  onChange: (genome: RuleGenome) => void;
  /** Applies a preset's genome AND its recommended reseed density, then reseeds. */
  onPreset: (preset: RulePreset) => void;
}

const NEIGHBOR_COUNTS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

/**
 * Hand-craftable rule editor: preset chips plus a Golly-style birth/survive
 * toggle matrix (one button per neighbor count 0..8) and a states slider. No
 * direct precedent in this repo - the shape (a non-collapsible Panel with
 * labeled controls as the primary interaction) mirrors l-system's Editor.tsx.
 */
export default function RuleEditor({ genome, onChange, onPreset }: Props) {
  const { t } = useTranslation();
  const active = matchPreset(genome);

  return (
    <Panel
      title={t("experiments.cellular-automata.rule_title")}
      collapsible={false}
      aside={<span className="ca-rule-string">{ruleToString(genome)}</span>}
    >
      <div className="ca-presets">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={`ca-chip${preset.id === active ? " ca-chip--on" : ""}`}
            aria-pressed={preset.id === active}
            onClick={() => onPreset(preset)}
          >
            <ScrambleText
              text={t(`experiments.cellular-automata.preset_${preset.id}`)}
              duration={400}
            />
          </button>
        ))}
      </div>

      <div className="ca-rule-row">
        <span className="ca-rule-row-label">
          <ScrambleText text={t("experiments.cellular-automata.birth")} duration={400} />
        </span>
        <div className="ca-rule-grid">
          {NEIGHBOR_COUNTS.map((n) => (
            <button
              key={n}
              type="button"
              className={`ca-bit${hasBit(genome.birth, n) ? " ca-bit--on" : ""}`}
              aria-pressed={hasBit(genome.birth, n)}
              aria-label={t("experiments.cellular-automata.neighbor_birth_aria", { n })}
              onClick={() => onChange({ ...genome, birth: toggleBit(genome.birth, n) })}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="ca-rule-row">
        <span className="ca-rule-row-label">
          <ScrambleText text={t("experiments.cellular-automata.survive")} duration={400} />
        </span>
        <div className="ca-rule-grid">
          {NEIGHBOR_COUNTS.map((n) => (
            <button
              key={n}
              type="button"
              className={`ca-bit${hasBit(genome.survive, n) ? " ca-bit--on" : ""}`}
              aria-pressed={hasBit(genome.survive, n)}
              aria-label={t("experiments.cellular-automata.neighbor_survive_aria", { n })}
              onClick={() => onChange({ ...genome, survive: toggleBit(genome.survive, n) })}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <Slider
        label={t("experiments.cellular-automata.states")}
        value={genome.states}
        min={MIN_STATES}
        max={MAX_STATES}
        step={1}
        display={`${genome.states}`}
        onChange={(v) => onChange({ ...genome, states: v })}
        hint={t("experiments.cellular-automata.states_hint")}
      />
    </Panel>
  );
}
