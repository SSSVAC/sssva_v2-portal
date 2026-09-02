import type { ReactNode } from "react";

type ReportToolbarProps = {
  /** Filters — month/year selects, "show all members" toggles. */
  children?: ReactNode;
  /** Report-level controls, normally the whole-report export menu. */
  actions?: ReactNode;
};

// One strip, directly under the page header, holding every filter a report
// has plus its whole-report export. Filters used to be ad-hoc .filter-banner
// divs dropped between sections, so on a report with two of them you had to
// scroll past a table to discover the second control.
export function ReportToolbar({ children, actions }: ReportToolbarProps) {
  return (
    <div className="filter-bar no-print">
      {children}
      {actions && <div className="filter-spacer" style={{ display: "flex", gap: 8 }}>{actions}</div>}
    </div>
  );
}

type FilterFieldProps = {
  label: string;
  children: ReactNode;
};

export function FilterField({ label, children }: FilterFieldProps) {
  return (
    <div className="filter-group">
      <span>{label}</span>
      {children}
    </div>
  );
}
