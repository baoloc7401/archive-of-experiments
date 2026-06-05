import { useTranslation } from "react-i18next";
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
      <div className="ms-hud-counter" title={t("experiments.minesweeper.hud.mines_left")}>
        <span className="ms-hud-mine">✸</span>
        <span className="ms-hud-num">{String(minesLeft).padStart(3, "0")}</span>
      </div>

      <button
        className="ms-face"
        onClick={onReset}
        title={t("experiments.minesweeper.hud.reset_hint")}
        aria-label={t("experiments.minesweeper.hud.reset")}
      >
        {FACE[status]}
      </button>
    </div>
  );
}
