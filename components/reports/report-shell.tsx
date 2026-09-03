import type { ReactNode } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { CATEGORY_META } from "@/lib/reports/registry";
import { CATEGORY_ACCENT, CATEGORY_ACCENT_SOFT } from "@/lib/nav";
import type { ReportCategory } from "@/lib/reports/types";

type ReportShellProps = {
  category: ReportCategory;
  slug: string;
  title: string;
  description: string;
  /** Page-level controls — the Share button. Exports live per section. */
  actions?: ReactNode;
  children: ReactNode;
};

// A report page now has exactly one <h1> — its own title — instead of the
// old arrangement, where the page had no <h1> at all and the title was an
// <h2> nested inside a bordered card under a breadcrumb. That single change
// is most of why report pages had no readable top-level hierarchy.
//
// data-print-id wraps the header as well as the body, so a PNG export
// carries the report's title and description. The export filter drops
// .no-print, which is what keeps the action buttons out of the image.
export function ReportShell({
  category,
  slug,
  title,
  description,
  actions,
  children
}: ReportShellProps) {
  const meta = CATEGORY_META[category];

  return (
    <div data-print-id={slug}>
      <PageHeader
        title={title}
        description={description}
        actions={actions}
        eyebrow={
          <span
            className="cat-chip"
            style={{
              ["--cat" as string]: CATEGORY_ACCENT[category],
              ["--cat-soft" as string]: CATEGORY_ACCENT_SOFT[category]
            }}
          >
            {meta.short}
          </span>
        }
      />
      <div className="stack">{children}</div>
    </div>
  );
}
