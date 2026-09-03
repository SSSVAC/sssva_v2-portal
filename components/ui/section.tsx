import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

type SectionProps = {
  title: ReactNode;
  /** Row count or similar, shown as a quiet pill beside the title. */
  count?: number | string;
  /** A state worth carrying in the header, e.g. "7 open". */
  badge?: ReactNode;
  /** Controls that belong to THIS section — normally its export menu. */
  actions?: ReactNode;
  /** Adds padding to the body. Leave off when the body is a full-bleed table. */
  padded?: boolean;
  /**
   * Makes this section addressable on its own by printReportSection and
   * exportSectionToImage, so its export menu covers this section rather than
   * the whole report.
   */
  printId?: string;
  children: ReactNode;
};

// The one section primitive. A card whose header carries the title, a count
// and the section's own controls, with the content directly beneath it, so
// a section's controls are unmistakably attached to that section's data.
// The old pattern put a row of five or six export buttons ABOVE a bare
// <h3>, repeated up to six times per report page — around thirty identical
// grey buttons with nothing to say which one exported what.
//
// The <details>/<summary> mechanics below are load-bearing and should not be
// "simplified":
//
//   * lib/export.ts's exportSectionToImage force-opens every
//     `details.report-section:not([open])` before rasterising, so the class
//     name has to stay.
//   * The body is a SIBLING of <details>, not a child. Chromium renders a
//     closed <details>'s children through an internal ::details-content box
//     whose content-visibility an author rule on a descendant cannot
//     override — nesting the body there made every section render as a
//     title with nothing under it.
//   * Desktop ignores open/closed entirely (see globals.css); only the
//     <=960px rule hides a body, so collapsing needs no JavaScript.
export function Section({
  title,
  count,
  badge,
  actions,
  padded = false,
  printId,
  children
}: SectionProps) {
  return (
    <section className="section" data-print-id={printId}>
      <div className="section-head">
        <details className="report-section">
          <summary className="report-section-summary">
            <h3 className="section-title">{title}</h3>
            {count !== undefined && <span className="section-count">{count}</span>}
            {badge}
            <span className="section-chevron" aria-hidden="true">
              <ChevronDown size={15} />
            </span>
          </summary>
        </details>
        {actions && <div className="section-actions no-print">{actions}</div>}
      </div>
      <div className={`section-body${padded ? " section-body-pad" : ""}`}>{children}</div>
    </section>
  );
}
