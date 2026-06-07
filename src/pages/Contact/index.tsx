import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ExperimentLayout, Button } from "../../components/ui";
import ScrambleText from "../../components/ScrambleText";
import { SITE } from "../../seo/site";
import "./Contact.css";

const EMAIL = "baoloc7401@gmail.com";
const GITHUB = SITE.authorUrl;
const REPO = `${SITE.authorUrl}/archive-of-experiments`;
const COPIED_MS = 1600;

export default function Contact() {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    []
  );

  const copyEmail = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(EMAIL);
    } catch {
      return;
    }
    setCopied(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), COPIED_MS);
  }, []);

  return (
    <ExperimentLayout
      crumbs={[{ label: t("contact.crumb") }]}
      glow="accent"
      info={
        <>
          <p className="contact-tagline">
            <ScrambleText text={t("contact.tagline")} duration={600} />
          </p>
          <p className="contact-lede">
            <ScrambleText text={t("contact.lede")} duration={600} />
          </p>
        </>
      }
    >
      <div className="contact">
        <h1 className="contact-title">
          <ScrambleText text={t("contact.title")} duration={700} />
        </h1>

        <ul className="contact-methods">
          <li className="contact-method">
            <span className="contact-method-icon" aria-hidden="true">
              @
            </span>
            <div className="contact-method-body">
              <span className="contact-method-label">
                <ScrambleText text={t("contact.email.label")} duration={500} />
              </span>
              <a className="contact-method-value" href={`mailto:${EMAIL}`}>
                {EMAIL}
              </a>
            </div>
            <Button
              size="sm"
              variant={copied ? "primary" : "ghost"}
              onClick={copyEmail}
            >
              <ScrambleText
                text={copied ? t("contact.email.copied") : t("contact.email.copy")}
                duration={400}
              />
            </Button>
          </li>

          <li className="contact-method">
            <span className="contact-method-icon" aria-hidden="true">
              {"{}"}
            </span>
            <div className="contact-method-body">
              <span className="contact-method-label">
                <ScrambleText text={t("contact.github.label")} duration={500} />
              </span>
              <a
                className="contact-method-value"
                href={GITHUB}
                target="_blank"
                rel="noreferrer"
              >
                github.com/baoloc7401
              </a>
            </div>
            <a
              className="contact-method-action"
              href={GITHUB}
              target="_blank"
              rel="noreferrer"
            >
              <ScrambleText text={t("contact.github.open")} duration={450} />
              <span aria-hidden="true">↗</span>
            </a>
          </li>

          <li className="contact-method">
            <span className="contact-method-icon" aria-hidden="true">
              !
            </span>
            <div className="contact-method-body">
              <span className="contact-method-label">
                <ScrambleText text={t("contact.issues.label")} duration={500} />
              </span>
              <a
                className="contact-method-value"
                href={`${REPO}/issues/new/choose`}
                target="_blank"
                rel="noreferrer"
              >
                <ScrambleText text={t("contact.issues.value")} duration={500} />
              </a>
            </div>
            <a
              className="contact-method-action"
              href={`${REPO}/issues/new/choose`}
              target="_blank"
              rel="noreferrer"
            >
              <ScrambleText text={t("contact.issues.open")} duration={450} />
              <span aria-hidden="true">↗</span>
            </a>
          </li>
        </ul>

        <p className="contact-note">
          <ScrambleText text={t("contact.note")} duration={600} />
        </p>

        <div className="contact-back">
          <Link to="/about" className="contact-back-link">
            <span aria-hidden="true">←</span>
            <ScrambleText text={t("contact.back")} duration={600} />
          </Link>
        </div>
      </div>
    </ExperimentLayout>
  );
}
