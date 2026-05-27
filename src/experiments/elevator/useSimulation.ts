import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { AlgorithmId, SimState, SimStatus } from './types';
import { decide } from './algorithms';
import { TOTAL_FLOORS } from './constants';

type Action =
  | { type: 'set-algorithm'; id: AlgorithmId }
  | { type: 'add-request'; floor: number }
  | { type: 'clear' }
  | { type: 'tick' }
  | { type: 'set-status'; status: SimStatus }
  | { type: 'clear-flash' }
  | { type: 'reset'; algorithm: AlgorithmId };

const FLASH_DURATION_MS = 380;

function initialState(algorithm: AlgorithmId): SimState {
  return {
    algorithm,
    totalFloors: TOTAL_FLOORS,
    position: 0,
    direction: 'up',
    pending: [],
    served: [],
    tick: 0,
    totalTravel: 0,
    reversals: 0,
    status: 'idle',
    flashFloor: null,
    jumpFrom: null,
  };
}

let nextId = 1;

function reducer(state: SimState, action: Action): SimState {
  switch (action.type) {
    case 'set-algorithm':
      return { ...state, algorithm: action.id };

    case 'add-request': {
      const { floor } = action;
      if (floor < 0 || floor >= state.totalFloors) return state;
      // Don't add a duplicate pending request for the same floor.
      if (state.pending.some(r => r.floor === floor)) return state;
      // Don't add a request for the floor we are currently parked on while idle.
      if (state.status !== 'running' && state.position === floor && state.pending.length === 0) return state;
      return {
        ...state,
        pending: [
          ...state.pending,
          { id: nextId++, floor, bornTick: state.tick, servedTick: null },
        ],
      };
    }

    case 'clear':
      return { ...initialState(state.algorithm) };

    case 'reset':
      return { ...initialState(action.algorithm) };

    case 'set-status':
      return { ...state, status: action.status };

    case 'clear-flash':
      return { ...state, flashFloor: null, jumpFrom: null };

    case 'tick': {
      // 1. Serve everything at current floor.
      let pending = state.pending;
      let served = state.served;
      let flashFloor: number | null = state.flashFloor;
      const arrived = pending.filter(r => r.floor === state.position);
      if (arrived.length > 0) {
        served = [
          ...served,
          ...arrived.map(r => ({ ...r, servedTick: state.tick })),
        ];
        pending = pending.filter(r => r.floor !== state.position);
        flashFloor = state.position;
      }

      // 2. If no pending, we go idle.
      if (pending.length === 0) {
        return {
          ...state,
          pending,
          served,
          flashFloor,
          jumpFrom: null,
          status: 'idle',
          tick: state.tick + 1,
        };
      }

      // 3. Ask the algorithm where to go next.
      const decision = decide(state.algorithm, {
        pending,
        position: state.position,
        direction: state.direction,
        totalFloors: state.totalFloors,
      });
      if (!decision) {
        return {
          ...state,
          pending,
          served,
          flashFloor,
          status: 'idle',
          tick: state.tick + 1,
        };
      }

      const reversed = decision.direction !== state.direction && pending.length > 0;
      const travel = decision.isJump
        ? Math.abs(decision.nextPos - state.position)
        : 1;

      return {
        ...state,
        position: decision.nextPos,
        direction: decision.direction,
        pending,
        served,
        tick: state.tick + 1,
        totalTravel: state.totalTravel + travel,
        reversals: reversed ? state.reversals + 1 : state.reversals,
        flashFloor,
        jumpFrom: decision.isJump ? state.position : null,
        status: 'running',
      };
    }
  }
}

interface UseSimulationArgs {
  algorithm: AlgorithmId;
  tickMs: number;
}

export function useSimulation({ algorithm, tickMs }: UseSimulationArgs) {
  const [state, dispatch] = useReducer(reducer, algorithm, initialState);
  const timerRef = useRef<number | null>(null);
  const flashTimerRef = useRef<number | null>(null);

  // Sync algorithm if it changes externally — also resets so behavior is clean.
  useEffect(() => {
    if (state.algorithm !== algorithm) {
      dispatch({ type: 'reset', algorithm });
    }
  }, [algorithm, state.algorithm]);

  // Drive ticks when running.
  useEffect(() => {
    if (state.status !== 'running') return;
    if (state.pending.length === 0) {
      dispatch({ type: 'set-status', status: 'idle' });
      return;
    }
    timerRef.current = window.setTimeout(() => {
      dispatch({ type: 'tick' });
    }, tickMs);
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [state.status, state.tick, state.pending.length, tickMs]);

  // When new requests arrive while idle, kick into running.
  useEffect(() => {
    if (state.status === 'idle' && state.pending.length > 0) {
      dispatch({ type: 'set-status', status: 'running' });
    }
  }, [state.status, state.pending.length]);

  // Clear the floor-flash effect after its animation.
  useEffect(() => {
    if (state.flashFloor === null && state.jumpFrom === null) return;
    flashTimerRef.current = window.setTimeout(() => {
      dispatch({ type: 'clear-flash' });
    }, FLASH_DURATION_MS);
    return () => {
      if (flashTimerRef.current !== null) {
        window.clearTimeout(flashTimerRef.current);
        flashTimerRef.current = null;
      }
    };
  }, [state.flashFloor, state.jumpFrom]);

  const addRequest = useCallback((floor: number) => {
    dispatch({ type: 'add-request', floor });
  }, []);

  const play = useCallback(() => {
    dispatch({ type: 'set-status', status: 'running' });
  }, []);

  const pause = useCallback(() => {
    dispatch({ type: 'set-status', status: 'paused' });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'reset', algorithm });
  }, [algorithm]);

  const clearAll = useCallback(() => {
    dispatch({ type: 'clear' });
  }, []);

  const seedRandom = useCallback((count: number) => {
    // Used by the "shuffle" button.
    for (let i = 0; i < count; i++) {
      const f = Math.floor(Math.random() * TOTAL_FLOORS);
      dispatch({ type: 'add-request', floor: f });
    }
  }, []);

  return { state, addRequest, play, pause, reset, clearAll, seedRandom };
}
