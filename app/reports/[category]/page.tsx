import Link from "next/link";
import { notFound } from "next/navigation";
import { Topbar } from "@/components/topbar";
import { ReportGalleryCard } from "@/components/reports/report-gallery-card";
import { CATEGORY_META, getReportsByCategory } from "@/lib/reports/registry";
import { requireAuthedSupabase } from "@/lib/reports/require-auth";
import type { ReportCategory } from "@/lib/reports/types";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ category: string }>;
};

export default async function ReportCategoryPage({ params }: PageProps) {
  await requireAuthedSupabase();

  const { category } = await params;
  const meta = CATEGORY_META[category as ReportCategory];
  const reports = getReportsByCategory(category);
  if (!meta || reports.length === 0) notFound();

  return (
    <main className="shell">
      <Topbar active="reports" />
      <div className="main">
        <section className="hero-band">
          <div>
            <nav className="breadcrumb muted no-print" aria-label="Breadcrumb">
              <Link href="/reports">Reports</Link> <span aria-hidden="true">/</span> {meta.label}
            </nav>
            <h1>{meta.label}</h1>
            <p className="muted">{meta.description}</p>
          </div>
        </section>

        <div className="metric-grid" aria-label={`${meta.label} list`}>
          {reports.map((report) => (
            <ReportGalleryCard key={report.slug} report={report} />
          ))}
        </div>
      </div>
    </main>
  );
}
