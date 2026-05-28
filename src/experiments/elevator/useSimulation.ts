import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import type {
  AlgorithmId,
  ElevatorRequest,
  ElevatorState,
  LogEntry,
  RequestOrigin,
  SimState,
  SimStatus,
} from './types';
import { decide } from './algorithms';
import { ALGORITHM_BY_ID, TOTAL_FLOORS } from './constants';

type Action =
  | { type: 'set-algorithms'; ids: AlgorithmId[] }
  | { type: 'add-request'; floor: number; origin: RequestOrigin }
  | { type: 'clear' }
  | { type: 'tick' }
  | { type: 'set-status'; status: SimStatus };

const MAX_LOG = 600;
const pad = (n: number) => String(n).padStart(2, '0');

let nextReqId = 1;
let nextLogId = 1;

function makeElevator(algorithm: AlgorithmId): ElevatorState {
  return {
    algorithm,
    position: 0,
    direction: 'up',
    pending: [],
    served: [],
    totalTravel: 0,
    reversals: 0,
    flashFloor: null,
    express: null,
    idle: true,
  };
}

function initState(algorithms: AlgorithmId[]): SimState {
  const ids = algorithms.length ? algorithms : (['look'] as AlgorithmId[]);
  return {
    totalFloors: TOTAL_FLOORS,
    tick: 0,
    status: 'idle',
    elevators: ids.map(makeElevator),
    log: [],
  };
}

function log(
  entries: LogEntry[],
  tick: number,
  algorithm: AlgorithmId | null,
  kind: LogEntry['kind'],
  text: string,
): void {
  entries.push({ id: nextLogId++, tick, algorithm, kind, text });
}

/** Is this exact (floor, origin) call still outstanding for any elevator? */
function callActive(state: SimState, floor: number, origin: RequestOrigin): boolean {
  return state.elevators.some(el =>
    el.pending.some(r => r.floor === floor && r.origin === origin),
  );
}

function reducer(state: SimState, action: Action): SimState {
  switch (action.type) {
    case 'set-algorithms': {
      const ids = action.ids.length ? action.ids : (['look'] as AlgorithmId[]);
      // Reconfiguring the line-up wipes everything — including the log.
      return initState(ids);
    }

    case 'clear':
      return initState(state.elevators.map(e => e.algorithm));

    case 'set-status':
      return { ...state, status: action.status };

    case 'add-request': {
      const { floor, origin } = action;
      if (floor < 0 || floor >= state.totalFloors) return state;
      if (callActive(state, floor, origin)) return state;

      const id = nextReqId++;
      const elevators = state.elevators.map(el => {
        const req: ElevatorRequest = {
          id,
          floor,
          origin,
          bornTick: state.tick,
          servedTick: null,
        };
        return { ...el, pending: [...el.pending, req] };
      });
      const newLog = state.log.slice();
      log(newLog, state.tick, null, 'call', `CALL F${pad(floor)} ${origin}`);
      return { ...state, elevators, log: trim(newLog) };
    }

    case 'tick': {
      const newLog = state.log.slice();
      const tick = state.tick;

      const elevators = state.elevators.map(el => {
        if (el.pending.length === 0) {
          return el.idle ? el : { ...el, flashFloor: null, express: null, idle: true };
        }

        // 0. Already on a non-stop express return (C-SCAN / C-LOOK circular
        //    descent): physically travel one floor toward the target WITHOUT
        //    serving anyone, then resume normal service on arrival. On the
        //    arrival step we flip the heading to 'up' so the following upward
        //    move isn't miscounted as a reversal.
        if (el.express !== null) {
          const nextPos = el.position - 1;
          const arrived = nextPos === el.express;
          return {
            ...el,
            position: nextPos,
            direction: arrived ? 'up' : 'down',
            totalTravel: el.totalTravel + 1,
            express: arrived ? null : el.express,
            flashFloor: null,
            idle: false,
          };
        }

        // 1. Serve arrivals at the current floor. FCFS only targets the head,
        //    so it visibly zig-zags; once physically at a floor everyone there
        //    boards/alights.
        let pending = el.pending;
        let served = el.served;
        let flashFloor: number | null = null;
        const serveHere =
          el.algorithm !== 'fcfs' || (pending.length > 0 && pending[0].floor === el.position);
        if (serveHere) {
          const arrived = pending.filter(r => r.floor === el.position);
          if (arrived.length > 0) {
            const ids = new Set(arrived.map(r => r.id));
            served = [...served, ...arrived.map(r => ({ ...r, servedTick: tick }))];
            pending = pending.filter(r => !ids.has(r.id));
            flashFloor = el.position;
            log(newLog, tick, el.algorithm, 'serve',
              `serve F${pad(el.position)}${arrived.length > 1 ? ` ×${arrived.length}` : ''}`);
          }
        }

        if (pending.length === 0) {
          log(newLog, tick, el.algorithm, 'done', 'queue empty — idle');
          return { ...el, pending, served, flashFloor, express: null, idle: true };
        }

        // 2. Where next?
        const decision = decide(el.algorithm, {
          pending,
          position: el.position,
          direction: el.direction,
          totalFloors: state.totalFloors,
          idle: el.idle,
        });
        if (!decision) {
          return { ...el, pending, served, flashFloor, express: null, idle: true };
        }

        // 2a. Begin a non-stop express return.
        if (decision.express !== undefined) {
          const target = decision.express;
          const arrived = decision.nextPos === target;
          log(newLog, tick, el.algorithm, 'express', `express → F${pad(target)} (non-stop)`);
          return {
            ...el,
            position: decision.nextPos,
            direction: arrived ? 'up' : decision.direction,
            pending,
            served,
            totalTravel: el.totalTravel + Math.abs(decision.nextPos - el.position),
            express: arrived ? null : target,
            flashFloor,
            idle: false,
          };
        }

        // 2b. Normal one-floor move. A direction flip only counts as a reversal
        //     if the car was already moving — picking a heading out of idle is
        //     not a reversal.
        const reversed = decision.direction !== el.direction && !el.idle;
        if (reversed) {
          log(newLog, tick, el.algorithm, 'reverse', `reverse → ${decision.direction}`);
        }
        return {
          ...el,
          position: decision.nextPos,
          direction: decision.direction,
          pending,
          served,
          totalTravel: el.totalTravel + 1,
          reversals: reversed ? el.reversals + 1 : el.reversals,
          flashFloor,
          idle: false,
        };
      });

      const anyPending = elevators.some(el => el.pending.length > 0);
      return {
        ...state,
        elevators,
        tick: tick + 1,
        status: anyPending ? 'running' : 'idle',
        log: trim(newLog),
      };
    }
  }
}

function trim(entries: LogEntry[]): LogEntry[] {
  return entries.length > MAX_LOG ? entries.slice(entries.length - MAX_LOG) : entries;
}

interface UseSimulationArgs {
  algorithms: AlgorithmId[];
  tickMs: number;
}

export function useSimulation({ algorithms, tickMs }: UseSimulationArgs) {
  const [state, dispatch] = useReducer(reducer, algorithms, initState);
  const timerRef = useRef<number | null>(null);

  const algoKey = algorithms.join(',');
  const stateKey = state.elevators.map(e => e.algorithm).join(',');

  // Reconfigure when the selected line-up changes.
  useEffect(() => {
    if (algoKey !== stateKey) {
      dispatch({ type: 'set-algorithms', ids: algoKey ? (algoKey.split(',') as AlgorithmId[]) : [] });
    }
  }, [algoKey, stateKey]);

  const anyPending = state.elevators.some(el => el.pending.length > 0);

  // Drive synchronized ticks across all elevators while running.
  useEffect(() => {
    if (state.status !== 'running') return;
    if (!anyPending) {
      dispatch({ type: 'set-status', status: 'idle' });
      return;
    }
    timerRef.current = window.setTimeout(() => dispatch({ type: 'tick' }), tickMs);
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [state.status, state.tick, anyPending, tickMs]);

  // Kick into running when calls arrive while idle.
  useEffect(() => {
    if (state.status === 'idle' && anyPending) {
      dispatch({ type: 'set-status', status: 'running' });
    }
  }, [state.status, anyPending]);

  const addRequest = useCallback((floor: number, origin: RequestOrigin) => {
    dispatch({ type: 'add-request', floor, origin });
  }, []);

  const play = useCallback(() => dispatch({ type: 'set-status', status: 'running' }), []);
  const pause = useCallback(() => dispatch({ type: 'set-status', status: 'paused' }), []);
  const clearAll = useCallback(() => dispatch({ type: 'clear' }), []);
  const reset = useCallback(() => dispatch({ type: 'clear' }), []);

  const seedRandom = useCallback((count: number) => {
    for (let i = 0; i < count; i++) {
      const f = Math.floor(Math.random() * TOTAL_FLOORS);
      let origin: RequestOrigin;
      if (Math.random() < 0.4) origin = 'car';
      else if (f === 0) origin = 'hall-up';
      else if (f === TOTAL_FLOORS - 1) origin = 'hall-down';
      else origin = Math.random() < 0.5 ? 'hall-up' : 'hall-down';
      dispatch({ type: 'add-request', floor: f, origin });
    }
  }, []);

  // Union of still-outstanding calls across every elevator (the master
  // workload), deduped by floor + origin, with the longest current wait.
  const activeCalls = useMemo(() => {
    const map = new Map<string, ElevatorRequest>();
    for (const el of state.elevators) {
      for (const r of el.pending) {
        const key = `${r.floor}:${r.origin}`;
        const existing = map.get(key);
        if (!existing || r.bornTick < existing.bornTick) map.set(key, r);
      }
    }
    return [...map.values()].sort((a, b) => a.bornTick - b.bornTick || a.floor - b.floor);
  }, [state.elevators]);

  const comparing = state.elevators.length > 1;

  return {
    state,
    comparing,
    activeCalls,
    addRequest,
    play,
    pause,
    reset,
    clearAll,
    seedRandom,
  };
}

export function describeAlgorithms(ids: AlgorithmId[]): string {
  return ids.map(id => ALGORITHM_BY_ID[id].name).join(', ');
}
