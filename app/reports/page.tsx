import Link from "next/link";
import { Topbar } from "@/components/topbar";
import { CATEGORY_META, CATEGORY_ORDER, getReportsByCategory } from "@/lib/reports/registry";
import { requireAuthedSupabase } from "@/lib/reports/require-auth";

export const dynamic = "force-dynamic";

export default async function ReportsIndexPage() {
  await requireAuthedSupabase();

  return (
    <main className="shell">
      <Topbar active="reports" />

      <div className="main">
        <section className="hero-band">
          <div>
            <h1>Reports</h1>
            <p className="muted">Reports for SSSVA Portal staff.</p>
          </div>
        </section>

        <div className="metric-grid" aria-label="Report categories">
          {CATEGORY_ORDER.map((category) => {
            const meta = CATEGORY_META[category];
            const reportCount = getReportsByCategory(category).length;

            return (
              <Link key={category} href={`/reports/${category}`} className="metric-card report-gallery-card">
                <div className="metric-head">
                  <span>{meta.label}</span>
                </div>
                <div className="metric-value">{reportCount}</div>
                <div className="metric-sub">{meta.description}</div>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
