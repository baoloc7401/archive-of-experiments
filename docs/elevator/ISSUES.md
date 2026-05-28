# Elevator Scheduling — Known Issues & Craft Log

Reference:
[`src/experiments/elevator/algorithms.ts`](../../src/experiments/elevator/algorithms.ts),
[`src/experiments/elevator/useSimulation.ts`](../../src/experiments/elevator/useSimulation.ts),
[`src/experiments/elevator/components/Building.tsx`](../../src/experiments/elevator/components/Building.tsx),
[`src/experiments/elevator/Elevator.css`](../../src/experiments/elevator/Elevator.css)

This is the running record of bugs hit, *why* they happened, and the design
decisions taken so they don't get re-litigated or regressed. Read it before
touching the animation or the scheduling decisions.

---

## ISSUE-1: Car "teleports" between floors instead of gliding ("nausea jumping")

**Status:** Fixed (three independent causes) — needs in-browser confirmation
**Severity:** High — the whole point of the experiment is watching the car move

The car snapping from floor to floor had **three** distinct causes discovered in
sequence. All three are fixed; any one regressing brings the jumping back.

### 1a. Transition duration outran the tick at higher speeds — **FIXED**
The original transition was a fixed `0.45s`, but the tick interval ranges from
1200ms (0.5×) down to 80ms (8×). When the transition was longer than the tick,
the car lagged its logical floor and then snapped to catch up when the queue
drained. Fix: the car's transition duration is driven by the live tick interval
via `--elev-move-ms` (`Math.max(60, tickMs * 0.92)`, set on `.elev-building` in
[`Building.tsx`](../../src/experiments/elevator/components/Building.tsx)), so one
floor-move lands just before the next tick fires.

### 1b. Position driven through a CSS variable never transitioned — **FIXED** (PRIMARY)
v2 positioned the car with
`transform: translate(-50%, calc(var(--elev-row) * 100%))`. **Unregistered CSS
custom properties are substituted at *used-value* time**, so the *computed* value
of `transform` stayed the literal `calc(var(--elev-row) * 100%)` string and never
changed when `--elev-row` changed. CSS transitions fire on computed-value
changes, so the transition never started — every move was an instant teleport.
Fix: the car's transform is now a **concrete** value computed in JS
(`translate(-50%, ${rowFromTop * 100}%)`, set inline in
[`Building.tsx`](../../src/experiments/elevator/components/Building.tsx)); the CSS
keeps only the `transition`. Do **not** route the animated transform back through
a CSS var unless it is registered with `@property`.

### 1c. `prefers-reduced-motion` forced an instant teleport — **FIXED**
The reduced-motion media query set `.elev-car { transition-duration: 0.01ms }`,
i.e. an instant snap on every move. If the user's OS has reduced-motion enabled,
that overrode 1a/1b and re-teleported all cars regardless. Fix: reduced-motion
now **keeps the elevator glide** (the movement *is* the content) and only
disables the decorative looping pulses (glow / arrow / hall-button). See the
media query at the bottom of
[`Elevator.css`](../../src/experiments/elevator/Elevator.css).

---

## ISSUE-2: C-SCAN / C-LOOK circular return modelled as a single instant step

**Status:** Fixed (re-modelled) — needs in-browser confirmation
**Severity:** Medium — produced an unphysical "teleport"; also understated cost

The **scheduling decisions were always correct** (verified against textbook
C-SCAN / C-LOOK on a real debug log). The real defect was in the *model*: the
circular return ("wrap" / "jump") was collapsed into a **single tick** that moved
the car many floors at once. That left only bad visual options — animate it as a
fast full-height glide (looked "weird": an up-only car sliding *down* through
floors it won't serve) or fake it with a fade-teleport + trail (worse — **real
elevators do not teleport**, and dressing it up with an animation made it more
wrong, not less).

### Wrong turns taken (do not repeat)
- A **downward glide** of the whole wrap in one tick → read as the up-only car
  travelling down through skipped floors. Rejected.
- A **fade-teleport** (`.elev-car--jumping` + `@keyframes elev-warp`) plus a
  **ghost-trail streak** (`.elev-warp-trail`) → rejected outright by the user:
  an elevator that vanishes and reappears is not an elevator. All of that CSS/JSX
  was removed.

### Fix: model the return as a real, multi-tick, non-stop EXPRESS run
A circular return is physically just an express trip — the car **travels down
floor-by-floor at normal speed, it simply doesn't stop to serve anyone**. So:

- `decideCSCAN` / `decideCLOOK` no longer return a multi-floor jump; they return a
  one-floor-down step plus an `express` target (C-SCAN → floor 0, C-LOOK → lowest
  pending request). See [`algorithms.ts`](../../src/experiments/elevator/algorithms.ts).
- `ElevatorState.express` holds the in-progress target. While set, the reducer
  moves the car one floor toward it **without serving**, then clears it on
  arrival and resumes normal service. See the `tick` reducer in
  [`useSimulation.ts`](../../src/experiments/elevator/useSimulation.ts).
- Visually this is **identical to every other move** — the same honest
  floor-by-floor glide via the concrete-transform transition (ISSUE-1). No
  teleport, no fade, no trail. The only cue is a faint downward-trailing glow
  (`.elev-car--express`) so you can see it's passing floors rather than serving.

This is also **more accurate for the comparison**: the return seek now costs real
ticks (wait times reflect it), where the old single-tick jump understated
C-SCAN / C-LOOK's cost. Total travel was already counted; now elapsed time is too.

### Observed behaviour (expected, by design)
- Send a car up by calling a high floor → it **services its way up**, glides and
  stops at each served floor.
- Then call a low floor while it's parked high → nothing is above it, so it begins
  the **express descent**: a continuous floor-by-floor glide *down* with no stops
  (C-LOOK to the lowest request, C-SCAN to floor 0), then it resumes serving on
  the way back up. It is *travel*, not a teleport.

### Reversal accounting
Starting an express flips the heading up→down, and the express→service transition
flips it back — but **neither counts as a reversal**. C-SCAN / C-LOOK wrap instead
of reversing; that is their whole selling point, so they must report ~0 reversals.
The reducer suppresses both (express initiation isn't counted, and the arrival
step pre-sets the heading back to `up`). Don't reintroduce a phantom reversal here.

---

## ISSUE-3: C-SCAN crawled to the top floor on an idle restart

**Status:** Fixed
**Severity:** Medium — wasted up to a full building height of pointless travel

When C-SCAN went idle mid-building and a new call arrived **below** it, the
up-only rule made it trundle all the way to the top floor just to wrap around —
e.g. idle at F04, F00 called, car climbed F04→F11 (7 empty floors) then warped to
F00. Textbook-correct for a continuously-sweeping disk head, but absurd for an
idle elevator.

**Fix:** `decide()` now receives an `idle` flag (true on the tick the car
restarts from a standstill, where its stored `direction` is stale). In
`decideCSCAN`, if the car is restarting from idle and there are **no** calls above
it, it wraps straight to the ground floor instead of climbing to the top. During
an *active* sweep it still runs textbook C-SCAN (up to the top, then wrap). See
[`algorithms.ts`](../../src/experiments/elevator/algorithms.ts). C-LOOK already
handled this — it wraps to the lowest *request*, not the physical floor 0.

---

## Design decisions (the "craft") — don't regress these

- **FCFS is deliberately strict.** It only *targets* the head-of-queue request, so
  it visibly zig-zags past closer floors. But once it physically arrives at a
  floor, everyone waiting there is served (a real car wouldn't refuse to open its
  doors). All other algorithms serve every request at the current floor
  (pickup-en-passant). See the `tick` reducer in
  [`useSimulation.ts`](../../src/experiments/elevator/useSimulation.ts).
- **C-SCAN vs C-LOOK distinction must survive.** C-SCAN wraps to the **physical**
  ground floor (0); C-LOOK wraps to the **lowest pending request**. If a refactor
  makes them wrap to the same place they become indistinguishable.
- **Comparison mode = one shared workload, N independent cars.** Every hall/car
  call is added to every selected elevator; each runs its own scheduler on its own
  state. Ticks are synchronized (one timer drives all cars). A call is "active"
  (shown lit / in the queue) until *every* car has served it.
- **Changing the algorithm selection resets everything** — positions, calls, *and*
  the history log — so each line-up races from a clean slate. This is intentional;
  the history clearing on selection change is a requested feature, not a bug.
- **Reversal counting ignores the idle→moving transition.** Choosing a direction
  out of a standstill is not a "reversal"; only flipping direction while already
  moving counts. (`reversed = newDir !== oldDir && !idle`.)
- **History log:** capped at 600 entries in state; only the last 80 are rendered
  to the DOM to keep per-tick re-renders cheap in compare mode. **Copy exports the
  full retained log**, so the rendered cap must never be used as the copy source.

---

## Notes / open questions

- SCAN has the same latent idle-restart quirk as C-SCAN (could climb to the wall
  on a stale direction), but it has not been reported and going to the wall is
  SCAN's defining trait, so it is left textbook for now.
- The animation is **tick-synchronized**, not time-budgeted: at 8× (80ms tick) the
  glide is ~74ms. Fast but smooth. Every move — including each step of a C-SCAN /
  C-LOOK express descent — is a single one-floor glide, so there is no special
  case to keep in sync.
- Verification is manual (`npm run dev`) — there are no automated tests for the
  visualization. Confirm in-browser after any change to the car transform, the
  `--elev-move-ms` plumbing, or the reduced-motion block.
