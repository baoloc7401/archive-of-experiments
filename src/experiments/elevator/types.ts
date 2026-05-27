export type AlgorithmId = 'fcfs' | 'sstf' | 'scan' | 'look' | 'c-scan' | 'c-look';

export type Direction = 'up' | 'down';

export type SimStatus = 'idle' | 'running' | 'paused' | 'done';

/** Where a request came from: a hall call outside (with intended travel
 *  direction) or a destination button pressed inside the car. */
export type RequestOrigin = 'car' | 'hall-up' | 'hall-down';

export interface ElevatorRequest {
  id: number;
  floor: number;
  origin: RequestOrigin;
  bornTick: number;
  servedTick: number | null;
}

/** One independent elevator. In comparison mode there is one of these per
 *  selected algorithm, all fed the same stream of calls. */
export interface ElevatorState {
  algorithm: AlgorithmId;
  position: number;
  direction: Direction;
  pending: ElevatorRequest[];
  served: ElevatorRequest[];
  totalTravel: number;
  reversals: number;
  flashFloor: number | null;
  /** Target floor of an in-progress non-stop express run (C-SCAN / C-LOOK
   *  circular return), or null when serving normally. */
  express: number | null;
  idle: boolean;
}

export type LogKind = 'call' | 'serve' | 'reverse' | 'express' | 'done' | 'reset';

export interface LogEntry {
  id: number;
  tick: number;
  algorithm: AlgorithmId | null;
  kind: LogKind;
  text: string;
}

export interface SimState {
  totalFloors: number;
  tick: number;
  status: SimStatus;
  elevators: ElevatorState[];
  log: LogEntry[];
}

export interface AlgorithmInfo {
  id: AlgorithmId;
  name: string;
  short: string;
  tagline: string;
  description: string;
}
