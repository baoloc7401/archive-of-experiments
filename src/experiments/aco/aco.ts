import type { AcoParams, Point, Tour } from "./types";
import { SCALE, CONVERGE_PATIENCE } from "./constants";

// ---------------------------------------------------------------------------
// Ant System (Dorigo, 1992) on the symmetric Euclidean TSP.
//
// Each iteration every ant builds a closed tour, choosing the next city with
// probability ∝ τ_ij^α · η_ij^β  (pheromone × visibility, η = 1/distance).
// Then pheromone evaporates globally and each ant deposits Q / L_k on the
// edges of its tour, so short tours get reinforced. The colony converges on a
// near-optimal loop that no single greedy ant could plan.
// ---------------------------------------------------------------------------

export class Colony {
  readonly cities: Point[];
  readonly n: number;
  /** Mutable so live slider edits (α, β, ρ, ants) take effect without a rebuild. */
  params: AcoParams;

  /** Flat n×n symmetric distance matrix (virtual SCALE space). */
  private dist: Float64Array;
  /** Visibility η = 1/distance, flat n×n. */
  private eta: Float64Array;
  /** Pheromone τ, flat n×n. */
  pheromone: Float64Array;
  /** Cached max pheromone for normalised rendering. */
  maxPheromone = 1;

  tau0 = 1;
  nnLength: number;

  best: Tour | null = null;
  iteration = 0;
  history: number[] = []; // best-so-far length per committed iteration
  lastBestLength = Infinity;
  lastAvgLength = Infinity;
  private staleFor = 0;

  constructor(cities: Point[], params: AcoParams) {
    this.cities = cities;
    this.n = cities.length;
    this.params = params;

    const n = this.n;
    this.dist = new Float64Array(n * n);
    this.eta = new Float64Array(n * n);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = (cities[i].x - cities[j].x) * SCALE;
        const dy = (cities[i].y - cities[j].y) * SCALE;
        const d = Math.max(1e-6, Math.hypot(dx, dy));
        this.dist[i * n + j] = d;
        this.dist[j * n + i] = d;
        const e = 1 / d;
        this.eta[i * n + j] = e;
        this.eta[j * n + i] = e;
      }
    }

    this.nnLength = this.nearestNeighbourLength(0);
    // Recommended AS initialisation: τ0 = m / L_nn.
    this.tau0 = this.nnLength > 0 ? params.ants / this.nnLength : 1;
    this.pheromone = new Float64Array(n * n).fill(this.tau0);
    this.maxPheromone = this.tau0;
  }

  d(i: number, j: number) {
    return this.dist[i * this.n + j];
  }

  // --- Tour construction -------------------------------------------------

  /** Build one ant's tour starting from `start`, choosing edges stochastically. */
  private buildTour(start: number): Tour {
    const n = this.n;
    const { alpha, beta } = this.params;
    const visited = new Uint8Array(n);
    const path: number[] = new Array(n);
    path[0] = start;
    visited[start] = 1;

    const weights = new Float64Array(n);

    for (let step = 1; step < n; step++) {
      const i = path[step - 1];
      const row = i * n;
      let total = 0;
      for (let j = 0; j < n; j++) {
        if (visited[j]) continue;
        // τ^α · η^β. Math.pow dominates but n is small.
        const w = Math.pow(this.pheromone[row + j], alpha) * Math.pow(this.eta[row + j], beta);
        weights[j] = w;
        total += w;
      }

      let next = -1;
      if (total > 0 && Number.isFinite(total)) {
        let r = Math.random() * total;
        for (let j = 0; j < n; j++) {
          if (visited[j]) continue;
          r -= weights[j];
          if (r <= 0) {
            next = j;
            break;
          }
        }
      }
      // Fallback (all-zero weights or float drift): nearest unvisited.
      if (next < 0) {
        let bestD = Infinity;
        for (let j = 0; j < n; j++) {
          if (visited[j]) continue;
          const dj = this.dist[row + j];
          if (dj < bestD) {
            bestD = dj;
            next = j;
          }
        }
      }
      path[step] = next;
      visited[next] = 1;
    }

    return { path, length: this.tourLength(path) };
  }

  tourLength(path: number[]): number {
    let len = 0;
    for (let k = 0; k < path.length; k++) {
      const a = path[k];
      const b = path[(k + 1) % path.length];
      len += this.dist[a * this.n + b];
    }
    return len;
  }

  /** Construct one full generation of ant tours (does NOT update pheromone). */
  buildGeneration(): Tour[] {
    const tours: Tour[] = new Array(this.params.ants);
    for (let k = 0; k < this.params.ants; k++) {
      tours[k] = this.buildTour(Math.floor(Math.random() * this.n));
    }
    return tours;
  }

  // --- Pheromone update --------------------------------------------------

  /** Evaporate, deposit, refresh best/history. Call after a generation walk. */
  commit(tours: Tour[]): void {
    const n = this.n;
    const { rho, q, elitist } = this.params;

    // Global evaporation.
    const keep = 1 - rho;
    for (let k = 0; k < this.pheromone.length; k++) this.pheromone[k] *= keep;

    // Each ant deposits Q / L on the (symmetric) edges of its tour.
    let sum = 0;
    let genBest = Infinity;
    for (const tour of tours) {
      const add = q / tour.length;
      const p = tour.path;
      for (let k = 0; k < p.length; k++) {
        const a = p[k];
        const b = p[(k + 1) % p.length];
        this.pheromone[a * n + b] += add;
        this.pheromone[b * n + a] += add;
      }
      sum += tour.length;
      if (tour.length < genBest) genBest = tour.length;
      if (!this.best || tour.length < this.best.length) {
        this.best = { path: p.slice(), length: tour.length };
      }
    }

    // Elitist reinforcement: the best-so-far tour gets an extra dose, scaled by
    // colony size so it competes with the generation's collective deposit.
    if (elitist && this.best) {
      const add = (this.params.ants * q) / this.best.length;
      const p = this.best.path;
      for (let k = 0; k < p.length; k++) {
        const a = p[k];
        const b = p[(k + 1) % p.length];
        this.pheromone[a * n + b] += add;
        this.pheromone[b * n + a] += add;
      }
    }

    // Track convergence + bookkeeping.
    let mx = 0;
    for (let k = 0; k < this.pheromone.length; k++) {
      if (this.pheromone[k] > mx) mx = this.pheromone[k];
    }
    this.maxPheromone = mx || this.tau0;

    const prevBest = this.history.length ? this.history[this.history.length - 1] : Infinity;
    const curBest = this.best ? this.best.length : Infinity;
    this.staleFor = curBest >= prevBest - 1e-6 ? this.staleFor + 1 : 0;

    this.lastBestLength = genBest;
    this.lastAvgLength = tours.length ? sum / tours.length : Infinity;
    this.iteration++;
    this.history.push(curBest);
  }

  get converged(): boolean {
    return this.staleFor >= CONVERGE_PATIENCE;
  }

  // --- Baseline ----------------------------------------------------------

  private nearestNeighbourLength(start: number): number {
    const n = this.n;
    const visited = new Uint8Array(n);
    let cur = start;
    visited[cur] = 1;
    let len = 0;
    for (let step = 1; step < n; step++) {
      let bestD = Infinity;
      let next = -1;
      for (let j = 0; j < n; j++) {
        if (visited[j]) continue;
        const dj = this.dist[cur * n + j];
        if (dj < bestD) {
          bestD = dj;
          next = j;
        }
      }
      len += bestD;
      visited[next] = 1;
      cur = next;
    }
    len += this.dist[cur * n + start];
    return len;
  }
}
