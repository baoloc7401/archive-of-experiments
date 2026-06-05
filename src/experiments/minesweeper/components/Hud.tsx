import { useTranslation } from "react-i18next";
import { Tooltip } from "../../../components/ui";
import type { GameStatus } from "../types";

interface Props {
  minesLeft: number;
  status: GameStatus;
  onReset: () => void;
}

const FACE: Record<GameStatus, string> = {
  fresh: "( •_•)",
  playing: "(・_・)",
  won: "(^▽^)",
  lost: "(x_x)",
};

export default function Hud({ minesLeft, status, onReset }: Props) {
  const { t } = useTranslation();
  return (
    <div className="ms-hud">
      <Tooltip label={t("experiments.minesweeper.hud.mines_left")}>
        <div className="ms-hud-counter">
          <span className="ms-hud-mine">✸</span>
          <span className="ms-hud-num">{String(minesLeft).padStart(3, "0")}</span>
        </div>
      </Tooltip>

      <Tooltip label={t("experiments.minesweeper.hud.reset_hint")}>
        <button
          className="ms-face"
          onClick={onReset}
          aria-label={t("experiments.minesweeper.hud.reset")}
        >
          {FACE[status]}
        </button>
      </Tooltip>
    </div>
  );
}
