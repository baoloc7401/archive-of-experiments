# Elevator Scheduling — Textbook & Real-World Research

Reference code:
[`algorithms.ts`](../../src/experiments/elevator/algorithms.ts),
[`useSimulation.ts`](../../src/experiments/elevator/useSimulation.ts),
[`constants.ts`](../../src/experiments/elevator/constants.ts).
Bug/craft log: [`ISSUES.md`](./ISSUES.md).

This is the research record for the six algorithms in the experiment: their
canonical definitions, how faithfully we model them, and — importantly — **where
the textbook model and a real elevator part ways.** Findings accumulated while
building and debugging the visualization.

---

## 0. The single most important finding

> **FCFS, SSTF, SCAN, LOOK, C-SCAN and C-LOOK are *disk-scheduling* algorithms.
> They are taught on an elevator metaphor, but they are not how real elevators
> are actually dispatched.**

In disk scheduling the "requests" are **cylinder numbers** — bare positions on a
line. The head has a position and a direction; a request is just "go to track
N." There is no notion of *which way the requester wants to travel*.

A real elevator request carries a **direction**: a person on floor 8 presses
**▼ down** because they want to go *down*. A real controller ("collective
control") only answers that down-call while the car is travelling down. None of
the six algorithms here model that — to them, a call at floor 8 is simply
"position 8," and whoever reaches floor 8 serves it regardless of which way they
or the car are going.

**Consequence in our sim:** the hall-call ▲/▼ buttons and the in-car buttons all
collapse to the same thing — a target floor. The up/down distinction is
**cosmetic** (it only colours the UI and the queue). This is *faithful to the
disk-scheduling algorithms* and *deliberately unfaithful to a real directional
elevator*. We chose the disk-scheduling definitions because those are the named
algorithms the experiment is about. A real-elevator controller (directional
collective, or modern destination-dispatch) is a separate, more complex beast and
is intentionally out of scope. See §8.

---

## 1. Shared model & terminology

| Term | Disk scheduling | This experiment |
|---|---|---|
| Cylinder / track | position on the platter | **floor** (0 = ground … 11 = top) |
| Head | the read/write head | the **elevator car** |
| Seek | head movement between tracks | car travel between floors |
| Request | I/O at a cylinder | a hall call or in-car destination |
| Seek distance | cylinders moved | **floors travelled** (our `totalTravel`) |

- **Tick** = one simulation step. A car moves **at most one floor per tick**.
- **Serve** = the car is at a requested floor and fulfils it (doors open).
- A car arrives at a floor at the end of tick *T* and *serves* it at *T+1*
  (serve happens at the start of a tick, before moving). This 1-tick
  arrive-then-serve applies uniformly, including express arrivals.
- **No-starvation** below means: every queued request is eventually served.

---

## 2. The algorithms

### FCFS — First-Come, First-Served
**Definition.** Serve requests strictly in the order they arrived, regardless of
position. No optimization.
**Character.** Fair (no starvation, no reordering); but the head zig-zags, giving
the **largest total seek** of the six under a scattered load.
**Our implementation.** `decideFCFS` always heads toward `pending[0]` (the oldest
request) and serves nothing it merely passes — so the zig-zag is preserved.
**Fidelity.** Faithful. One deliberate deviation: on *arrival* at the head's
floor it serves **every** request on that floor (doors open for all), so a repeat
call to an already-queued floor can be served ahead of an older call to a
different floor. Pure queue order would not.

### SSTF — Shortest Seek Time First
**Definition.** Always serve the pending request **nearest** the current head.
Greedy.
**Character.** Much better average seek/wait than FCFS, but **can starve** distant
requests if nearby ones keep arriving. Not globally optimal.
**Our implementation.** `decideSSTF` picks the minimum `|floor − position|` each
tick (tie → earliest queued) and steps toward it.
**Fidelity.** Faithful — including the starvation (we add **no** anti-aging;
mitigating it would make it not-SSTF). Re-evaluates greedily every tick.

### SCAN — the "elevator algorithm"
**Definition.** Move one direction servicing everything in the path **all the way
to the end of the disk**, then reverse and service the other way. It touches the
physical boundary even with no requests out there. (This is the move that earned
the family the "elevator" name — a car committed to a direction.)
**Character.** Uniform-ish service; no starvation; a request just behind the head
waits almost a full sweep.
**Our implementation.** `decideSCAN` continues to floor 0 / top and only reverses
at the boundary; serves en route.
**Fidelity.** Faithful, including the travel-to-the-wall behavior. *Caveat:* from
an idle restart it reuses the last (stale) direction, so it may run to the far
wall before turning back — textbook-consistent but see §3.

### LOOK
**Definition.** Like SCAN, but reverse at the **last request** in the current
direction instead of the physical end. ("Look" ahead; don't bother going to the
wall if nobody's there.) This is the everyday-elevator-feeling variant.
**Character.** Slightly less travel than SCAN, otherwise similar.
**Our implementation.** `decideLOOK` reverses as soon as there are no requests
remaining in the current direction.
**Fidelity.** Faithful. Idle restart is graceful (it picks the side with work).

### C-SCAN — Circular SCAN
**Definition.** Service in **one direction only** (here: up). Run to the physical
top, then **return non-stop to the physical bottom (floor 0) without serving
anyone**, then sweep up again. Treats the floors as a ring with the seam at the
physical ends.
**Character.** The **most uniform wait times** (every request is served on an
up-pass, so no one waits for a "near then far" swing); costs an extra non-serving
return trip, so a bit more total travel.
**Our implementation.** Up-only; runs to the top; the return is a real
**multi-tick express descent** to floor 0 (one floor per tick, serving no one),
then resumes up. The return is *travel*, never a teleport (see ISSUES §2).
**Fidelity.** Faithful in continuous operation. One deliberate deviation: on an
**idle restart** with all calls below, it expresses straight to floor 0 rather
than first climbing to the top (strict C-SCAN would do `5→top→0→…`). This was a
requested fix for an absurd-looking idle climb (§3).

### C-LOOK
**Definition.** Like C-SCAN, but don't visit the physical ends: serve up to the
**highest request**, then return non-stop to the **lowest request** (not floor 0),
then sweep up.
**Character.** Same uniform-wait benefit as C-SCAN with less wasted travel.
**Our implementation.** Up-only; when nothing remains above, expresses
(multi-tick, non-serving) down to the lowest pending request, then resumes up.
**Fidelity.** Faithful; no special-casing needed — the "wrap to lowest request"
rule already behaves well from idle.

---

## 3. The "idle restart" problem (a real finding)

The textbooks assume a **continuous** request stream, so "current direction" is
always well-defined. A visualization has **idle gaps** — the car parks, then a
new call arrives, and the stored direction is stale. What each algorithm does
from a standstill is a *modeling choice the textbook never has to make*:

- **LOOK / SSTF / FCFS** — naturally fine; they orient toward actual work.
- **SCAN** — kept textbook: reuses the last direction, so it can run to the far
  wall before turning back. Left as-is (it's literally "go to the end").
- **C-SCAN** — given a shortcut: from idle with everything below, it expresses
  straight to floor 0 instead of climbing to the top first, because the strict
  behavior (up a whole building, then back down the whole building) looked broken.

This leaves a known **inconsistency**: C-SCAN takes the idle shortcut, SCAN does
not. Defensible (C-SCAN's idle penalty was ~2× the building; SCAN's is ~1×), but
recorded here as a conscious trade between fidelity and not-looking-broken.

---

## 4. Modeling the circular return (the teleport saga)

A real finding the build forced into the open: **the C-SCAN/C-LOOK "jump" is not
instantaneous.** Early versions modeled the wrap as a single logic step that moved
the car many floors at once, which left only unphysical ways to draw it (instant
snap; fast full-height glide; a faked fade + trail). All were wrong because **a
real elevator cannot teleport.**

The correct model: the return is a **physical, non-stop express run** — the car
descends one floor per tick at normal speed and simply doesn't stop. Two payoffs
beyond honesty:

1. It animates with the exact same floor-by-floor glide as every other move — no
   special case.
2. **It costs real time.** The return seek now consumes ticks, so wait-time
   stats reflect it. The old single-tick jump *understated* C-SCAN/C-LOOK's true
   cost; counting it is both more faithful and fairer to the comparison.

(Full debugging narrative in [`ISSUES.md`](./ISSUES.md) §2.)

---

## 5. Comparison at a glance

| Algorithm | Direction model | Turns around at | Serves on return? | Starvation | Total travel | Wait-time uniformity |
|---|---|---|---|---|---|---|
| FCFS   | none (arrival order) | n/a | n/a | none | **worst** (zig-zag) | poor |
| SSTF   | greedy nearest | n/a | n/a | **possible** | low | uneven |
| SCAN   | bidirectional | physical end | yes | none | moderate | good |
| LOOK   | bidirectional | last request | yes | none | moderate (≤ SCAN) | good |
| C-SCAN | up-only + wrap | physical top → floor 0 | **no** (express) | none | higher (return trip) | **best** |
| C-LOOK | up-only + wrap | highest → lowest request | **no** (express) | none | moderate-high | **best** |

Observed in real runs (e.g. the t=79 six-way log): under a scattered load FCFS
finishes well after the others (it reverses on nearly every serve); C-SCAN/C-LOOK
show **zero reversals** (they wrap, never reverse — their defining trait); LOOK
serves floors on the way *down* while C-LOOK expresses past them and serves them
*ascending* — the clearest single illustration of the bidirectional-vs-circular
distinction.

---

## 6. Fidelity scorecard

| Algorithm | Faithful? | Deviation |
|---|---|---|
| FCFS   | ✅ | serves all co-located requests on arrival (doors-open realism) |
| SSTF   | ✅ | none (starvation preserved intentionally) |
| SCAN   | ✅ | idle restart uses stale direction (textbook-consistent) |
| LOOK   | ✅ | none |
| C-SCAN | ✅* | idle-restart shortcut skips the climb-to-top (deliberate) |
| C-LOOK | ✅ | none |

`✅*` = faithful in continuous operation; one intentional idle-only deviation.

---

## 7. Where this is *not* a real elevator (scope boundary)

Faithful to the disk-scheduling algorithms, **not** to a real elevator controller:

- **Hall-call direction is ignored.** A ▼-down call at floor 8 is answered by any
  car reaching floor 8, even one travelling up. Directional collective control
  would not do that.
- **No load / capacity, no door dwell time, no acceleration** — a move is a
  uniform one-floor-per-tick.
- **Single car per algorithm.** Comparison mode runs N independent cars on the
  *same* workload; it is not a group/bank controller coordinating cars.
- **No predictive dispatch.** Real modern systems (destination dispatch) assign
  cars using the *destination* entered at the lobby; that is a different paradigm
  entirely.

These omissions are deliberate: the experiment teaches the six classic scheduling
policies, cleanly, on an intuitive elevator stage.

---

## 8. Further real-world context

- **SCAN** is widely called the *elevator algorithm* precisely because a
  committed-direction sweep is how a simple lift feels.
- Real single elevators commonly use **directional collective control**: answer
  calls in the direction of travel, reverse when none remain ahead — essentially
  **LOOK, but direction-aware** (it respects ▲/▼). That direction-awareness is the
  one feature standing between our LOOK and a believable real lift.
- Real elevator *banks* use **group control** and increasingly **destination
  dispatch** (you pick your floor at the lobby; the system assigns a car to
  minimize aggregate wait), which is an optimization problem, not a sweep policy.

---

*Maintained alongside the code. If an algorithm's behavior changes, update both
its §2 entry and the §6 scorecard.*
