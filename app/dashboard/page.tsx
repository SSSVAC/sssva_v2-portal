import { redirect } from "next/navigation";
import { CalendarClock, CircleDollarSign, FileText, RefreshCw } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { DashboardCharts } from "@/components/dashboard-charts";
import { SyncForm } from "@/components/sync-form";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Database } from "@/types/database";

export const dynamic = "force-dynamic";

type InvoiceRow = Database["public"]["Tables"]["zoho_invoices"]["Row"];
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

  const [{ data: invoices }, { data: monthlyRevenue }, { data: syncRuns }] =
    await Promise.all([
      supabase
        .from("zoho_invoices")
        .select("*")
        .order("date", { ascending: false })
        .limit(10)
        .returns<InvoiceRow[]>(),
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
        .returns<SyncRunRow[]>()
    ]);

  const safeInvoices = invoices ?? [];
  const totalRevenue = safeInvoices.reduce((sum, invoice) => sum + Number(invoice.total), 0);
  const outstanding = safeInvoices.reduce((sum, invoice) => sum + Number(invoice.balance), 0);
  const overdue = safeInvoices.filter((invoice) => invoice.status === "overdue").length;
  const latestSync = syncRuns?.[0];

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
            detail="From recent synced invoices"
          />
          <MetricCard
            icon={<FileText size={20} />}
            label="Invoices"
            value={String(safeInvoices.length)}
            detail="Latest invoice records"
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

        <section className="dashboard-grid">
          <div className="chart-panel">
            <div className="panel-head">
              <h2>Revenue Trend</h2>
              <span className="muted">Monthly</span>
            </div>
            <DashboardCharts
              monthlyRevenue={(monthlyRevenue ?? []).map((item) => ({
                month: item.month ?? "",
                revenue: Number(item.revenue ?? 0)
              }))}
              invoiceStatus={buildStatusCounts(safeInvoices)}
            />
          </div>

          <div className="table-panel">
            <div className="panel-head">
              <h2>Recent Invoices</h2>
              <span className="muted">{safeInvoices.length} shown</span>
            </div>

            {safeInvoices.length > 0 ? (
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
                  {safeInvoices.map((invoice) => (
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
