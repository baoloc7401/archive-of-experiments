/// <reference lib="webworker" />
import type { AIConfig, Move, Position } from '../types';
import { clearTT, getBestMove } from './index';

export interface SearchRequest {
  type: 'search';
  id: number;
  pos: Position;
  config: AIConfig;
  history: ReadonlyArray<[string, number]>;
}

export interface ClearRequest {
  type: 'clear';
}

export type WorkerRequest = SearchRequest | ClearRequest;

export interface SearchResult {
  type: 'result';
  id: number;
  move: Move | null;
}

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.addEventListener('message', (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  if (msg.type === 'clear') {
    clearTT();
    return;
  }
  if (msg.type === 'search') {
    const move = getBestMove(msg.pos, msg.config, new Map(msg.history));
    const result: SearchResult = { type: 'result', id: msg.id, move };
    ctx.postMessage(result);
  }
});
