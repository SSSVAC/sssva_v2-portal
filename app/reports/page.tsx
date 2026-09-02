import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { ReportGalleryCard } from "@/components/reports/report-gallery-card";
import { CATEGORY_META, CATEGORY_ORDER, getReportsByCategory, REPORT_REGISTRY } from "@/lib/reports/registry";
import { CATEGORY_ACCENT, CATEGORY_ACCENT_SOFT } from "@/lib/nav";
import { requireViewer, viewerChrome } from "@/lib/auth/viewer";
import { guestCanSeeReportCategory } from "@/lib/auth/guest-scope";

export const dynamic = "force-dynamic";

export default async function ReportsIndexPage() {
  const viewer = await requireViewer();

  // A guest only ever sees the families on the allowlist, so the count in
  // the description has to describe what's actually on the page.
  const categories = CATEGORY_ORDER.filter(
    (category) => viewer.kind === "staff" || guestCanSeeReportCategory(category)
  );
  const visibleCount = REPORT_REGISTRY.filter((report) =>
    categories.includes(report.category)
  ).length;

  return (
    <AppShell viewer={viewerChrome(viewer)} crumbs={[{ label: "Reports" }]}>
      <PageHeader
        title="Reports"
        description={`${visibleCount} reports across ${categories.length} ${
          categories.length === 1 ? "family" : "families"
        }. Every one exports to CSV, Excel, HTML, PNG or print.`}
      />

      {/* Every report is listed here, grouped under its family — the index
          used to show only three cards whose largest element was a count,
          leaving the reports themselves a further click away with no way to
          see what existed. */}
      <div className="stack">
        {categories.map((category) => {
          const meta = CATEGORY_META[category];
          const reports = getReportsByCategory(category);

          return (
            <section key={category} aria-labelledby={`${category}-heading`}>
              <div
                className="panel-head"
                style={{
                  padding: "0 0 10px",
                  borderBottom: "1px solid var(--border)",
                  marginBottom: 12
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h2 id={`${category}-heading`} style={{ fontSize: "var(--fs-section)" }}>
                    {meta.label}
                  </h2>
                  <span
                    className="cat-chip"
                    style={{
                      ["--cat" as string]: CATEGORY_ACCENT[category],
                      ["--cat-soft" as string]: CATEGORY_ACCENT_SOFT[category]
                    }}
                  >
                    {reports.length}
                  </span>
                </div>
                <span className="muted">{meta.description}</span>
              </div>

              <div className="card-grid">
                {reports.map((report) => (
                  <ReportGalleryCard key={report.slug} report={report} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </AppShell>
  );
}
