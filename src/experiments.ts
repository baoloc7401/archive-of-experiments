export type ExperimentStatus = "active" | "wip" | "planned";

export interface Experiment {
  id: string;
  tags: string[];
  status: ExperimentStatus;
  path: string;
}

export const experiments: Experiment[] = [
  {
    id: "chess",
    tags: ["algorithms", "AI", "game"],
    status: "active",
    path: "/experiments/chess",
  },
  {
    id: "sorting-visualizer",
    tags: ["algorithms", "visualization"],
    status: "wip",
    path: "/experiments/sorting-visualizer",
  },
  {
    id: "pathfinding",
    tags: ["algorithms", "graphs"],
    status: "active",
    path: "/experiments/pathfinding",
  },
  {
    id: "binary-tree",
    tags: ["data structures", "trees"],
    status: "planned",
    path: "/experiments/binary-tree",
  },
  {
    id: "bloom-filter",
    tags: ["data structures", "probabilistic"],
    status: "planned",
    path: "/experiments/bloom-filter",
  },
  {
    id: "cellular-automata",
    tags: ["simulation", "fun"],
    status: "planned",
    path: "/experiments/cellular-automata",
  },
  {
    id: "fourier-drawing",
    tags: ["math", "visualization", "fun"],
    status: "planned",
    path: "/experiments/fourier-drawing",
  },
];
