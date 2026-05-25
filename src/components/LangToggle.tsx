import { useTranslation } from "react-i18next";

export default function LangToggle() {
  const { t, i18n } = useTranslation();
  const isVi = i18n.language === "vi";

  function toggle() {
    const newLang = isVi ? "en" : "vi";
    const root = document.getElementById("root");
    i18n.changeLanguage(newLang);
    localStorage.setItem("lang", newLang);
    if (root) {
      root.classList.remove("lang-entering");
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          root.classList.add("lang-entering");
          root.addEventListener(
            "animationend",
            () => root.classList.remove("lang-entering"),
            { once: true }
          );
        });
      });
    }
  }

  return (
    <button
      className={`lang-toggle${isVi ? " lang-toggle--vi" : ""}`}
      onClick={toggle}
      aria-label={t("aria.lang_switch")}
    >
      <div className="lang-knob" aria-hidden="true" />
      <span className="lang-opt">EN</span>
      <span className="lang-opt">VI</span>
    </button>
  );
}
