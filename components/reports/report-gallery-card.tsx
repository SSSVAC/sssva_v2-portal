import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CATEGORY_META } from "@/lib/reports/registry";
import { CATEGORY_ACCENT } from "@/lib/nav";
import type { ReportDefinition } from "@/lib/reports/types";

type ReportGalleryCardProps = {
  report: ReportDefinition;
  /** Hide the family name when the card already sits under that heading. */
  showCategory?: boolean;
};

// A navigation card, styled as one. It used to reuse the stat-tile markup,
// so the most prominent thing on a link to a report was a large number that
// meant nothing — the count of reports in its family.
export function ReportGalleryCard({ report, showCategory = false }: ReportGalleryCardProps) {
  return (
    <Link
      href={`/reports/${report.category}/${report.slug}`}
      className="gallery-card"
      style={{ ["--cat" as string]: CATEGORY_ACCENT[report.category] }}
    >
      <div className="gallery-card-head">
        <span className="gallery-card-title">{report.title}</span>
        <ArrowRight size={15} className="gallery-card-arrow" />
      </div>
      <div className="gallery-card-summary">{report.summary}</div>
      {showCategory && (
        <div className="gallery-card-meta">{CATEGORY_META[report.category].short}</div>
      )}
    </Link>
  );
}
