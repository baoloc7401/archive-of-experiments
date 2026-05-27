const en = {
  hero: {
    prefix: "baoloc7401 /",
    subtitle: "A sandbox for algorithms, curiosity, and deliberate learning.",
  },
  section: {
    count_one: "{{count}} experiment",
    count_other: "{{count}} experiments",
  },
  footer: {
    github: "github",
    tagline: "built to learn",
  },
  status: {
    active: "LIVE",
    wip: "WIP",
    planned: "PLANNED",
  },
  aria: {
    theme_light: "Switch to light mode",
    theme_dark: "Switch to dark mode",
    lang_switch: "Switch language",
  },
  experiments: {
    chess: {
      title: "Chess",
      description:
        "Full chess engine with minimax + alpha-beta pruning. Play Human vs Human, Human vs AI, or watch AI vs AI.",
    },
    "sorting-visualizer": {
      title: "Sorting Visualizer",
      description:
        "Watch bubble, merge, quick, and heap sort race each other in real time.",
    },
    pathfinding: {
      title: "Pathfinding",
      description: "A* and Dijkstra navigating mazes on an interactive grid.",
    },
    "binary-tree": {
      title: "Binary Tree Explorer",
      description:
        "Insert, delete, and traverse BSTs with animated step-by-step breakdowns.",
    },
    "bloom-filter": {
      title: "Bloom Filter",
      description:
        "Probabilistic membership testing — visualizing false positives and hash collisions.",
    },
    "cellular-automata": {
      title: "Cellular Automata",
      description:
        "Conway's Game of Life and elementary automata. Complexity from simple rules.",
    },
    "fourier-drawing": {
      title: "Fourier Drawing",
      description:
        "Epicycles trace any path using Fourier series decomposition.",
    },
  },
  tags: {
    algorithms: "algorithms",
    AI: "AI",
    game: "game",
    visualization: "visualization",
    graphs: "graphs",
    "data structures": "data structures",
    trees: "trees",
    probabilistic: "probabilistic",
    simulation: "simulation",
    fun: "fun",
    math: "math",
  },
  chess: {
    back: "← experiments",
    badge: "experiment 01",
    desc1: "Minimax AI with alpha-beta pruning and piece-square tables.",
    desc2: "Pick a mode to start.",
    modes: {
      hvh: "Human vs Human",
      hva: "Human vs AI",
      ava: "AI vs AI",
    },
    puzzle_mode: "Puzzle Mode",
    planned_tag: "planned",
    promote_to: "Promote to:",
    white: "White",
    black: "Black",
    check_badge: "check",
    win_badge: "win",
    loss_badge: "loss",
    status: {
      check: "check!",
      black_wins: "black wins",
      white_wins: "white wins",
      stalemate: "stalemate",
      draw_repetition: "draw by repetition",
      draw_50move: "50-move draw",
    },
    resume: "▶ Resume",
    pause: "⏸ Pause",
    step: "→ Step",
    reset: "↺ Reset",
    mode_back: "← Mode",
    history_title: "Move history",
    copy: "copy",
    copied: "✓ copied",
    copy_grades: "grades",
    copy_grades_hint: "Include move grades (!!, !, ?!, etc.) when copying",
    no_moves: "No moves yet.",
    skill: {
      title: "AI skill",
      white: "White AI",
      black: "Black AI",
      start: "Start game",
      back: "Back",
      beginner: "Beginner",
      casual: "Casual",
      intermediate: "Intermediate",
      advanced: "Advanced",
      master: "Master",
      desc: {
        beginner: "Looks one move ahead. Blunders freely.",
        casual: "Sees two moves. Misses most tactics.",
        intermediate: "Club-strength. Catches simple combos.",
        advanced: "Strong. Rare inaccuracies, deep search.",
        master: "Full engine. No noise, deepest search.",
      },
    },
  },
} as const;

export default en;
