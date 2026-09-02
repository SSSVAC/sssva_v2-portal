import type { ReactNode } from "react";

type CollapsibleSectionProps = {
  title: ReactNode;
  children: ReactNode;
};

// Collapsed by default on mobile/tablet (see .report-section in
// globals.css) so a report made of several sections — one per street
// group, say — doesn't force endless scrolling to reach the one you
// want. Desktop always shows every section regardless of the <details>
// open/closed state; only the mobile media query actually hides
// anything, so no JS is needed for the open/close interaction itself —
// clicking <summary> natively toggles it.
//
// The body lives OUTSIDE <details> as a plain sibling, toggled by a
// `.report-section[open] + .report-section-body` CSS selector, rather
// than nested inside it. Chromium renders a closed <details>'s children
// through an internal ::details-content box with its own
// content-visibility that a plain author rule on a child can't override
// — nesting the content there made it invisible on desktop no matter
// what CSS was applied to it. Keeping the content out of <details>
// entirely sidesteps that completely.
export function CollapsibleSection({ title, children }: CollapsibleSectionProps) {
  return (
    <>
      <details className="report-section">
        <summary className="report-section-summary">
          <h3>{title}</h3>
        </summary>
      </details>
      <div className="report-section-body">{children}</div>
    </>
  );
}
