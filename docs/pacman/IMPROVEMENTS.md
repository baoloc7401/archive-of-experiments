# Pac-Man: Improvement Ideas

A living backlog for evolving the Pac-Man ghost-AI experiment into a more
future-proof, extensible playground. The north star stays the same: **an
interactive lecture on emergent and heterogeneous multi-agent AI**, built as a
playable game that pays homage to the 1980 arcade original while improving on it.

Every idea below is tagged so we can pick deliberately rather than gold-plate:

- Effort: **S** (hours), **M** (a day or two), **L** (multi-day / architectural).
- Pillar: **EDU** (teaches something), **PLAY** (fun / game feel), **TECH**
  (architecture / future-proofing), **A11Y/UX**, **HOMAGE** (faithful nod).

Design constraints to honour (from CLAUDE.md and the current build):
- Keep the engine framework-free (`simulation.ts` / `targeting.ts` / `bfs.ts` /
  `render.ts`); React stays glue. New behaviour is data + pure functions.
- Everything user-facing is translated (en + vi); toggles follow the existing
  `enabled: Record<…, boolean>` + sidebar pattern.
- Respect reduced motion, theming, and the "solver/sim is the source of truth"
  habit used across the repo.

---

## 0. The two seed ideas (expanded)

### 0.1 More pellet / board-content types, individually toggleable (M, PLAY+EDU) - DONE
Generalise pellets from "dot | energizer" into a small content system, and let
each type be switched on/off the way ghosts already are.

Candidate types:
- **Standard dot** / **energizer** (existing).
- **Bonus fruit** that spawns on a timer at a fixed tile (the classic cherry,
  strawberry, etc.) - worth escalating points; a homage hook.
- **Speed pellet** - temporary Pac-Man speed boost (visualise the speed delta).
- **Freeze pellet** - briefly stops all ghosts (great for explaining "what if an
  agent loses its turn").
- **Teleport / wormhole pair** - extra portals beyond the side tunnel; forces the
  BFS overlay and ghost targeting to reason about non-Euclidean adjacency.
- **Decoy pellet** - emits a fake "Pac-Man tile" that fools ghost targeting for a
  few seconds (directly teaches how target-tile spoofing changes emergent play).
- **Trap tile** - costs a life / score; for challenge modes.

Implementation sketch: replace the two `Set<string>` pellet stores with a
`Map<string, PelletType>` (or parallel typed sets), a `PELLET_TYPES` registry
(points, color, onEat effect), and an `enabledPellets: Record<PelletType, boolean>`
mirroring the ghost toggles. Render reads the registry; `eatPellets` dispatches on
type. Sidebar gains a "board content" panel of toggle cards.

### 0.2 Pac-Man AI with real solving (L, EDU+PLAY) - the headline feature - DONE (full 6-rung ladder)
Let the player hand control to an AI Pac-Man and watch it reason. This is the
natural counterpart to the ghost overlay and ties directly into the repo's
pathfinding experiment.

Strategy ladder (selectable, each its own teaching moment) - all six shipped:
1. **Greedy nearest pellet** - BFS to the closest dot. Baseline; gets cornered. DONE (`greedy`)
2. **Safe greedy** - nearest pellet whose path does not pass within N tiles of a
   ghost's predicted position (ghost danger map). DONE (`safe`)
3. **Danger-aware A\*** - A\* where cost = distance + ghost-proximity penalty
   field; replans every few ticks. DONE (`astar`)
4. **Hamiltonian / coverage planner** - precompute a nearest-neighbour sweep tour
   over the pellet graph (cached on state), follow it waypoint by waypoint, patch
   locally when threatened. DONE (`coverage`)
5. **Expectimax / short-horizon search** - search a few ply ahead modelling ghost
   targeting; the "thinking" version. Show the considered branches. DONE (`search`)
6. **Monte-Carlo rollout** - run K random playouts per move, pick the best average.
   Visualise the rollout fan. DONE (`montecarlo`)

Overlay: draw the AI's intended path, its current target, the ghost danger field
(heatmap), and (for search agents) the considered branches. An "AI vs you" toggle
and a strategy dropdown. Reuse `bfs.ts`; add `pacai/` with one file per strategy
behind a common `choosePacDirection(state): Direction` interface, mirroring how
the pathfinding experiment registers algorithms.

---

## 1. Ghost AI extensions (EDU core)

- **Editable heuristics / live parameter tuning (M, EDU).** Sliders for Pinky's
  look-ahead distance, Clyde's switch radius, Inky's vector multiplier, the
  Warden's guard/opportunism radii (already constants in `constants.ts`). Watch
  emergent behaviour change in real time - the single best "lecture" upgrade.
- **More custom ghosts in the Warden mould (S each, EDU+PLAY).** A roster the
  player composes: e.g. *Mirror* (targets your reflection across maze center),
  *Interceptor* (targets the tile where it predicts you and Pac collide),
  *Patroller* (fixed waypoint loop), *Hunter-pack* (coordinates with a sibling to
  pincer). Each is one pure target function + a registry entry.
- **Coordinated / communicating ghosts (L, EDU). DONE (2026-06-19).** Opt-in
  "coordinate" toggle: active chasers share a per-tick blackboard and split roles
  (chaser / ambusher / cutter x2 / lurker) assigned by greedy min-cost matching
  over true shortest-path distances, so they *surround* Pac instead of each
  chasing independently. Only sets target tiles (movement rule unchanged); chase
  only (scatter/frightened/eaten stay canonical). `coordination.ts` +
  `state.coordinated`/`state.blackboard`; overlay stamps a role letter, sidebar +
  explain show each ghost's role. Teaches the jump from independent agents to
  multi-agent coordination - the gap the issue thread calls out.
- **Learned ghost (L, EDU, ambitious).** A tiny tabular Q-learning or evolved
  policy ghost trained in-browser against the player or AI Pac-Man, with a
  "training vs playing" view. Big payoff for a "future-proof / modern AI" angle.
- **Ghost personality DSL (M, TECH+EDU).** Express each ghost as a small declarative
  rule ("target = pac + 4*heading"); render the rule as text and let advanced users
  edit it. Turns targeting.ts into data.

## 2. Visualization & explainability (EDU core - the differentiator)

- **Danger / influence heatmap (M).** Per-tile color field of "how soon could a
  ghost reach here", recomputed via multi-source BFS. Foundation for AI Pac-Man
  and a strong standalone teaching layer.
- **Decision timeline / step-through (M).** Scrub backward/forward through ticks;
  at each intersection show the candidate tiles and their distances (the dossier's
  "test tiles" diagram, live). Pairs with deterministic replay (see TECH).
- **Per-ghost decision trace panel (S).** In explain mode, list the exits
  considered, each distance-to-target, and which won + why (tie-break).
- **Target-history trails (S).** Fading breadcrumb of where each ghost's target
  tile has been, exposing Inky's swing and Pinky's lead.
- **Mode timeline bar (S).** A horizontal scatter/chase/frightened schedule bar
  with a playhead, so the global mode rhythm is legible.

## 3. Levels, mazes & content

- **Maze editor (L, PLAY+EDU). DONE (2026-06-19).** Dedicated edit mode: paint
  walls/dots/energizers on the 28x31 grid with the ghost house, spawns and tunnel
  locked; live flood-fill validation (connectivity + >=1 energizer); save to
  localStorage and export/import a maze string (copy/paste). `mazes/structure.ts`
  (lock mask + applyStructure), `mazes/validate.ts`, `mazes/serialize.ts`,
  `components/MazeEditor.tsx`.
- **Multiple built-in mazes + procedural generator (M-L). DONE (2026-06-19).**
  Symmetric tile generator (`mazes/generate.ts`): walls grown as a spanning forest
  over an even-coordinate pillar lattice (union-find forbids wall loops, so
  corridors stay connected with loops), left half mirrored, classic house/tunnel/
  spawns fixed, 4 corner energizers; reseeds on the rare invalid layout. Ships the
  classic board plus two deterministic generated originals + a Random button
  (`mazes/registry.ts`). The whole engine now reads a runtime active maze
  (`maze.ts` setActiveMaze + version; the AI graph rebuilds on change).
- **Level progression (S-M, HOMAGE).** Faithful speed/timing tables per level,
  fruit ladder, and the famous level-256 "kill screen" as an easter egg.

## 4. Game modes (PLAY)

- **Sandbox (default today)** vs **Arcade** (lives, levels, faithful timings) vs
  **Challenge** (puzzles: "clear with 1 energizer", "survive 60s with all 5 ghosts").
- **Race / ghost-perspective mode (M, EDU).** Play *as* a ghost against AI Pac-Man
  to feel a single heuristic from the inside.
- **AI vs AI spectator (M, EDU+PLAY).** AI Pac-Man vs configurable ghosts, with a
  stats HUD - a self-running demo for the gateway card / OG image.
- **Pursuit-evasion sandbox (L).** The issue thread's other planned experiment;
  could grow out of this codebase rather than starting fresh.

## 5. UX, accessibility & mobile (A11Y/UX)

- **On-screen D-pad + better swipe (S).** Current swipe is fine; add a thumb-pad
  for sustained mobile play.
- **Difficulty / speed slider (S).** Global sim-speed control (the engine is
  fixed-timestep, so this is just a time-scale multiplier) - also a teaching tool
  for slow-mo.
- **Colorblind-safe ghost palette + patterns (S, A11Y).** Distinguish ghosts by
  shape/pattern, not only color; matters once there are 5+.
- **Full keyboard control of the sidebar + ARIA live region (S, A11Y).** Announce
  mode changes, deaths, wins.
- **Sound (M, PLAY+HOMAGE).** Optional waka-waka, energizer siren, death jingle;
  gated behind a mute toggle and reduced-motion-style preference.

## 6. Architecture & future-proofing (TECH)

- **Deterministic seeded RNG + replay (M, TECH+EDU).** Replace `Math.random`
  (frightened tie-breaks, any future randomness) with a seeded PRNG stored in
  state. Enables: reproducible bug reports (the repo's debug-bridge habit),
  replays, the decision timeline scrubber, and faithful "pattern" play. High
  leverage - do this early.
- **Snapshot/serialize state (S-M, TECH).** `serialize(state)` / `deserialize`
  for save-resume, shareable situations, and test fixtures.
- **Engine test harness in-repo (M, TECH).** The QA was done with throwaway
  esbuild scripts; promote a few into a tiny `*.test`-style harness (even just
  `node`-run assertions) so targeting/flee/death invariants are guarded. The repo
  has no test runner today - a lightweight, zero-dep harness fits.
- **Config registry pattern (M, TECH).** Drive ghosts, pellets, and Pac AIs from
  declarative registries (id, label-key, color, factory) so adding content never
  touches the loop - and i18n keys are derived, not hand-wired.
- **Performance headroom (S-M, TECH).** Profile with 5+ ghosts + heatmaps; cache
  BFS per tick, dirty-rect or layered canvas (static maze layer vs dynamic actors)
  so heavier overlays stay 60fps. The boids experiment's patterns apply.
- **Decouple tick rate from frame rate cleanly (S).** Already fixed-timestep;
  expose it so slow-mo / fast-forward and the AI search budget are first-class.

## 7. Data & meta (EDU)

- **Live stats panel (S).** Captures, average survival time, pellets/sec, per-ghost
  catch counts - turns a session into data.
- **Heuristic A/B (M, EDU).** Run the same seeded scenario with two ghost
  configs side by side and compare outcomes; the experiment becomes a little
  research bench.

## 8. Homage & delight (HOMAGE/PLAY)

- Authentic cornering speed-up, the pass-through collision quirk, Cruise-Elroy
  Blinky speed-ups, and the documented Pinky/Inky overflow bugs (already modelled)
  surfaced as toggles labelled "arcade quirk".
- Intermission cutscenes, the 256 kill-screen, classic fruit, and a faithful
  attract-mode demo loop for the landing card.

---

## Suggested sequencing

**Quick wins (do first):** seeded RNG + replay (6), live heuristic sliders (1),
danger heatmap (2), decision-trace panel (2), stats panel (7). These are mostly
additive, high-EDU, and unlock later features.

**Headline bets:** AI Pac-Man strategy ladder (0.2) and the pellet-type system
(0.1) - the two seed ideas - followed by the maze editor (3) and coordinated
ghosts (1).

**Architectural enablers to land alongside:** config registries and the engine
test harness (6), so the roster of ghosts / pellets / AIs can grow without the
loop or i18n turning into a liability.

**Guardrails:** keep the engine framework-free and the "source of truth" in the
simulation; every new visible string lands in en + vi; new content is a registry
entry, not a special case in the loop; reduced-motion and theming respected.
