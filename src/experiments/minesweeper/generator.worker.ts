import { generateField } from "./generator";
import type { FieldConfig, GenStats, Minefield } from "./types";

export interface ForgeRequest {
  cfg: FieldConfig;
  origin: number;
  id: number;
}

export type ForgeResponse =
  | { id: number; field: Minefield; stats: GenStats }
  | { id: number; error: string };

self.onmessage = (e: MessageEvent<ForgeRequest>): void => {
  const { cfg, origin, id } = e.data;
  try {
    const { field, stats } = generateField(cfg, origin);
    self.postMessage({ id, field, stats });
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};
