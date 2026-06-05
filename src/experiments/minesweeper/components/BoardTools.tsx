import { useTranslation } from "react-i18next";
import ScrambleText from "../../../components/ScrambleText";
import { Tooltip } from "../../../components/ui";

interface Props {
  flagMode: boolean;
  onFlagMode: (v: boolean) => void;
  peek: boolean;
  onPeek: (v: boolean) => void;
  /** Peek only means something once a field exists. */
  hasField: boolean;
  showOdds: boolean;
  onShowOdds: (v: boolean) => void;
  /** Odds only exist after a probabilistic solve. */
  hasOdds: boolean;
  /** Disable everything while the auto-solver drives the board. */
  disabled: boolean;
}

/** The three board-view toggles (flag-mode, peek-mines, show-odds), each disabled
 *  until it's meaningful. */
export default function BoardTools({
  flagMode,
  onFlagMode,
  peek,
  onPeek,
  hasField,
  showOdds,
  onShowOdds,
  hasOdds,
  disabled,
}: Props) {
  const { t } = useTranslation();
  return (
    <div className="ms-toolbar" role="group" aria-label={t("experiments.minesweeper.solver.title")}>
      <Tooltip label={t("experiments.minesweeper.hud.flag_hint")}>
        <button
          type="button"
          className={`ms-mini ms-flagmode${flagMode ? " ms-mini--on" : ""}`}
          onClick={() => onFlagMode(!flagMode)}
          disabled={disabled}
          aria-pressed={flagMode}
        >
          <ScrambleText text={t("experiments.minesweeper.hud.flag")} duration={500} />
        </button>
      </Tooltip>

      <Tooltip label={t("experiments.minesweeper.gen.peek_hint")}>
        <button
          type="button"
          className={`ms-mini${peek ? " ms-mini--on" : ""}`}
          onClick={() => onPeek(!peek)}
          disabled={disabled || !hasField}
          aria-pressed={peek}
        >
          <ScrambleText
            text={t(peek ? "experiments.minesweeper.gen.unpeek" : "experiments.minesweeper.gen.peek")}
            duration={500}
          />
        </button>
      </Tooltip>

      <Tooltip label={t("experiments.minesweeper.solver.odds")}>
        <button
          type="button"
          className={`ms-mini${showOdds ? " ms-mini--on" : ""}`}
          onClick={() => onShowOdds(!showOdds)}
          disabled={disabled || !hasOdds}
          aria-pressed={showOdds}
        >
          <ScrambleText
            text={t(showOdds ? "experiments.minesweeper.solver.hide_odds" : "experiments.minesweeper.solver.odds")}
            duration={500}
          />
        </button>
      </Tooltip>
    </div>
  );
}
