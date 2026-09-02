import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: ReactNode;
  /** Rendered above the title — a category chip, a status pill, etc. */
  eyebrow?: ReactNode;
  actions?: ReactNode;
};

// Every page gets exactly one <h1>, here. The old layout had three
// different title treatments across the three report routes, and the report
// detail page had no <h1> at all — its title was an <h2> buried inside a
// card, which is why nothing on that page read as the top of a hierarchy.
export function PageHeader({ title, description, eyebrow, actions }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div className="page-header-text">
        {eyebrow && <div style={{ marginBottom: 8 }}>{eyebrow}</div>}
        <div className="page-title-row">
          <h1>{title}</h1>
        </div>
        {description && <p className="page-desc">{description}</p>}
      </div>
      {actions && <div className="page-actions no-print">{actions}</div>}
    </div>
  );
}
