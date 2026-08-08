import Link from "next/link";
import type { ReportDefinition } from "@/lib/reports/types";

export function ReportGalleryCard({ report }: { report: ReportDefinition }) {
  return (
    <Link href={`/reports/${report.category}/${report.slug}`} className="metric-card report-gallery-card">
      <div className="metric-head">
        <span>{report.title}</span>
      </div>
      <div className="metric-sub">{report.summary}</div>
    </Link>
  );
}
