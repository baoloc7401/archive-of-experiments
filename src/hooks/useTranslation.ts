import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  changeLanguage,
  getLanguage,
  subscribe,
  translate,
  type TOptions,
} from "@/i18n";

export type TFunction = {
  (key: string, options: TOptions & { returnObjects: true }): unknown;
  (key: string, options?: TOptions): string;
};

/** Drop-in replacement for react-i18next's useTranslation(): re-renders on
 *  language change, and returns a new `t` only when the language does (some
 *  callers key memoization off `t`'s identity). */
export function useTranslation() {
  const lang = useSyncExternalStore(subscribe, getLanguage);

  const t = useCallback(
    (key: string, options?: TOptions) => translate(lang, key, options),
    [lang]
  ) as TFunction;

  const i18n = useMemo(() => ({ language: lang, changeLanguage }), [lang]);

  return { t, i18n };
}
