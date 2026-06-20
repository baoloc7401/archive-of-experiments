# Pac-Man - Known Issues

Reference:
[`src/experiments/pacman/simulation.ts`](../../src/experiments/pacman/simulation.ts),
[`src/experiments/pacman/render.ts`](../../src/experiments/pacman/render.ts),
[`src/experiments/pacman/sound.ts`](../../src/experiments/pacman/sound.ts),
[`src/experiments/pacman/components/PacmanCanvas.tsx`](../../src/experiments/pacman/components/PacmanCanvas.tsx)

A thorough review of `src/experiments/pacman/`, with emphasis on the recent
score-popup, sound, and licensing work. Companion to
[IMPROVEMENTS.md](./IMPROVEMENTS.md) (which tracks the planned feature ladder);
this file tracks bugs, risks, and debt. None of these block the current build
(`tsc` + `lint` + `build` are clean). The `**Area:**` tag preserves the original
grouping (correctness, performance, accessibility, UX, tech debt, licensing).

Severity: **High** (correctness, fix soon) · **Medium** (quality / polish) · **Low** (nice-to-have / future).
Status: **Open** · **Fixed** · **Fixed (needs verification)** · **Resolved** · **Skipped**.

> **2026-06-20 pass 1:** all low-effort actionable items fixed.
> **2026-06-20 pass 2:** montecarlo seeded RNG, extra-life/1UP, ambient siren +
> fright warning, and repo-wide notice all implemented. Items below are marked
> by Status; the rest are larger or design decisions.

---

## ISSUE-1: Score popups freeze (do not age) while paused or during the death animation

**Status:** Resolved · **Severity:** Medium · **Area:** Correctness & robustness

`state.popups` are aged only inside `step()` ([simulation.ts](../../src/experiments/pacman/simulation.ts)).
- **Resolved:** popups are cleared when entering `dying`, and `drawPopups`
  ([render.ts](../../src/experiments/pacman/render.ts)) now skips any entry past
  `POPUP_DURATION` as a guard. (The pause case is inherent - no rAF runs while
  paused - but the visible artifacts on death are gone.)

---

## ISSUE-2: Batched sound cues from one rendered frame all schedule at the same time

**Status:** Resolved · **Severity:** Medium · **Area:** Correctness & robustness

If two substeps in a single frame both eat a dot, two identical `chomp` blips
fired at the same instant (constructive overlap = "double-volume" click).
- **Resolved:** `drainSfx`
  ([PacmanCanvas.tsx](../../src/experiments/pacman/components/PacmanCanvas.tsx))
  now dedupes identical cues per drain via a `Set`, so each distinct cue plays
  at most once per frame.

---

## ISSUE-3: First cue after unmute can be missed

**Status:** Resolved · **Severity:** Low · **Area:** Correctness & robustness

`AudioContext.resume()` is async, so the first cue in the same tick could drop.
- **Resolved:** `setMuted(false)` ([sound.ts](../../src/experiments/pacman/sound.ts))
  now warms the graph with one silent 1-sample buffer on unmute.

---

## ISSUE-4: `montecarlo` driver is non-deterministic (`Math.random`)

**Status:** Resolved · **Severity:** Low · **Area:** Correctness & robustness

- **Resolved:** [montecarlo.ts](../../src/experiments/pacman/pacai/montecarlo.ts)
  now uses a module-level mulberry32 PRNG reseeded each `choose` call from a hash
  of the live state (pac tile + dir, `dotsEaten`, every ghost id + dir). The
  driver is now a deterministic function of game state - same position yields the
  same decision, and the rollout-fan overlay no longer shimmers. Verified
  headless: two `choose` calls on equal states return identical dir + candidates.

---

## ISSUE-5: Popup culling reallocates the array

**Status:** Resolved · **Severity:** Low · **Area:** Performance

`state.popups = state.popups.filter(...)` allocated a new array on each cull.
- **Resolved:** replaced with an in-place write-index compaction in `step()`
  ([simulation.ts](../../src/experiments/pacman/simulation.ts)) - zero-alloc.

---

## ISSUE-6: AudioContext is a module singleton that is never closed

**Status:** Resolved · **Severity:** Low · **Area:** Performance

- **Resolved:** `closeAudio()` ([sound.ts](../../src/experiments/pacman/sound.ts))
  releases the context, called from a PacmanCanvas unmount effect; it is
  recreated lazily on the next unmute.

---

## ISSUE-7: Score changes are visual + audio only; no text-equivalent announcement

**Status:** Resolved · **Severity:** Medium · **Area:** Accessibility

The floating popups and blips convey score deltas, but a screen-reader user got
neither.
- **Resolved:** the score `Stat` value is wrapped in an `aria-live="polite"`
  span ([Sidebar.tsx](../../src/experiments/pacman/components/Sidebar.tsx)), so
  the running total is announced as it changes.

---

## ISSUE-8: No volume control, only on/off

**Status:** Skipped · **Severity:** Low · **Area:** Accessibility

Deferred by request. Master gain is fixed at `0.18`; a `Slider`-based volume
control remains a possible future addition.

---

## ISSUE-9: Sound preference is not persisted

**Status:** Resolved · **Severity:** Low · **Area:** UX / polish

`soundOn` reset to `false` on every load.
- **Resolved:** `soundOn` now initializes from and persists to
  `localStorage["pacman.sound"]` ([index.tsx](../../src/experiments/pacman/index.tsx)),
  wrapped in try/catch, still defaulting off on first visit.

---

## ISSUE-10: `sound_hint` tooltip copy is now stale

**Status:** Resolved · **Severity:** Low · **Area:** UX / polish

- **Resolved:** generalized to "classic arcade blips synthesized live - a
  distinct sound for every event" (en + vi).

---

## ISSUE-11: Dot popups can still feel busy

**Status:** Skipped · **Severity:** Low · **Area:** UX / polish

Deferred by request. Every score mutation floats a number (magnitude sizing
keeps `+10`s small); an "all / specials only / off" density control remains a
possible future refinement.

---

## ISSUE-12: `SfxCue` and `PelletKind` overlap implicitly

**Status:** Resolved · **Severity:** Low · **Area:** Tech debt / maintainability

- **Resolved:** added an explanatory comment at the `state.sfx.push(...)` site
  in `eatContent` noting the union coupling is intentional and `tsc`-checked.

---

## ISSUE-13: Popup/sfx transient state lives on `PacmanState`

**Status:** Resolved · **Severity:** Low · **Area:** Tech debt / maintainability

- **Resolved:** added a note on the `popups`/`sfx` fields in
  [types.ts](../../src/experiments/pacman/types.ts) clarifying they are
  view-feedback channels, not simulation state (and `computeSnapshot` ignores
  them).

---

## ISSUE-14: No extra-life / 1UP

**Status:** Resolved · **Severity:** Low · **Area:** Feature gap

A bonus life is now awarded the first time the score reaches `EXTRA_LIFE_SCORE`
(10,000): `lives++`, a green "1UP" popup, and an `extralife` jingle. Tracked by
`state.extraLifeAwarded` (set in `makeInitialState`, never reset on respawn so it
fires once per game). Verified headless (awarded once, not twice).

---

## ISSUE-15: No ambient ghost "siren" / fright warning

**Status:** Resolved · **Severity:** Low · **Area:** Feature gap

Added a continuous low siren ([sound.ts](../../src/experiments/pacman/sound.ts)
`setSiren`/`stopSiren`) that hums during play and rises in pitch + volume as the
nearest lethal ghost closes in (driven once per frame from
[PacmanCanvas.tsx](../../src/experiments/pacman/components/PacmanCanvas.tsx)
`sirenLevel`; flattens to a warble while frightened; stops on pause / mute /
win-loss / unmount). Plus a one-shot `frightwarn` double-blip when the energizer
timer dips past `FRIGHT_WARN_SECONDS` (2s). All synthesized, no samples.

---

## ISSUE-16: `DEATH_DURATION` is shorter than the arcade

**Status:** Open (by design) · **Severity:** Low · **Area:** Feature gap

`DEATH_DURATION` is 0.3s, much shorter than the arcade. Intentional for
legibility, but flagged so it is a conscious choice.

---

## ISSUE-17: The non-affiliation disclaimer is the only safeguard

**Status:** Open · **Severity:** Medium · **Area:** Licensing

The non-affiliation disclaimer ([NOTICE.md](../../NOTICE.md), in-experiment
`trademark` line, en + vi) and synthesized-audio approach are in place and are
the correct posture for a non-commercial educational homage. The disclaimer is
widely tolerated but not a *granted* license. The only way to fully own the IP
is to de-brand: rename the experiment + ghosts to generic equivalents so the
repo's CC BY-NC 4.0 cleanly covers everything. Tracked here as the open
alternative if ever wanted.

---

## ISSUE-18: Keep the audio generic

**Status:** Open · **Severity:** Low · **Area:** Licensing

When adding the suggested siren/jingle/win cues, continue to avoid transcribing
Bandai Namco's actual compositions note-for-note (the current `win` cue is a
plain major run on purpose).

---

## ISSUE-19: Surface the notice repo-wide

**Status:** Resolved · **Severity:** Low · **Area:** Licensing

- **Resolved:** added a "License & notices" section to [README.md](../../README.md)
  linking `LICENSE` and `NOTICE.md`, so the attribution is discoverable outside
  the experiment itself.

---

## Verified clean / not issues

- Engine stays framework-free; `sound.ts` is imported only by the React/canvas
  layer, never by the sim.
- `drainSfx` always clears the queue even while muted, so a muted run cannot
  back up a burst of blips on unmute.
- Net-delta read in `eatContent` correctly captures the trap's in-`onEat`
  penalty as a negative popup.
- `exponentialRampToValueAtTime` targets are clamped away from 0 (`0.0001`,
  `Math.max(1, slideTo)`), avoiding the "cannot ramp to 0" exception.
- i18n parity (en/vi) is compile-enforced and passes.
</content>
</invoke>
