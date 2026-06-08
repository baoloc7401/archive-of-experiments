import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en";

const saved = localStorage.getItem("lang") ?? "en";

// Only English (the default + fallback) is bundled eagerly. Every other locale
// is code-split via dynamic import and registered on first use - this keeps the
// ~48 KB of inactive translations out of the landing bundle's parse/eval. See
// loadLocale() / restoreLanguage() below; LangToggle awaits loadLocale too.
i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

const loaders: Record<string, () => Promise<{ default: object }>> = {
  vi: () => import("./locales/vi"),
};

/** Fetch and register a locale's chunk if it isn't already loaded. */
export async function loadLocale(lng: string): Promise<void> {
  if (lng === "en" || i18n.hasResourceBundle(lng, "translation")) return;
  const loader = loaders[lng];
  if (!loader) return;
  const mod = await loader();
  i18n.addResourceBundle(lng, "translation", mod.default, true, true);
}

/** Restore the saved language at startup: English is instant; another locale
 *  loads its chunk before we switch, so the app mounts already translated. */
export async function restoreLanguage(): Promise<void> {
  if (saved === "en") return;
  await loadLocale(saved);
  await i18n.changeLanguage(saved);
}

export default i18n;
