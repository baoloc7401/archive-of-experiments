/** Shell / diagnostic lines for the self-typing terminal. These are CLI
 *  snippets, intentionally left untranslated (see CLAUDE.md i18n exemptions). */
export const TERMINAL_LINES: ReadonlyArray<{ cmd: string; out: string }> = [
  {
    cmd: '$ find / -name "the-page-you-wanted"',
    out: "find: nothing matches in this archive",
  },
  {
    cmd: "$ cd /experiments/the-one-you-wanted",
    out: "bash: cd: no such experiment",
  },
  {
    cmd: "$ git checkout that-page",
    out: "error: pathspec 'that-page' did not match anything",
  },
  {
    cmd: "$ sudo make page-appear",
    out: "make: *** no rule to make target 'page-appear'.  stop.",
  },
  {
    cmd: "$ ./summon-the-page.sh",
    out: "segmentation fault (core dumped)",
  },
  {
    cmd: "$ ping the-page.exe",
    out: "request timed out - the page is not home",
  },
];

/** Mood kaomoji for the draggable mascot. Kaomoji are language-neutral and
 *  exempt from translation. */
export const FACE_GRAB = "(°□°)";
export const FACE_DIZZY = "(@_@)";
