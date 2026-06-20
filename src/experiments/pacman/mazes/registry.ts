// Maze catalogue: the built-in layouts (the classic board plus a couple of
// frozen generated originals) and CRUD for player-made mazes persisted in
// localStorage. Built-ins are derived once at module load with fixed seeds, so
// they are deterministic across sessions and always valid.

import { classicGrid, type MazeGrid } from "./structure";
import { generateMaze } from "./generate";
import { validateMaze } from "./validate";

export interface MazeEntry {
  id: string;
  /** i18n key suffix for built-ins; the raw name for custom mazes. */
  name: string;
  grid: MazeGrid;
  builtin: boolean;
}

export const BUILTIN_MAZES: MazeEntry[] = [
  { id: "classic", name: "classic", grid: classicGrid(), builtin: true },
  { id: "original-1", name: "original_1", grid: generateMaze(1337), builtin: true },
  { id: "original-2", name: "original_2", grid: generateMaze(90210), builtin: true },
];

const STORAGE_KEY = "pacman.customMazes";

interface StoredMaze {
  id: string;
  name: string;
  grid: MazeGrid;
}

/** Load player-saved mazes from localStorage, skipping anything that no longer validates. */
export function loadCustomMazes(): MazeEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredMaze[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (m) =>
          m &&
          typeof m.id === "string" &&
          typeof m.name === "string" &&
          Array.isArray(m.grid) &&
          validateMaze(m.grid).ok,
      )
      .map((m) => ({ id: m.id, name: m.name, grid: m.grid, builtin: false }));
  } catch {
    return [];
  }
}

function persist(entries: MazeEntry[]): void {
  try {
    const stored: StoredMaze[] = entries.map((m) => ({ id: m.id, name: m.name, grid: m.grid }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    /* storage full or unavailable - saving is best-effort */
  }
}

/** Save (or overwrite a same-named) custom maze; returns the updated custom list. */
export function saveCustomMaze(name: string, grid: MazeGrid): MazeEntry[] {
  const trimmed = name.trim() || "untitled";
  const existing = loadCustomMazes();
  const without = existing.filter((m) => m.name !== trimmed);
  const entry: MazeEntry = {
    id: `custom-${Date.now().toString(36)}`,
    name: trimmed,
    grid,
    builtin: false,
  };
  const next = [...without, entry];
  persist(next);
  return next;
}

/** Delete a custom maze by id; returns the updated custom list. */
export function deleteCustomMaze(id: string): MazeEntry[] {
  const next = loadCustomMazes().filter((m) => m.id !== id);
  persist(next);
  return next;
}
