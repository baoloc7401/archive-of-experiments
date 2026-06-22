# Graph Report - .  (2026-06-20)

## Corpus Check
- Large corpus: 320 files · ~6,138,248 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 1584 nodes · 4169 edges · 65 communities (61 shown, 4 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 35 edges (avg confidence: 0.82)
- Token cost: 300,000 input · 40,000 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Graph Search Core (AMonte-Carlo)|Graph Search Core (A*/Monte-Carlo)]]
- [[_COMMUNITY_Elevator Simulation UI|Elevator Simulation UI]]
- [[_COMMUNITY_Boids Flocking Simulation|Boids Flocking Simulation]]
- [[_COMMUNITY_L-System Editor & Canvas|L-System Editor & Canvas]]
- [[_COMMUNITY_Maze Editor & Registry|Maze Editor & Registry]]
- [[_COMMUNITY_Routing & SEO Shell|Routing & SEO Shell]]
- [[_COMMUNITY_Pac-Man Simulation Engine|Pac-Man Simulation Engine]]
- [[_COMMUNITY_About Terminal & PageSpeed|About Terminal & PageSpeed]]
- [[_COMMUNITY_Story Generator Engine|Story Generator Engine]]
- [[_COMMUNITY_Theme & Layout Hooks|Theme & Layout Hooks]]
- [[_COMMUNITY_Minesweeper UI & Worker|Minesweeper UI & Worker]]
- [[_COMMUNITY_ACO Colony UI|ACO Colony UI]]
- [[_COMMUNITY_Pac-Man UI & State|Pac-Man UI & State]]
- [[_COMMUNITY_Chess Engine Core|Chess Engine Core]]
- [[_COMMUNITY_Algorithm Textbooks (ACOBoidsL-System)|Algorithm Textbooks (ACO/Boids/L-System)]]
- [[_COMMUNITY_Shared UI ScrambleText & Panels|Shared UI: ScrambleText & Panels]]
- [[_COMMUNITY_River Crossing UI|River Crossing UI]]
- [[_COMMUNITY_Chess Search (Alpha-Beta)|Chess Search (Alpha-Beta)]]
- [[_COMMUNITY_Pathfinding Maze Builder|Pathfinding Maze Builder]]
- [[_COMMUNITY_Pathfinding Algorithms|Pathfinding Algorithms]]
- [[_COMMUNITY_N-Body Controls & UI|N-Body Controls & UI]]
- [[_COMMUNITY_Minesweeper Backtracking Solver|Minesweeper Backtracking Solver]]
- [[_COMMUNITY_N-Body Physics (Barnes-Hut)|N-Body Physics (Barnes-Hut)]]
- [[_COMMUNITY_Pathfinding Run & Algo Panel|Pathfinding Run & Algo Panel]]
- [[_COMMUNITY_River Crossing Solver|River Crossing Solver]]
- [[_COMMUNITY_Chess Evaluation|Chess Evaluation]]
- [[_COMMUNITY_Pac-Man Rendering|Pac-Man Rendering]]
- [[_COMMUNITY_N-Body WebGL Renderer|N-Body WebGL Renderer]]
- [[_COMMUNITY_Pac-Man Ghost Pathfinding|Pac-Man Ghost Pathfinding]]
- [[_COMMUNITY_Minesweeper SAT & Constraints|Minesweeper SAT & Constraints]]
- [[_COMMUNITY_Minesweeper Board Tools|Minesweeper Board Tools]]
- [[_COMMUNITY_Shared UI Primitives|Shared UI Primitives]]
- [[_COMMUNITY_Chess Game Mode & Setup|Chess Game Mode & Setup]]
- [[_COMMUNITY_Chess Game UI|Chess Game UI]]
- [[_COMMUNITY_Minesweeper Field Generator|Minesweeper Field Generator]]
- [[_COMMUNITY_N-Body Scene Presets|N-Body Scene Presets]]
- [[_COMMUNITY_Pac-Man Docs & Design Notes|Pac-Man Docs & Design Notes]]
- [[_COMMUNITY_Pac-Man Ghost Targeting|Pac-Man Ghost Targeting]]
- [[_COMMUNITY_Chess AI Worker|Chess AI Worker]]
- [[_COMMUNITY_Chess AI Docs & Findings|Chess AI Docs & Findings]]
- [[_COMMUNITY_Home Gateway & Experiment Cards|Home Gateway & Experiment Cards]]
- [[_COMMUNITY_Chess Types & Pieces|Chess Types & Pieces]]
- [[_COMMUNITY_Minesweeper Linear-Algebra Solver|Minesweeper Linear-Algebra Solver]]
- [[_COMMUNITY_N-Body Physics Docs|N-Body Physics Docs]]
- [[_COMMUNITY_River Crossing Story Panel|River Crossing Story Panel]]
- [[_COMMUNITY_PageSpeed  Performance Docs|PageSpeed / Performance Docs]]
- [[_COMMUNITY_Pathfinding Grid State|Pathfinding Grid State]]
- [[_COMMUNITY_River Crossing Scene|River Crossing Scene]]
- [[_COMMUNITY_River Crossing Docs|River Crossing Docs]]
- [[_COMMUNITY_Minesweeper Probability Solver|Minesweeper Probability Solver]]
- [[_COMMUNITY_Search Concepts (BFSState-Space)|Search Concepts (BFS/State-Space)]]
- [[_COMMUNITY_Pathfinding Algorithm Docs|Pathfinding Algorithm Docs]]
- [[_COMMUNITY_N-Body WebGPU Solver|N-Body WebGPU Solver]]
- [[_COMMUNITY_Minesweeper Docs|Minesweeper Docs]]
- [[_COMMUNITY_ACO City Layouts|ACO City Layouts]]
- [[_COMMUNITY_MinHeap (Priority Queue)|MinHeap (Priority Queue)]]
- [[_COMMUNITY_Branding Assets|Branding Assets]]
- [[_COMMUNITY_Appearance  Color Controls|Appearance / Color Controls]]
- [[_COMMUNITY_Elevator Docs|Elevator Docs]]
- [[_COMMUNITY_Setup Panel  Stepper|Setup Panel / Stepper]]
- [[_COMMUNITY_Debug Log Component|Debug Log Component]]
- [[_COMMUNITY_Vite & Hero Assets|Vite & Hero Assets]]
- [[_COMMUNITY_React Assets|React Assets]]
- [[_COMMUNITY_Brand Mark Concepts|Brand Mark Concepts]]

## God Nodes (most connected - your core abstractions)
1. `ScrambleText()` - 69 edges
2. `Theme` - 22 edges
3. `reveal()` - 21 edges
4. `Direction` - 21 edges
5. `Tooltip()` - 20 edges
6. `tileToId()` - 19 edges
7. `Panel()` - 18 edges
8. `Move` - 18 edges
9. `neighbor()` - 18 edges
10. `alphaBeta()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `River Crossing A* (admissible h)` --semantically_similar_to--> `A* Search (Manhattan Heuristic)`  [INFERRED] [semantically similar]
  docs/river-crossing/TEXTBOOK.md → docs/pathfinding/TEXTBOOK.md
- `Uniform spatial hash grid` --semantically_similar_to--> `Euclidean Traveling Salesman Problem`  [AMBIGUOUS] [semantically similar]
  docs/boids/IMPROVEMENTS.md → docs/aco/TEXTBOOK.md
- `Solver-as-Oracle Pattern` --semantically_similar_to--> `Solvability as First-Class Output`  [INFERRED] [semantically similar]
  docs/minesweeper/TEXTBOOK.md → docs/river-crossing/TEXTBOOK.md
- `6-Rung Pac AI Driver Ladder` --semantically_similar_to--> `A* Search (Manhattan Heuristic)`  [INFERRED] [semantically similar]
  docs/pacman/TEXTBOOK.md → docs/pathfinding/TEXTBOOK.md
- `alphaBeta()` --calls--> `search()`  [INFERRED]
  src/experiments/chess/ai/search.ts → src/experiments/pacman/pacai/search.ts

## Import Cycles
- 3-file cycle: `src/experiments/pacman/constants.ts -> src/experiments/pacman/types.ts -> src/experiments/pacman/pellets/registry.ts -> src/experiments/pacman/constants.ts`

## Hyperedges (group relationships)
- **Debug-bridge methodology across experiments** — aco_textbook_debug_bridge, lsystem_textbook_debug_bridge_limit, chess_issues_won_endgame [INFERRED 0.75]
- **Render the mechanism using the engine's own state** — aco_textbook_contrast_normalization, boids_textbook_rule_overlay, lsystem_textbook_depth_cueing [INFERRED 0.75]
- **Correct solver on a flat objective makes random choices** — chess_textbook_flat_objective, chess_textbook_mate_distance, chess_issues_won_endgame [INFERRED 0.85]
- **Shared BFS/A* Graph Search Across Experiments** — pathfinding_textbook_bfs, pathfinding_textbook_astar, river_crossing_textbook_bfs, river_crossing_textbook_astar, minesweeper_textbook_tank_solver [INFERRED 0.85]
- **Solver/Sim as Source of Truth Pattern** — minesweeper_textbook_solver_as_truth, river_crossing_textbook_solvability_output, pacman_textbook_framework_free_engine [INFERRED 0.75]
- **Headless Throwaway Harness Verification** — nbody_textbook_tsx_harness, pacman_textbook_framework_free_engine, river_crossing_textbook_debug_bridge [INFERRED 0.75]

## Communities (65 total, 4 thin omitted)

### Community 0 - "Graph Search Core (A*/Monte-Carlo)"
Cohesion: 0.08
Nodes (69): astar, buildTour(), coverage, computeThreatDist(), dangerField(), edibleGhostIds(), safestTile(), threatTiles() (+61 more)

### Community 1 - "Elevator Simulation UI"
Cohesion: 0.06
Nodes (48): Props, FloorCalls, Props, ShaftProps, CarPanel(), Props, Props, ORIGIN_GLYPH (+40 more)

### Community 2 - "Boids Flocking Simulation"
Cohesion: 0.07
Nodes (52): DEFAULT_PARAMS, PRESETS, makeFlock(), placeFormation(), respawnAtEdge(), setVelocity(), Palette, readPalette() (+44 more)

### Community 3 - "L-System Editor & Canvas"
Cohesion: 0.09
Nodes (36): matchPreset(), Props, build(), DEFAULT_VIEW, LCanvas, LHandle, Props, COLOR_MODES (+28 more)

### Community 4 - "Maze Editor & Registry"
Cohesion: 0.09
Nodes (43): Brush, CONTENT, POP_CHARS, Props, randomizeContent(), SCAN_DELAY_MULT, TERRAIN, Edge (+35 more)

### Community 5 - "Routing & SEO Shell"
Cohesion: 0.06
Nodes (34): loaders, loadLocale(), restoreLanguage(), en, Translation, Widen, RouteMeta(), author (+26 more)

### Community 6 - "Pac-Man Simulation Engine"
Cohesion: 0.09
Nodes (44): DIR_VEC, FRUIT_TILE, GATE_EXIT, GHOST_HOME, GHOST_POINTS, GHOST_START, OPPOSITE, PAC_START (+36 more)

### Community 7 - "About Terminal & PageSpeed"
Cohesion: 0.08
Nodes (28): AboutTerminal(), CONFETTI, CONFETTI_GLYPHS, Entry, Props, ArgKind, buildCommands(), Command (+20 more)

### Community 8 - "Story Generator Engine"
Cohesion: 0.10
Nodes (36): Actor, buildRoster(), CANNIBAL_NAMES, chooseCrossers(), MISSIONARY_NAMES, Roster, mulberry32(), pick() (+28 more)

### Community 9 - "Theme & Layout Hooks"
Cohesion: 0.08
Nodes (29): Aco(), Boids(), Crumb, ExperimentHeader(), Props, LangToggle(), ThemeToggle(), mql() (+21 more)

### Community 10 - "Minesweeper UI & Worker"
Cohesion: 0.10
Nodes (25): Props, FACE, Hud(), Props, DEFAULT_CONFIG, Preset, PRESETS, ForgeRequest (+17 more)

### Community 11 - "ACO Colony UI"
Cohesion: 0.12
Nodes (19): Colony, DEFAULT_LAYOUT, DEFAULT_PARAMS, LAYOUTS, PARAM_RANGES, ParamRange, AcoDebug, AcoParams (+11 more)

### Community 12 - "Pac-Man UI & State"
Cohesion: 0.13
Nodes (32): KEY_DIR, PacmanCanvas, PacmanHandle, Props, DIR_GLYPH, GHOST_NAME, PELLET_COLOR, Props (+24 more)

### Community 13 - "Chess Engine Core"
Cohesion: 0.08
Nodes (29): book, OPENING_LINES, addKingMoves(), addKnightMoves(), addPawnMoves(), addSlidingMoves(), ALL_DIRS, cloneBoard() (+21 more)

### Community 14 - "Algorithm Textbooks (ACO/Boids/L-System)"
Cohesion: 0.06
Nodes (35): ACO Textbook, Ant Colony System (ACS, 1996), Ant System (AS, Dorigo 1992), HiDPI canvas backing-buffer feedback bug, Contrast-normalization rendering finding, Debug-bridge methodology (copyable report), Max-Min Ant System (MMAS), Pheromone update (evaporation + deposit + elitist) (+27 more)

### Community 15 - "Shared UI: ScrambleText & Panels"
Cohesion: 0.11
Nodes (20): Convergence(), Props, OrderChart(), Props, ScrambleText(), compact(), fmt(), Props (+12 more)

### Community 16 - "River Crossing UI"
Cohesion: 0.14
Nodes (26): Props, XY, ALGO_BY_ID, AlgoKind, ALGOS, DEFAULT_CONFIG, randomShoutIndex(), SEARCH_STEP_MS (+18 more)

### Community 17 - "Chess Search (Alpha-Beta)"
Cohesion: 0.17
Nodes (28): lookupBookMove(), isEndgame(), getBestMove(), weightedPickIndex(), histKey(), isSameMove(), moveScore(), orderMoves() (+20 more)

### Community 18 - "Pathfinding Maze Builder"
Cohesion: 0.13
Nodes (28): Cell, CELL_BG_VAR, CellProps, getMaxPath(), MazeBuilder(), NON_PLAIN_TERRAINS, CELL_WEIGHT, DEFAULT_TERRAIN_CONFIG (+20 more)

### Community 19 - "Pathfinding Algorithms"
Cohesion: 0.23
Nodes (18): Node, expandOne(), Node, Node, blocked(), jump(), Node, open() (+10 more)

### Community 20 - "N-Body Controls & UI"
Cohesion: 0.13
Nodes (23): INTEGRATORS, Props, DEFAULT_PARAMS, webgpuSupported(), COLOR_MODES, loadLook(), sanitizeLook(), SavedLook (+15 more)

### Community 21 - "Minesweeper Backtracking Solver"
Cohesion: 0.17
Nodes (21): backtrackingSolver, constraintPropagationSolver, Constraint, enumerate(), EnumResult, Knowledge, GENERATE_AND_TEST, SOLVERS (+13 more)

### Community 22 - "N-Body Physics (Barnes-Hut)"
Cohesion: 0.13
Nodes (27): appendBody(), bhForces(), buildOctree(), childOf(), ForceSink, growNodes(), makeOctree(), newNode() (+19 more)

### Community 23 - "Pathfinding Run & Algo Panel"
Cohesion: 0.11
Nodes (17): ALGO_FACTORIES, AlgoState, Overlay, OVERLAY_CLS, Props, VCell, Props, Props (+9 more)

### Community 24 - "River Crossing Solver"
Cohesion: 0.12
Nodes (17): edgeKey(), SearchGraph(), assembleBidir(), boatLoads(), floodCount(), isGoal(), isValid(), other() (+9 more)

### Community 25 - "Chess Evaluation"
Cohesion: 0.14
Nodes (22): FUTILITY_MARGINS, PIECE_VALUE, PST, PST_KING_EG, evaluate(), isMatable(), KING_OFFSETS, kingRestriction() (+14 more)

### Community 26 - "Pac-Man Rendering"
Cohesion: 0.17
Nodes (25): sirenLevel(), GHOST_COLOR, getActiveMaze(), center(), DIR_ANGLE, drawBoard(), drawDanger(), drawFruit() (+17 more)

### Community 27 - "N-Body WebGL Renderer"
Cohesion: 0.13
Nodes (20): DEFAULT_VIEW, NBodyCanvas, NBodyHandle, PointerState, mat4, multiply(), orbitView(), perspective() (+12 more)

### Community 28 - "Pac-Man Ghost Pathfinding"
Cohesion: 0.15
Nodes (22): bfsPath(), clamp(), MAZE, TIE_ORDER, assignRoles(), distsToGhosts(), nearestPassable(), queue (+14 more)

### Community 29 - "Minesweeper SAT & Constraints"
Cohesion: 0.32
Nodes (22): solve(), solve(), applyForced(), buildConstraints(), createKnowledge(), fullPropagate(), isUnknown(), markMine() (+14 more)

### Community 30 - "Minesweeper Board Tools"
Cohesion: 0.13
Nodes (13): BoardTools(), Props, ITEMS, Legend(), Props, Props, effectiveDelayFor(), frameAt() (+5 more)

### Community 31 - "Shared UI Primitives"
Cohesion: 0.13
Nodes (10): LogEntry, KIND_MARK, Props, Button(), ButtonVariant, Props, Props, Props (+2 more)

### Community 32 - "Chess Game Mode & Setup"
Cohesion: 0.16
Nodes (16): GRADER_CONFIG, SKILL_LEVELS, SKILL_PIECES, SKILL_PRESETS, ChessGame(), GAME_MODES, isGameMode(), GameMode (+8 more)

### Community 33 - "Chess Game UI"
Cohesion: 0.19
Nodes (16): FILES, PIECE_SORT, PIECE_VAL, RANKS, SYMBOLS, applyMove(), getGameStatus(), Piece (+8 more)

### Community 34 - "Minesweeper Field Generator"
Cohesion: 0.16
Nodes (17): clampMines(), compute3BV(), generateField(), hardestOf(), rate(), disk(), neighbors(), neighborTable() (+9 more)

### Community 35 - "N-Body Scene Presets"
Cohesion: 0.20
Nodes (19): gauss(), genBelt(), genBinary(), genBlackHole(), genCloud(), genCluster(), genCollision(), genDisk() (+11 more)

### Community 36 - "Pac-Man Docs & Design Notes"
Cohesion: 0.12
Nodes (19): Pac-Man Improvement Roadmap, Coordinated/Communicating Ghosts, Framework-Free Engine Constraint, Maze Editor & Procedural Generator, Pac-Man AI Strategy Ladder, Pellet/Board-Content Registry Idea, Pac-Man Known Issues, Pac-Man Trademark/Licensing Posture (+11 more)

### Community 37 - "Pac-Man Ghost Targeting"
Cohesion: 0.21
Nodes (17): NO_UP_TILES, tileDistanceSq(), ghostDistance(), blinkyTarget(), chaseTarget(), clydeTarget(), inkyTarget(), offsetAhead() (+9 more)

### Community 38 - "Chess AI Worker"
Cohesion: 0.21
Nodes (14): ClearRequest, ctx, SearchRequest, SearchResult, WorkerRequest, AI_DELAY, AIConfig, Move (+6 more)

### Community 39 - "Chess AI Docs & Findings"
Cohesion: 0.15
Nodes (17): Chess AI Improvement Roadmap, Chess Programming Wiki references, Minimax + alpha-beta search, Move ordering (TT > MVV-LVA > killers > history), Pruning suite (NMP, futility, LMR, PVS), Transposition table, Chess AI Known Issues, Mop-up heuristic & king restriction (+9 more)

### Community 40 - "Home Gateway & Experiment Cards"
Cohesion: 0.21
Nodes (13): ExperimentCard(), Props, STATUS_CLS, FilterBar(), Props, STATUSES, StatusFilter, useScrambledText() (+5 more)

### Community 41 - "Chess Types & Pieces"
Cohesion: 0.22
Nodes (12): isPassed(), PASSED_BONUS, pawnStructureScore(), Board, Color, GameStatus, MoveFlag, PieceType (+4 more)

### Community 42 - "Minesweeper Linear-Algebra Solver"
Cohesion: 0.24
Nodes (15): add(), deduceFromRows(), div(), eq(), Frac, gcd(), isNeg(), isPos() (+7 more)

### Community 43 - "N-Body Physics Docs"
Cohesion: 0.15
Nodes (14): N-Body Gravity Textbook, Barnes-Hut Octree, Black Hole Capped Singularity, Individual/Block Timesteps & Regularization, Figure-8 Choreography, Symplectic Leapfrog Integrator, Plummer Softening, Solar System Moons Removed (Hill Sphere) (+6 more)

### Community 44 - "River Crossing Story Panel"
Cohesion: 0.21
Nodes (8): Props, StoryBeat, Came, Frame, FrontierOpts, OpenNode, Move, PuzzleState

### Community 45 - "PageSpeed / Performance Docs"
Cohesion: 0.23
Nodes (12): PageSpeed Improvement Roadmap, Route Code-Splitting & Self-Hosted Fonts, WCAG AA Contrast Fixes, font-display: optional CLS Fix, TBT Main-Thread Fixes (ScrambleText/Reflow), Web Performance Textbook, Accessibility is Contrast Math, Font-Swap Reflow CLS (+4 more)

### Community 46 - "Pathfinding Grid State"
Cohesion: 0.18
Nodes (7): DEFAULT_MAZE_OPTIONS, loadGrid(), PF_STEPS, SCREEN_SLUG, SLUG_SCREEN, makeDefaultGrid(), AppScreen

### Community 47 - "River Crossing Scene"
Cohesion: 0.27
Nodes (7): PersonKind, Props, doomedBank(), people(), Props, RiverScene(), RiverCrossing()

### Community 48 - "River Crossing Docs"
Cohesion: 0.20
Nodes (11): Replay Decisions Not Result, Bidirectional BFS, River Crossing Improvement Roadmap, Bidirectional Illegal-Goal Gotcha, More Algorithms (Greedy/IDDFS/Bidir/UCS), Narrative Story Layer, Animate Search (Frontier/Explored), River Crossing Textbook (+3 more)

### Community 49 - "Minesweeper Probability Solver"
Cohesion: 0.27
Nodes (10): components(), binom(), binomCache, convolve(), Detail, enumerateDetailed(), probabilisticSolver, probabilities() (+2 more)

### Community 50 - "Search Concepts (BFS/State-Space)"
Cohesion: 0.20
Nodes (10): Kaye 2000 - Minesweeper NP-complete, Tank Solver (Component Enumeration), Coordinated Ghost Blackboard, Greedy Local Movement Rule, Personality is Target Selection, Warden BFS Planner (Greedy Fails), Breadth-First Search, River Crossing A* (admissible h) (+2 more)

### Community 51 - "Pathfinding Algorithm Docs"
Cohesion: 0.24
Nodes (10): Pathfinding Textbook, Heuristic Admissibility (weights >= 1), A* Search (Manhattan Heuristic), Depth-First Search, Dijkstra's Algorithm, Generator Snapshot Visualization, Greedy Best-First Search, Harabor & Grastien 2011 (JPS paper) (+2 more)

### Community 52 - "N-Body WebGPU Solver"
Cohesion: 0.22
Nodes (6): createGpuSolver(), GpuSolver, StagingSlot, PresetDef, Bodies, PresetId

### Community 53 - "Minesweeper Docs"
Cohesion: 0.28
Nodes (9): Minesweeper Textbook, 3BV (Bechtel Board Benchmark Value), Exact Probability Under Global Budget, fullPropagate Pipeline, Single-Mine Hill-Climb Repair, No-Guess Generate-and-Test, Solver-as-Oracle Pattern, Seven Solver Engines (+1 more)

### Community 54 - "ACO City Layouts"
Cohesion: 0.62
Nodes (6): clusters(), generateCities(), grid(), ring(), rnd(), scatter()

### Community 56 - "Branding Assets"
Cohesion: 0.48
Nodes (7): Archive of Experiments Brand Identity, Favicon (32px favicon-safe bolt tile), App Icon (512px tile + bolt), Master Icon (full color tile + bolt), Master Icon 1024px Raster (WebP), Monochrome Icon (currentColor bolt), Lightning Bolt Mark (teal-to-purple gradient)

### Community 57 - "Appearance / Color Controls"
Cohesion: 0.33
Nodes (4): COLOR_MODES, Props, SegRow(), SegRowProps

### Community 58 - "Elevator Docs"
Cohesion: 0.38
Nodes (7): Elevator Scheduling Known Issues, Circular return as multi-tick express run, Car teleport bug (CSS-var transform never transitions), Elevator Scheduling Textbook, Disk metaphor is not a real directional elevator, Disk-scheduling algorithms (FCFS/SSTF/SCAN/LOOK/C-SCAN/C-LOOK), Idle-restart problem (stale direction)

### Community 60 - "Debug Log Component"
Cohesion: 0.50
Nodes (3): DebugEntry, KIND_MARK, Props

### Community 61 - "Vite & Hero Assets"
Cohesion: 0.67
Nodes (3): Hero Illustration, Vite Logo, Vite

## Ambiguous Edges - Review These
- `Euclidean Traveling Salesman Problem` → `Uniform spatial hash grid`  [AMBIGUOUS]
  docs/boids/IMPROVEMENTS.md · relation: semantically_similar_to

## Knowledge Gaps
- **254 isolated node(s):** `STATUS_ORDER`, `DocWithVT`, `ChessGame`, `SortingVisualizer`, `Pathfinding` (+249 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Euclidean Traveling Salesman Problem` and `Uniform spatial hash grid`?**
  _Edge tagged AMBIGUOUS (relation: semantically_similar_to) - confidence is low._
- **Why does `ScrambleText()` connect `Shared UI: ScrambleText & Panels` to `Elevator Simulation UI`, `Boids Flocking Simulation`, `L-System Editor & Canvas`, `Maze Editor & Registry`, `Routing & SEO Shell`, `About Terminal & PageSpeed`, `Theme & Layout Hooks`, `Minesweeper UI & Worker`, `ACO Colony UI`, `Pac-Man UI & State`, `River Crossing UI`, `Pathfinding Maze Builder`, `N-Body Controls & UI`, `Minesweeper Backtracking Solver`, `Pathfinding Run & Algo Panel`, `N-Body WebGL Renderer`, `Minesweeper Board Tools`, `Shared UI Primitives`, `Chess Game Mode & Setup`, `Chess AI Worker`, `Home Gateway & Experiment Cards`, `Chess Types & Pieces`, `River Crossing Story Panel`, `River Crossing Scene`, `Appearance / Color Controls`, `Debug Log Component`?**
  _High betweenness centrality (0.215) - this node is a cross-community bridge._
- **Why does `Theme` connect `Shared UI: ScrambleText & Panels` to `Boids Flocking Simulation`, `L-System Editor & Canvas`, `Theme & Layout Hooks`, `ACO Colony UI`, `Pac-Man UI & State`, `N-Body Controls & UI`, `N-Body WebGL Renderer`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Why does `Tooltip()` connect `Elevator Simulation UI` to `Chess AI Worker`, `Home Gateway & Experiment Cards`, `Theme & Layout Hooks`, `Minesweeper UI & Worker`, `ACO Colony UI`, `River Crossing Story Panel`, `River Crossing Scene`, `Pathfinding Maze Builder`, `Minesweeper Backtracking Solver`, `Pathfinding Run & Algo Panel`, `Debug Log Component`, `Minesweeper Board Tools`, `Shared UI Primitives`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **What connects `STATUS_ORDER`, `DocWithVT`, `ChessGame` to the rest of the system?**
  _266 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Graph Search Core (A*/Monte-Carlo)` be split into smaller, more focused modules?**
  _Cohesion score 0.07633378932968536 - nodes in this community are weakly interconnected._
- **Should `Elevator Simulation UI` be split into smaller, more focused modules?**
  _Cohesion score 0.062206572769953054 - nodes in this community are weakly interconnected._