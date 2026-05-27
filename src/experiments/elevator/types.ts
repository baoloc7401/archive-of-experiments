export type AlgorithmId = 'fcfs' | 'sstf' | 'scan' | 'look' | 'c-scan' | 'c-look';

export type Direction = 'up' | 'down';

export type SimStatus = 'idle' | 'running' | 'paused' | 'done';

export interface ElevatorRequest {
  id: number;
  floor: number;
  bornTick: number;
  servedTick: number | null;
}

export interface SimState {
  algorithm: AlgorithmId;
  totalFloors: number;
  position: number;
  direction: Direction;
  pending: ElevatorRequest[];
  served: ElevatorRequest[];
  tick: number;
  totalTravel: number;
  reversals: number;
  status: SimStatus;
  flashFloor: number | null;
  jumpFrom: number | null;
}

export interface AlgorithmInfo {
  id: AlgorithmId;
  name: string;
  short: string;
  tagline: string;
  description: string;
}
