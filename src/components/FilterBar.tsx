import { useTranslation } from "react-i18next";
import type { CSSProperties } from "react";
import "./FilterBar.css";
import ScrambleText, { useScrambledText } from "./ScrambleText";
import type { ExperimentStatus } from "../experiments";

const SCRAMBLE_DURATION = 600;

export type StatusFilter = "all" | ExperimentStatus;

const STATUSES: StatusFilter[] = ["all", "active", "wip", "planned"];

const searchIcon = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="11" cy="11" r="7" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const clearIcon = (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const filterIcon = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

const chevronIcon = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

interface Props {
  open: boolean;
  onToggle: () => void;
  statusFilter: StatusFilter;
  onStatusChange: (s: StatusFilter) => void;
  activeTags: Set<string>;
  onToggleTag: (t: string) => void;
  allTags: string[];
  search: string;
  onSearchChange: (s: string) => void;
  statusCounts: Record<StatusFilter, number>;
  activeFilterCount: number;
  onClearFilters: () => void;
}

export default function FilterBar({
  open,
  onToggle,
  statusFilter,
  onStatusChange,
  activeTags,
  onToggleTag,
  allTags,
  search,
  onSearchChange,
  statusCounts,
  activeFilterCount,
  onClearFilters,
}: Props) {
  const { t } = useTranslation();
  const activeIndex = STATUSES.indexOf(statusFilter);
  const placeholderText = useScrambledText(t("filter.search_placeholder"), {
    duration: SCRAMBLE_DURATION,
  });

  function statusLabel(s: StatusFilter) {
    if (s === "all") return t("filter.all");
    return t(`status.${s}`);
  }

  return (
    <aside
      className={`sidebar${open ? " sidebar--open" : ""}`}
      aria-label={t("filter.sidebar_label")}
    >
      <div className="sidebar-rail">
        <button
          type="button"
          className="sidebar-toggle"
          onClick={onToggle}
          aria-expanded={open}
          aria-label={t(open ? "filter.collapse" : "filter.expand")}
        >
          <span className="sidebar-toggle-icon">{chevronIcon}</span>
        </button>

        <div className="sidebar-rail-meta" aria-hidden={open}>
          <div className="sidebar-rail-icon">{filterIcon}</div>
          <div className="sidebar-rail-label">
            <ScrambleText
              text={t("filter.rail_label")}
              duration={SCRAMBLE_DURATION}
            />
          </div>
          {activeFilterCount > 0 && (
            <span className="sidebar-rail-badge">{activeFilterCount}</span>
          )}
        </div>
      </div>

      <div className="sidebar-content" aria-hidden={!open}>
        <div className="sidebar-header">
          <span className="sidebar-header-mark">//</span>
          <span className="sidebar-header-title">
            <ScrambleText
              text={t("filter.title")}
              duration={SCRAMBLE_DURATION}
            />
          </span>
          {activeFilterCount > 0 && (
            <button
              type="button"
              className="sidebar-header-clear"
              onClick={onClearFilters}
              tabIndex={open ? 0 : -1}
            >
              <ScrambleText
                text={t("filter.clear")}
                duration={SCRAMBLE_DURATION}
              />
            </button>
          )}
        </div>

        <div className="sidebar-search">
          <span className="sidebar-search-icon">{searchIcon}</span>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={placeholderText}
            className="sidebar-search-input"
            aria-label={t("filter.search_placeholder")}
            tabIndex={open ? 0 : -1}
          />
          {search && (
            <button
              type="button"
              className="sidebar-search-clear"
              onClick={() => onSearchChange("")}
              aria-label={t("filter.clear")}
              tabIndex={open ? 0 : -1}
            >
              {clearIcon}
            </button>
          )}
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-label">
            <ScrambleText
              text={t("filter.status_label")}
              duration={SCRAMBLE_DURATION}
            />
          </div>
          <div
            className={`segments segments--${statusFilter}`}
            style={{ "--active-index": activeIndex } as CSSProperties}
            role="radiogroup"
            aria-label={t("filter.status_label")}
          >
            <div className="segments-indicator" aria-hidden="true" />
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                className="segment"
                onClick={() => onStatusChange(s)}
                role="radio"
                aria-checked={statusFilter === s}
                tabIndex={open ? 0 : -1}
              >
                <span className="segment-label">
                  <ScrambleText
                    text={statusLabel(s)}
                    duration={SCRAMBLE_DURATION}
                  />
                </span>
                <span className="segment-count">{statusCounts[s]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-label">
            <ScrambleText
              text={t("filter.tags_label")}
              duration={SCRAMBLE_DURATION}
            />
          </div>
          <div
            className="filter-tags"
            role="group"
            aria-label={t("filter.tags_label")}
          >
            {allTags.map((tag) => {
              const isActive = activeTags.has(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  className={`filter-tag${isActive ? " is-active" : ""}`}
                  onClick={() => onToggleTag(tag)}
                  aria-pressed={isActive}
                  tabIndex={open ? 0 : -1}
                >
                  <span className="filter-tag-hash" aria-hidden="true">
                    #
                  </span>
                  <ScrambleText
                    text={t(`tags.${tag}`)}
                    duration={SCRAMBLE_DURATION}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}
