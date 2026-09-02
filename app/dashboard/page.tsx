import Link from "next/link";
import { ArrowRight, CircleDollarSign, FileText, Wallet } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import {
  InvoiceStatusChart,
  RevenueTrendChart,
  SilaiStatusChart
} from "@/components/dashboard-charts";
import { SyncForm } from "@/components/sync-form";
import { requireStaffViewer, viewerChrome } from "@/lib/auth/viewer";
import { formatCurrency, formatDate } from "@/lib/format";
import { CATEGORY_META, CATEGORY_ORDER, getReportsByCategory } from "@/lib/reports/registry";
import { CATEGORY_ACCENT } from "@/lib/nav";
import { getAllCustomers } from "@/lib/reports/shared-queries";
import { buildMemberRows, fetchContributions } from "@/lib/reports/definitions/silai/member-rows";
import type { Database } from "@/types/database";

export const dynamic = "force-dynamic";

type InvoiceRow = Database["public"]["Tables"]["zoho_invoices"]["Row"];
type InvoiceStats = Pick<InvoiceRow, "total" | "balance" | "status">;
type MonthlyRevenueRow = Database["public"]["Views"]["dashboard_monthly_revenue"]["Row"];
type SyncRunRow = Database["public"]["Tables"]["sync_runs"]["Row"];

type DashboardPageProps = {
  searchParams: Promise<{ sync_error?: string }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { sync_error: syncError } = await searchParams;
  const viewer = await requireStaffViewer();
  const supabase = viewer.supabase;

  const [
    { data: recentInvoices },
    { data: allInvoiceStats },
    { data: monthlyRevenue },
    { data: syncRuns },
    customers,
    contributions
  ] = await Promise.all([
    supabase
      .from("zoho_invoices")
      .select("*")
      .is("archived_at", null)
      .order("date", { ascending: false })
      .limit(8)
      .returns<InvoiceRow[]>(),
    // Unlimited, narrow select — drives the stat tiles and status chart off
    // every invoice instead of just the handful shown below.
    supabase
      .from("zoho_invoices")
      .select("total, balance, status")
      .is("archived_at", null)
      .returns<InvoiceStats[]>(),
    supabase
      .from("dashboard_monthly_revenue")
      .select("*")
      .order("month", { ascending: true })
      .limit(12)
      .returns<MonthlyRevenueRow[]>(),
    supabase
      .from("sync_runs")
      .select("*")
      .eq("provider", "zoho_books")
      .order("started_at", { ascending: false })
      .limit(1)
      .returns<SyncRunRow[]>(),
    getAllCustomers(supabase),
    fetchContributions(supabase)
  ]);

  const safeRecentInvoices = recentInvoices ?? [];
  const safeInvoiceStats = allInvoiceStats ?? [];
  const totalRevenue = safeInvoiceStats.reduce((sum, invoice) => sum + Number(invoice.total), 0);
  const outstanding = safeInvoiceStats.reduce((sum, invoice) => sum + Number(invoice.balance), 0);
  const overdue = safeInvoiceStats.filter((invoice) => invoice.status === "overdue").length;
  const collected = totalRevenue - outstanding;
  const collectedPct = totalRevenue > 0 ? Math.round((collected / totalRevenue) * 100) : 0;
  const latestSync = syncRuns?.[0];

  const memberRows = buildMemberRows(customers, contributions);
  const silaiFundStatus = [
    {
      status: "not_paid",
      label: "Not Paid",
      count: memberRows.filter((member) => member.status === "not_paid").length
    },
    {
      status: "partially_paid",
      label: "Partially Paid",
      count: memberRows.filter((member) => member.status === "partially_paid").length
    },
    {
      status: "fully_paid",
      label: "Fully Paid",
      count: memberRows.filter((member) => member.status === "fully_paid").length
    }
  ];

  const syncState =
    latestSync?.status === "succeeded" ? "ok" : latestSync?.status === "failed" ? "failed" : "running";

  return (
    <AppShell viewer={viewerChrome(viewer)} crumbs={[{ label: "Overview" }]}>
      <PageHeader
        title="Overview"
        description="Invoices, revenue and collection health across every record synced from Zoho Books."
        actions={<SyncForm />}
      />

      <div className="stack">
        {syncError && (
          <div className="error-box" role="alert">
            <span>
              <strong>Zoho sync failed.</strong> {syncError}
            </span>
          </div>
        )}

        {/* Sync health leads the page: everything below is only as fresh as
            the last successful run, so it belongs above the numbers rather
            than tucked into the fourth stat tile as it was before. */}
        <div className="status-strip" data-state={syncState}>
          <span className="status-strip-dot" aria-hidden="true" />
          <span>
            <strong>Zoho Books sync</strong>{" "}
            <span className="muted">
              {latestSync
                ? `${latestSync.status} · ${
                    latestSync.finished_at ? formatDate(latestSync.finished_at) : "in progress"
                  }`
                : "no sync has run yet"}
            </span>
          </span>
          <Link href="/records" className="muted" style={{ marginLeft: "auto" }}>
            Browse records →
          </Link>
        </div>

        <section className="metric-grid" aria-label="Key figures">
          <article className="metric-card" data-emphasis="lead">
            <div className="metric-head">
              <span>Total Invoiced</span>
              <CircleDollarSign size={16} />
            </div>
            <div className="metric-value">{formatCurrency(totalRevenue)}</div>
            <div className="metric-sub">All invoices, all time</div>
          </article>

          <article className="metric-card" data-state="positive">
            <div className="metric-head">
              <span>Collected</span>
              <Wallet size={16} />
            </div>
            <div className="metric-value">{formatCurrency(collected)}</div>
            <div className="metric-sub">{collectedPct}% of invoiced</div>
          </article>

          <article className="metric-card" data-state={outstanding > 0 ? "critical" : "positive"}>
            <div className="metric-head">
              <span>Outstanding</span>
            </div>
            <div className="metric-value">{formatCurrency(outstanding)}</div>
            <div className="metric-sub">
              {overdue > 0 ? `${overdue} overdue invoice${overdue === 1 ? "" : "s"}` : "Nothing overdue"}
            </div>
          </article>

          <article className="metric-card">
            <div className="metric-head">
              <span>Invoices</span>
              <FileText size={16} />
            </div>
            <div className="metric-value">{safeInvoiceStats.length}</div>
            <div className="metric-sub">Total invoice records</div>
          </article>
        </section>

        {/* Revenue is the hero; the two status donuts are supporting detail
            and stack beside it, rather than three equal-width charts that
            gave a twelve-month trend the same weight as a five-slice pie. */}
        <div className="dashboard-grid">
          <section className="panel">
            <div className="panel-head">
              <h2>Revenue trend</h2>
              <span className="muted">Last 12 months</span>
            </div>
            <RevenueTrendChart
              data={(monthlyRevenue ?? []).map((item) => ({
                month: item.month ?? "",
                revenue: Number(item.revenue ?? 0)
              }))}
            />
          </section>

          <div className="dashboard-side">
            <section className="panel">
              <div className="panel-head">
                <h2>Invoice status</h2>
                <span className="muted">{safeInvoiceStats.length}</span>
              </div>
              <InvoiceStatusChart data={buildStatusCounts(safeInvoiceStats)} />
            </section>

            <section className="panel">
              <div className="panel-head">
                <h2>Silai fund status</h2>
                <span className="muted">{memberRows.length} members</span>
              </div>
              <SilaiStatusChart data={silaiFundStatus} />
            </section>
          </div>
        </div>

        <section className="panel">
          <div className="panel-head">
            <h2>Recent invoices</h2>
            <Link href="/records?tab=invoices" className="btn btn-ghost btn-sm">
              View all
              <ArrowRight size={14} />
            </Link>
          </div>

          {safeRecentInvoices.length > 0 ? (
            <div className="table-wrap">
              <table className="data-table data-table-cards">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Customer</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {safeRecentInvoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td data-label="Invoice">{invoice.invoice_number ?? invoice.zoho_invoice_id}</td>
                      <td data-label="Customer">{invoice.customer_name ?? "Unknown"}</td>
                      <td data-label="Date">{invoice.date ? formatDate(invoice.date) : "—"}</td>
                      <td data-label="Status">
                        <span className={`status-pill ${statusClass(invoice.status)}`}>
                          {invoice.status}
                        </span>
                      </td>
                      <td data-label="Total" className="num">
                        {formatCurrency(Number(invoice.total))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <p>No invoices yet. Run the Zoho sync after adding your environment variables.</p>
            </div>
          )}
        </section>

        <section aria-labelledby="dashboard-reports-heading">
          <div
            className="panel-head"
            style={{ padding: "0 0 12px", borderBottom: "1px solid var(--border)", marginBottom: 14 }}
          >
            <h2 id="dashboard-reports-heading">Reports</h2>
            <Link href="/reports" className="btn btn-ghost btn-sm">
              All reports
              <ArrowRight size={14} />
            </Link>
          </div>

          <div className="card-grid">
            {CATEGORY_ORDER.map((category) => {
              const meta = CATEGORY_META[category];
              const count = getReportsByCategory(category).length;
              return (
                <Link
                  key={category}
                  href={`/reports/${category}`}
                  className="gallery-card"
                  style={{ ["--cat" as string]: CATEGORY_ACCENT[category] }}
                >
                  <div className="gallery-card-head">
                    <span className="gallery-card-title">{meta.label}</span>
                    <ArrowRight size={15} className="gallery-card-arrow" />
                  </div>
                  <div className="gallery-card-summary">{meta.description}</div>
                  <div className="gallery-card-meta">
                    {count} report{count === 1 ? "" : "s"}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function buildStatusCounts(invoices: { status: string }[]) {
  const counts = invoices.reduce<Record<string, number>>((acc, invoice) => {
    acc[invoice.status] = (acc[invoice.status] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts).map(([status, count]) => ({ status, count }));
}

function statusClass(status: string) {
  if (status === "paid") return "status-paid";
  if (status === "overdue") return "status-overdue";
  return "status-sent";
}
