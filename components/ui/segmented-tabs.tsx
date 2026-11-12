"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";

export type SegmentedTab<T extends string> = {
  id: T;
  label: ReactNode;
  /** Optional figure shown in a small badge after the label. */
  count?: ReactNode;
  /** Tooltip for the badge, e.g. why a count is unknown. */
  countTitle?: string;
};

type SegmentedTabsProps<T extends string> = {
  tabs: readonly SegmentedTab<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  className?: string;
};

// The one segmented tab strip. Three screens used to hand-roll the same
// buttons with role="tab", which announced tabs to a screen reader but
// behaved like a row of separate buttons: every segment was its own Tab
// stop and the arrow keys did nothing.
//
// This follows the WAI-ARIA tabs pattern with automatic activation: only the
// selected tab is in the Tab order, and Left/Right/Home/End move between
// tabs and select as they go. Switching is instant in every caller (all
// data is already on the client), so selecting on focus costs nothing.
export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  className
}: SegmentedTabsProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = tabs.length - 1;
    const next =
      event.key === "ArrowRight"
        ? index === last
          ? 0
          : index + 1
        : event.key === "ArrowLeft"
          ? index === 0
            ? last
            : index - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (next === null) return;

    event.preventDefault();
    refs.current[next]?.focus();
    onChange(tabs[next].id);
  }

  return (
    <div className={`segmented${className ? ` ${className}` : ""}`} role="tablist" aria-label={label}>
      {tabs.map((tab, index) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className={`segment${selected ? " segment-active" : ""}`}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="segment-count" title={tab.countTitle}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
