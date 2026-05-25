export type ExperimentStatus = "active" | "wip" | "planned";

export interface Experiment {
  id: string;
  title: string;
  description: string;
  tags: string[];
  status: ExperimentStatus;
  path: string;
}

export const experiments: Experiment[] = [
  {
    id: "sorting-visualizer",
    title: "Sorting Visualizer",
    description: "Watch bubble, merge, quick, and heap sort race each other in real time.",
    tags: ["algorithms", "visualization"],
    status: "wip",
    path: "/experiments/sorting-visualizer",
  },
  {
    id: "pathfinding",
    title: "Pathfinding",
    description: "A* and Dijkstra navigating mazes on an interactive grid.",
    tags: ["algorithms", "graphs"],
    status: "planned",
    path: "/experiments/pathfinding",
  },
  {
    id: "binary-tree",
    title: "Binary Tree Explorer",
    description: "Insert, delete, and traverse BSTs with animated step-by-step breakdowns.",
    tags: ["data structures", "trees"],
    status: "planned",
    path: "/experiments/binary-tree",
  },
  {
    id: "bloom-filter",
    title: "Bloom Filter",
    description: "Probabilistic membership testing — visualizing false positives and hash collisions.",
    tags: ["data structures", "probabilistic"],
    status: "planned",
    path: "/experiments/bloom-filter",
  },
  {
    id: "cellular-automata",
    title: "Cellular Automata",
    description: "Conway's Game of Life and elementary automata. Complexity from simple rules.",
    tags: ["simulation", "fun"],
    status: "planned",
    path: "/experiments/cellular-automata",
  },
  {
    id: "fourier-drawing",
    title: "Fourier Drawing",
    description: "Epicycles trace any path using Fourier series decomposition.",
    tags: ["math", "visualization", "fun"],
    status: "planned",
    path: "/experiments/fourier-drawing",
  },
];
