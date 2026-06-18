import { useTranslation } from "react-i18next";
import ScrambleText from "../../../components/ScrambleText";
import { Button, ControlBar, Panel, Stat, StatGrid } from "../../../components/ui";
import { GHOST_COLOR } from "../constants";
import { PAC_STRATEGY_IDS, type PacController } from "../pacai";
import type { Direction, GhostId, GhostSnapshot, Snapshot } from "../types";

interface Props {
  snap: Snapshot | null;
  running: boolean;
  onPlayPause: () => void;
  onStep: () => void;
  onReset: () => void;
  showOverlay: boolean;
  onToggleOverlay: () => void;
  showPaths: boolean;
  onTogglePaths: () => void;
  showDanger: boolean;
  onToggleDanger: () => void;
  explainMode: boolean;
  onToggleExplain: () => void;
  hoveredId: GhostId | null;
  enabled: Record<GhostId, boolean>;
  onToggleGhost: (id: GhostId) => void;
  pacController: PacController;
  onSetController: (c: PacController) => void;
}

const GHOST_NAME: Record<GhostId, string> = {
  blinky: "Blinky",
  pinky: "Pinky",
  inky: "Inky",
  clyde: "Clyde",
  warden: "Warden",
};

const DIR_GLYPH: Record<Direction, string> = {
  up: "↑",
  down: "↓",
  left: "←",
  right: "→",
};

export default function Sidebar({
  snap,
  running,
  onPlayPause,
  onStep,
  onReset,
  showOverlay,
  onToggleOverlay,
  showPaths,
  onTogglePaths,
  showDanger,
  onToggleDanger,
  explainMode,
  onToggleExplain,
  hoveredId,
  enabled,
  onToggleGhost,
  pacController,
  onSetController,
}: Props) {
  const { t } = useTranslation();

  /** Plain-language breakdown of a ghost's decision this frame. */
  function explain(g: GhostSnapshot): string[] {
    const lines: string[] = [t(`experiments.pacman.role_${g.id}`)];
    if (g.mode === "frightened") lines.push(t("experiments.pacman.note_frightened"));
    else if (g.mode === "eaten") lines.push(t("experiments.pacman.note_eaten"));
    else if (g.id === "warden")
      lines.push(
        t(g.hunting ? "experiments.pacman.warden_hunt" : "experiments.pacman.chase_warden"),
      );
    else if (g.mode === "scatter") lines.push(t("experiments.pacman.note_scatter"));
    else if (g.id === "clyde" && g.retreating) lines.push(t("experiments.pacman.clyde_retreat"));
    else lines.push(t(`experiments.pacman.chase_${g.id}`));
    if (g.upOverflow && (g.id === "pinky" || g.id === "inky")) {
      lines.push(t(`experiments.pacman.bug_${g.id}_up`));
    }
    return lines;
  }

  const hovered = snap?.ghosts.find((g) => g.id === hoveredId) ?? null;

  return (
    <>
      <ControlBar
        playing={running}
        onPlayPause={onPlayPause}
        playLabel={t("experiments.pacman.run")}
        pauseLabel={t("experiments.pacman.pause")}
        onStep={onStep}
        stepLabel={t("experiments.pacman.step")}
        stepHint={t("experiments.pacman.step_hint")}
        onReset={onReset}
        resetLabel={t("experiments.pacman.reset")}
        resetHint={t("experiments.pacman.reset_hint")}
      >
        <div className="pacman-toggles">
          <Button
            variant={showOverlay ? "primary" : "ghost"}
            size="sm"
            aria-pressed={showOverlay}
            onClick={onToggleOverlay}
            tooltip={t("experiments.pacman.overlay_hint")}
          >
            <ScrambleText text={t("experiments.pacman.overlay")} duration={400} />
          </Button>
          <Button
            variant={showPaths ? "primary" : "ghost"}
            size="sm"
            aria-pressed={showPaths}
            onClick={onTogglePaths}
            tooltip={t("experiments.pacman.paths_hint")}
          >
            <ScrambleText text={t("experiments.pacman.paths")} duration={400} />
          </Button>
          <Button
            variant={showDanger ? "primary" : "ghost"}
            size="sm"
            aria-pressed={showDanger}
            onClick={onToggleDanger}
            tooltip={t("experiments.pacman.danger_hint")}
          >
            <ScrambleText text={t("experiments.pacman.danger")} duration={400} />
          </Button>
          <Button
            variant={explainMode ? "accent" : "ghost"}
            size="sm"
            aria-pressed={explainMode}
            onClick={onToggleExplain}
            tooltip={t("experiments.pacman.explain_hint")}
          >
            <ScrambleText text={t("experiments.pacman.explain")} duration={400} />
          </Button>
        </div>
      </ControlBar>

      <Panel title={t("experiments.pacman.driver")} collapsible={false}>
        <div className="pacman-drivers">
          <Button
            size="sm"
            variant={pacController === "human" ? "primary" : "ghost"}
            aria-pressed={pacController === "human"}
            onClick={() => onSetController("human")}
          >
            <ScrambleText text={t("experiments.pacman.driver_you")} duration={400} />
          </Button>
          {PAC_STRATEGY_IDS.map((id) => (
            <Button
              key={id}
              size="sm"
              variant={pacController === id ? "primary" : "ghost"}
              aria-pressed={pacController === id}
              tooltip={t(`experiments.pacman.ai_desc_${id}`)}
              onClick={() => onSetController(id)}
            >
              <ScrambleText text={t(`experiments.pacman.ai_name_${id}`)} duration={400} />
            </Button>
          ))}
        </div>
        {snap && snap.pac.controller !== "human" && (
          <div className="pacman-ai-why">
            <p className="pacman-explain-line">
              <ScrambleText
                text={t(`experiments.pacman.ai_note_${snap.pac.noteKey}`)}
                duration={500}
              />
            </p>
            {snap.pac.target && (
              <p className="pacman-ai-meta">
                {t("experiments.pacman.target")}: {snap.pac.target.col},{snap.pac.target.row}
              </p>
            )}
          </div>
        )}
      </Panel>

      <StatGrid columns={2}>
        <Stat label={t("experiments.pacman.score")} value={snap?.score ?? 0} />
        <Stat label={t("experiments.pacman.lives")} value={snap?.lives ?? 0} />
        <Stat
          label={t("experiments.pacman.pellets")}
          value={snap ? `${snap.pelletsLeft}/${snap.totalPellets}` : "-"}
        />
        <Stat
          label={t("experiments.pacman.mode")}
          value={<ScrambleText text={t(`experiments.pacman.mode_${snap?.mode ?? "scatter"}`)} duration={400} />}
          highlight={snap?.frightened}
        />
      </StatGrid>

      {explainMode && (
        <Panel title={t("experiments.pacman.explain")} collapsible={false}>
          {hovered ? (
            <div className="pacman-explain">
              <div className="pacman-explain-head" style={{ color: GHOST_COLOR[hovered.id] }}>
                {GHOST_NAME[hovered.id]}
              </div>
              {explain(hovered).map((line, i) => (
                <p key={i} className="pacman-explain-line">
                  <ScrambleText text={line} duration={500} />
                </p>
              ))}
            </div>
          ) : (
            <p className="pacman-explain-prompt">
              <ScrambleText text={t("experiments.pacman.explain_prompt")} duration={500} />
            </p>
          )}
        </Panel>
      )}

      <Panel title={t("experiments.pacman.ghosts")} collapsible={false}>
        <div className="pacman-ghosts">
          {(snap?.ghosts ?? []).map((g) => {
            const on = enabled[g.id];
            return (
              <button
                key={g.id}
                type="button"
                className={`pacman-ghost-card${hoveredId === g.id ? " is-hovered" : ""}${on ? "" : " is-off"}`}
                aria-pressed={on}
                aria-label={t("experiments.pacman.toggle_ghost", { name: GHOST_NAME[g.id] })}
                onClick={() => onToggleGhost(g.id)}
              >
                <span className="pacman-ghost-dot" style={{ background: GHOST_COLOR[g.id] }} />
                <span className="pacman-ghost-name">{GHOST_NAME[g.id]}</span>
                <span className={`pacman-badge pacman-badge--${on ? g.mode : "off"}`}>
                  <ScrambleText
                    text={on ? t(`experiments.pacman.mode_${g.mode}`) : t("experiments.pacman.inactive")}
                    duration={400}
                  />
                </span>
                {on && (
                  <>
                    <span className="pacman-ghost-meta">
                      {t("experiments.pacman.target")}:{" "}
                      {g.mode === "frightened"
                        ? t("experiments.pacman.target_flee")
                        : `${g.target.col},${g.target.row}`}
                    </span>
                    <span className="pacman-ghost-meta">
                      {t("experiments.pacman.distance")}: {g.distance} · {DIR_GLYPH[g.chosen]}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </Panel>
    </>
  );
}
