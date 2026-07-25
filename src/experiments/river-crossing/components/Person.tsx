import { useTranslation } from "@/hooks/useTranslation";
import { Tooltip } from "@/components/ui";

export type PersonKind = "m" | "c";

interface Props {
  kind: PersonKind;
  /** clickable when the bank/boat allows boarding or unboarding */
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  /** this missionary is being eaten - plays the death animation */
  doomed?: boolean;
}

/**
 * A single stylized figure - green-robed missionary (M) or red cannibal (C).
 * Rendered as a button so boarding/disembarking is keyboard-reachable; when no
 * handler is supplied it degrades to a static, non-interactive marker.
 */
export default function Person({ kind, onClick, disabled, title, doomed }: Props) {
  const { t } = useTranslation();
  const label = t(
    kind === "m"
      ? "experiments.river-crossing.person.missionary"
      : "experiments.river-crossing.person.cannibal",
  );
  const cls = `rc-person rc-person--${kind}${doomed ? " rc-person--doomed" : ""}`;
  const body = (
    <>
      <span className="rc-person-head" />
      <span className="rc-person-body">{kind === "m" ? "M" : "C"}</span>
    </>
  );
  if (!onClick) {
    return (
      <span className={`${cls} rc-person--static`} aria-hidden="true">
        {body}
      </span>
    );
  }
  const tip = title ?? label;
  return (
    <Tooltip label={tip}>
      <button
        type="button"
        className={cls}
        onClick={onClick}
        disabled={disabled}
        aria-label={tip}
      >
        {body}
      </button>
    </Tooltip>
  );
}
