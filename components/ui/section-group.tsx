import type { ReactNode } from "react";

type SectionGroupProps = {
  title: string;
  description?: ReactNode;
  /** Controls covering every section in the group — e.g. "export all streets". */
  actions?: ReactNode;
  children: ReactNode;
};

// A band of related sections under one <h2>, so a report reads
// h1 (report) > h2 (group) > h3 (section) instead of a flat run of
// same-weight headings with no way to tell a street apart from a top-level
// part of the report.
export function SectionGroup({ title, description, actions, children }: SectionGroupProps) {
  return (
    <section>
      <div className="section-group-head">
        <h2>{title}</h2>
        {description && <span className="muted">{description}</span>}
        {actions && <div className="section-group-actions no-print">{actions}</div>}
      </div>
      <div className="section-group-body">{children}</div>
    </section>
  );
}
