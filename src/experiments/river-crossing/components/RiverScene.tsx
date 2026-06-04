import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import ScrambleText from "../../../components/ScrambleText";
import type { Load, Side, Status } from "../types";
import Person, { type PersonKind } from "./Person";

interface Props {
  leftBank: Load;
  rightBank: Load;
  board: Load;
  dock: Side;
  boatSide: Side;
  crossing: boolean;
  status: Status;
  /** index into the i18n death-shout list, shown over the bank where eaten */
  deathShoutIndex: number | null;
  capacity: number;
  crossMs: number;
  onBoard: (kind: PersonKind) => void;
  onUnboard: (kind: PersonKind) => void;
}

/** When the puzzle is lost, the bank where cannibals outnumber missionaries. */
function doomedBank(left: Load, right: Load): Side | null {
  if (left.m > 0 && left.c > left.m) return "L";
  if (right.m > 0 && right.c > right.m) return "R";
  return null;
}

function people(load: Load): PersonKind[] {
  return [
    ...Array.from({ length: load.m }, () => "m" as const),
    ...Array.from({ length: load.c }, () => "c" as const),
  ];
}

export default function RiverScene({
  leftBank,
  rightBank,
  board,
  dock,
  boatSide,
  crossing,
  status,
  deathShoutIndex,
  capacity,
  crossMs,
  onBoard,
  onUnboard,
}: Props) {
  const { t } = useTranslation();
  const interactive = status === "playing" && !crossing;
  const seatsUsed = board.m + board.c;
  const emptySeats = Math.max(0, capacity - seatsUsed);
  const doomed = status === "lost" ? doomedBank(leftBank, rightBank) : null;
  const shouts = t("experiments.river-crossing.death_shouts", {
    returnObjects: true,
  }) as string[];
  const deathShout =
    deathShoutIndex != null && shouts.length > 0
      ? shouts[deathShoutIndex % shouts.length]
      : null;

  function bank(side: Side, load: Load) {
    const isDock = side === dock;
    const boardable = interactive && isDock;
    const isDoomed = side === doomed;
    return (
      <div
        className={`rc-bank rc-bank--${side === "L" ? "left" : "right"}`}
        data-doomed={isDoomed ? "" : undefined}
      >
        <div className="rc-bank-land" />
        {isDoomed && deathShout && (
          <div className="rc-deathbubble" role="status">
            <ScrambleText text={deathShout} duration={500} />
          </div>
        )}
        <div className="rc-bank-crowd">
          {people(load).map((kind, i) => (
            <Person
              key={`${side}-${kind}-${i}`}
              kind={kind}
              doomed={isDoomed && kind === "m"}
              onClick={boardable ? () => onBoard(kind) : undefined}
              title={boardable ? `board ${kind === "m" ? "missionary" : "cannibal"}` : undefined}
            />
          ))}
          {load.m + load.c === 0 && <span className="rc-bank-empty">empty</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="rc-scene" data-status={status}>
      <div className="rc-sky" aria-hidden="true" />
      {/* both bodies always exist; [data-theme] raises one and sets the other,
          and the transitioned `top` makes the swap a smooth day/night cycle. */}
      <div className="rc-celestial rc-sun" aria-hidden="true" />
      <div className="rc-celestial rc-moon" aria-hidden="true" />
      {bank("L", leftBank)}

      <div className="rc-water" aria-hidden="true" />

      {bank("R", rightBank)}

      <div
        className={`rc-boat rc-boat--${boatSide === "L" ? "left" : "right"}${
          crossing ? " rc-boat--crossing" : ""
        }`}
        style={{ "--rc-cross-ms": `${crossMs}ms` } as CSSProperties}
      >
        <div className="rc-boat-deck">
          {people(board).map((kind, i) => (
            <Person
              key={`boat-${kind}-${i}`}
              kind={kind}
              onClick={interactive ? () => onUnboard(kind) : undefined}
              title={interactive ? `disembark ${kind === "m" ? "missionary" : "cannibal"}` : undefined}
            />
          ))}
          {Array.from({ length: emptySeats }, (_, i) => (
            <span key={`seat-${i}`} className="rc-boat-seat" aria-hidden="true" />
          ))}
        </div>
        <div className="rc-boat-hull" aria-hidden="true" />
        <div className="rc-boat-wake" aria-hidden="true" />
      </div>
    </div>
  );
}
