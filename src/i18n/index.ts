import en from "./locales/en";

type Bundle = Record<string, unknown>;

/** Options accepted by `t()`: interpolation vars plus the two i18next-style flags in use. */
export interface TOptions {
  readonly [key: string]: unknown;
  count?: number;
  returnObjects?: boolean;
}

const resources: Record<string, Bundle> = { en: en as Bundle };
let currentLang = "en";
const listeners = new Set<() => void>();

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLanguage(): string {
  return currentLang;
}

/** Switches the active language and notifies subscribed components. No-op if a locale hasn't been loaded (call loadLocale first). */
export function changeLanguage(lng: string): void {
  if (lng === currentLang || (lng !== "en" && !resources[lng])) return;
  currentLang = lng;
  listeners.forEach((listener) => listener());
}

function resolvePath(bundle: Bundle | undefined, path: string): unknown {
  if (!bundle) return undefined;
  let value: unknown = bundle;
  for (const part of path.split(".")) {
    if (value === null || typeof value !== "object" || !(part in value)) return undefined;
    value = (value as Record<string, unknown>)[part];
  }
  return value;
}

function lookup(lang: string, key: string): unknown {
  const own = resolvePath(resources[lang], key);
  if (own !== undefined) return own;
  return lang === "en" ? undefined : resolvePath(resources.en, key);
}

function interpolate(str: string, options: TOptions | undefined): string {
  if (!options) return str;
  return str.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) =>
    name in options ? String(options[name]) : match
  );
}

/** Translation lookup: dot-path keys, `{{var}}` interpolation, `_one`/`_other` pluralization
 *  (picked via options.count), and `returnObjects` to get the raw array/object leaf. */
export function translate(lang: string, key: string, options?: TOptions): unknown {
  let resolvedKey = key;
  if (typeof options?.count === "number") {
    const suffixed = `${key}_${options.count === 1 ? "one" : "other"}`;
    if (lookup(lang, suffixed) !== undefined) resolvedKey = suffixed;
  }
  const value = lookup(lang, resolvedKey);
  if (value === undefined) return key;
  if (options?.returnObjects) return value;
  return typeof value === "string" ? interpolate(value, options) : value;
}

const loaders: Record<string, () => Promise<{ default: Bundle }>> = {
  vi: () => import("./locales/vi") as Promise<{ default: Bundle }>,
};

/** Fetch and register a locale's chunk if it isn't already loaded. */
export async function loadLocale(lng: string): Promise<void> {
  if (lng === "en" || resources[lng]) return;
  const loader = loaders[lng];
  if (!loader) return;
  const mod = await loader();
  resources[lng] = mod.default;
}

/** Restore the saved language at startup: English is instant; another locale
 *  loads its chunk before we switch, so the app mounts already translated. */
export async function restoreLanguage(): Promise<void> {
  const saved = localStorage.getItem("lang") ?? "en";
  if (saved === "en") return;
  await loadLocale(saved);
  changeLanguage(saved);
}
