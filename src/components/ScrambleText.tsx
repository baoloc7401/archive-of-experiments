import { useScrambledText, type Options } from "./useScrambledText";

interface Props extends Options {
  text: string;
}

export default function ScrambleText({
  text,
  startDelay,
  charDelay,
  maxDuration,
  duration,
}: Props) {
  const display = useScrambledText(text, {
    startDelay,
    charDelay,
    maxDuration,
    duration,
  });
  return <>{display}</>;
}
