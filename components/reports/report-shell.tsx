import Link from "next/link";
import type { ReactNode } from "react";
import { CATEGORY_META } from "@/lib/reports/registry";
import type { ReportCategory } from "@/lib/reports/types";

type ReportShellProps = {
  category: ReportCategory;
  slug: string;
  title: string;
  description: string;
  children: ReactNode;
};

export function ReportShell({ category, slug, title, description, children }: ReportShellProps) {
  const categoryMeta = CATEGORY_META[category];

  return (
    <section className="report-card" aria-labelledby={`${slug}-report-heading`} data-print-id={slug}>
      <nav className="breadcrumb muted no-print" aria-label="Breadcrumb">
        <Link href="/reports">Reports</Link> <span aria-hidden="true">/</span>{" "}
        <Link href={`/reports/${category}`}>{categoryMeta.label}</Link> <span aria-hidden="true">/</span> {title}
      </nav>

      <div className="report-card-head">
        <h2 id={`${slug}-report-heading`}>{title}</h2>
        <span className="muted">{description}</span>
      </div>

      {children}
    </section>
  );
}
