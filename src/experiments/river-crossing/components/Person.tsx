export type PersonKind = "m" | "c";

interface Props {
  kind: PersonKind;
  /** clickable when the bank/boat allows boarding or unboarding */
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  /** this missionary is being eaten — plays the death animation */
  doomed?: boolean;
}

/**
 * A single stylized figure — green-robed missionary (M) or red cannibal (C).
 * Rendered as a button so boarding/disembarking is keyboard-reachable; when no
 * handler is supplied it degrades to a static, non-interactive marker.
 */
export default function Person({ kind, onClick, disabled, title, doomed }: Props) {
  const label = kind === "m" ? "missionary" : "cannibal";
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
  return (
    <button
      type="button"
      className={cls}
      onClick={onClick}
      disabled={disabled}
      title={title ?? label}
      aria-label={title ?? label}
    >
      {body}
    </button>
  );
}
