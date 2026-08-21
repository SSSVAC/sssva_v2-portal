import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarClock, CircleDollarSign, FileText, RefreshCw } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { DashboardCharts } from "@/components/dashboard-charts";
import { SyncForm } from "@/components/sync-form";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/format";
import { CATEGORY_META, CATEGORY_ORDER, getReportsByCategory } from "@/lib/reports/registry";
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
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: recentInvoices }, { data: allInvoiceStats }, { data: monthlyRevenue }, { data: syncRuns }, customers, contributions] =
    await Promise.all([
      supabase
        .from("zoho_invoices")
        .select("*")
        .order("date", { ascending: false })
        .limit(10)
        .returns<InvoiceRow[]>(),
      // Unlimited, narrow select — drives the metric cards and status
      // chart off every invoice instead of just the 10 shown below, which
      // previously made Revenue/Outstanding/Invoices read like recent-only
      // numbers without saying so.
      supabase.from("zoho_invoices").select("total, balance, status").returns<InvoiceStats[]>(),
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
  const latestSync = syncRuns?.[0];

  const memberRows = buildMemberRows(customers, contributions);
  const silaiFundStatus = [
    { status: "not_paid", label: "Not Paid", count: memberRows.filter((member) => member.status === "not_paid").length },
    {
      status: "partially_paid",
      label: "Partially Paid",
      count: memberRows.filter((member) => member.status === "partially_paid").length
    },
    { status: "fully_paid", label: "Fully Paid", count: memberRows.filter((member) => member.status === "fully_paid").length }
  ];

  return (
    <main className="shell">
      <Topbar active="dashboard" />

      <div className="main">
        <section className="hero-band">
          <div>
            <h1>Finance Dashboard</h1>
            <p className="muted">
              Invoices, revenue, and sync health from Zoho Books into Supabase.
            </p>
          </div>

          <div className="hero-actions">
            <SyncForm />
          </div>
        </section>

        {syncError && (
          <div className="error-box" role="alert">
            Zoho sync failed: {syncError}
          </div>
        )}

        <section className="metric-grid" aria-label="Financial metrics">
          <MetricCard
            icon={<CircleDollarSign size={20} />}
            label="Revenue"
            value={formatCurrency(totalRevenue)}
            detail="All invoices, all time"
          />
          <MetricCard
            icon={<FileText size={20} />}
            label="Invoices"
            value={String(safeInvoiceStats.length)}
            detail="Total invoice records"
          />
          <MetricCard
            icon={<CalendarClock size={20} />}
            label="Outstanding"
            value={formatCurrency(outstanding)}
            detail={`${overdue} overdue invoices`}
          />
          <MetricCard
            icon={<RefreshCw size={20} />}
            label="Last Sync"
            value={latestSync ? latestSync.status : "Pending"}
            detail={
              latestSync?.finished_at
                ? formatDate(latestSync.finished_at)
                : "No completed sync yet"
            }
          />
        </section>

        <section className="chart-grid" aria-label="Dashboard charts">
          <DashboardCharts
            monthlyRevenue={(monthlyRevenue ?? []).map((item) => ({
              month: item.month ?? "",
              revenue: Number(item.revenue ?? 0)
            }))}
            invoiceStatus={buildStatusCounts(safeInvoiceStats)}
            silaiFundStatus={silaiFundStatus}
          />
        </section>

        <section className="table-panel">
          <div className="panel-head">
            <h2>Recent Invoices</h2>
            <span className="muted">{safeRecentInvoices.length} shown</span>
          </div>

          {safeRecentInvoices.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {safeRecentInvoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>{invoice.invoice_number ?? invoice.zoho_invoice_id}</td>
                    <td>{invoice.customer_name ?? "Unknown"}</td>
                    <td>
                      <span className={`status-pill ${statusClass(invoice.status)}`}>
                        {invoice.status}
                      </span>
                    </td>
                    <td>{formatCurrency(Number(invoice.total))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <p>Run the Zoho sync after adding your environment variables.</p>
            </div>
          )}
        </section>

        <section aria-labelledby="dashboard-reports-heading">
          <div className="panel-head">
            <h2 id="dashboard-reports-heading">Reports</h2>
            <Link href="/reports" className="muted">
              View all →
            </Link>
          </div>

          <div className="metric-grid">
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
        </section>
      </div>
    </main>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="metric-card">
      <div className="metric-head">
        <span>{label}</span>
        {icon}
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-sub">{detail}</div>
    </article>
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
