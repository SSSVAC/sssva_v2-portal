import Link from "next/link";
import { ArrowRight, HandCoins, Landmark, PiggyBank, Users } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { IncomeSpendingChart, SilaiStatusChart } from "@/components/dashboard-charts";
import { SyncForm } from "@/components/sync-form";
import { requireStaffViewer, viewerChrome } from "@/lib/auth/viewer";
import { formatCurrency, formatDate, formatDateOnly } from "@/lib/format";
import { CATEGORY_META, CATEGORY_ORDER, getReportsByCategory } from "@/lib/reports/registry";
import { CATEGORY_ACCENT } from "@/lib/nav";
import { getAllCustomers, getLastNMonths } from "@/lib/reports/shared-queries";
import { buildMemberRows, fetchContributions } from "@/lib/reports/definitions/silai/member-rows";
import { buildMonthlyContributionRows, summariseMonth } from "@/lib/reports/monthly-contributions";
import { FUND_MINIMUM_AMOUNT, MONTHLY_CONTRIBUTION_MINIMUM } from "@/lib/reports/constants";
import { buildIncomeMix, buildMonthlyFlow, categorizeIncome } from "@/lib/dashboard";
import type { Database } from "@/types/database";

export const dynamic = "force-dynamic";

type InvoiceRow = Database["public"]["Tables"]["zoho_invoices"]["Row"];
type IncomeInvoice = Pick<InvoiceRow, "customer_id" | "customer_name" | "date" | "total" | "item_name">;
type AmountRow = { date: string | null; total: number | null };
type SyncRunRow = Database["public"]["Tables"]["sync_runs"]["Row"];

const TREND_MONTHS = 12;

type DashboardPageProps = {
  searchParams: Promise<{ sync_error?: string }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { sync_error: syncError } = await searchParams;
  const viewer = await requireStaffViewer();
  const supabase = viewer.supabase;

  const months = getLastNMonths(TREND_MONTHS).map((month) => ({
    ...month,
    short: month.label.split(" ")[0]
  }));
  const monthKeys = months.map((month) => month.key);
  const thisMonth = monthKeys[monthKeys.length - 1];
  const rangeStart = `${monthKeys[0]}-01`;

  const [
    { data: recentInvoices },
    { data: incomeInvoices },
    { data: expenses },
    { data: bills },
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
    // A year of money in: drives the trend, the source breakdown and the
    // member dues for this month, so one narrow query serves all three.
    supabase
      .from("zoho_invoices")
      .select("customer_id, customer_name, date, total, item_name")
      .is("archived_at", null)
      .gte("date", rangeStart)
      .returns<IncomeInvoice[]>(),
    supabase
      .from("zoho_expenses")
      .select("date, total")
      .is("archived_at", null)
      .gte("date", rangeStart)
      .returns<AmountRow[]>(),
    supabase
      .from("zoho_bills")
      .select("date, total")
      .is("archived_at", null)
      .gte("date", rangeStart)
      .returns<AmountRow[]>(),
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
  const safeIncome = incomeInvoices ?? [];
  const latestSync = syncRuns?.[0];

  const flow = buildMonthlyFlow(monthKeys, safeIncome, [...(expenses ?? []), ...(bills ?? [])]);
  const current = flow[flow.length - 1];
  const previous = flow[flow.length - 2];
  const net = current.income - current.spending;
  const incomeChange = current.income - previous.income;
  const incomeMix = buildIncomeMix(safeIncome, new Set(monthKeys));
  const mixTotal = incomeMix.reduce((sum, entry) => sum + entry.total, 0);

  // Monthly dues: who has settled this month's minimum, who is short, who
  // hasn't paid — the same figures the Monthly Fixed Contributions report uses.
  const dues = summariseMonth(
    buildMonthlyContributionRows({
      customers,
      invoices: safeIncome.filter((invoice) => categorizeIncome(invoice.item_name) === "donations"),
      months,
      minimum: MONTHLY_CONTRIBUTION_MINIMUM
    }),
    thisMonth,
    MONTHLY_CONTRIBUTION_MINIMUM
  );
  const memberCount = dues.full.length + dues.partial.length + dues.none.length;

  const memberRows = buildMemberRows(customers, contributions);
  const silaiRaised = memberRows.reduce((sum, member) => sum + Math.min(member.paid, FUND_MINIMUM_AMOUNT), 0);
  const silaiTarget = memberRows.length * FUND_MINIMUM_AMOUNT;
  const silaiPct = silaiTarget > 0 ? Math.round((silaiRaised / silaiTarget) * 100) : 0;
  const silaiFundStatus = [
    { status: "not_paid", label: "Not Paid" },
    { status: "partially_paid", label: "Partially Paid" },
    { status: "fully_paid", label: "Fully Paid" }
  ].map((entry) => ({
    ...entry,
    count: memberRows.filter((member) => member.status === entry.status).length
  }));

  const monthName = months[months.length - 1].label;
  const lastMonthName = months[months.length - 2].short;
  const syncState =
    latestSync?.status === "succeeded" ? "ok" : latestSync?.status === "failed" ? "failed" : "running";

  return (
    <AppShell viewer={viewerChrome(viewer)} crumbs={[{ label: "Overview" }]}>
      <PageHeader
        title="Overview"
        description={`Money in and out for ${monthName}, member dues and the Silai fund, from Zoho Books.`}
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
            the last successful run. */}
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

        <section className="metric-grid" aria-label={`Key figures for ${monthName}`}>
          <article className="metric-card" data-emphasis="lead">
            <div className="metric-head">
              <span>Income · {monthName}</span>
              <HandCoins size={16} />
            </div>
            <div className="metric-value">{formatCurrency(current.income)}</div>
            <div className="metric-sub">
              {incomeChange === 0
                ? `Same as ${lastMonthName}`
                : `${incomeChange > 0 ? "Up" : "Down"} ${formatCurrency(Math.abs(incomeChange))} on ${lastMonthName}`}
            </div>
          </article>

          <article className="metric-card">
            <div className="metric-head">
              <span>Spending · {monthName}</span>
              <Landmark size={16} />
            </div>
            <div className="metric-value">{formatCurrency(current.spending)}</div>
            <div className="metric-sub">
              Expenses and bills · {lastMonthName} {formatCurrency(previous.spending)}
            </div>
          </article>

          <article className="metric-card" data-state={net >= 0 ? "positive" : "critical"}>
            <div className="metric-head">
              <span>Net this month</span>
              <PiggyBank size={16} />
            </div>
            <div className="metric-value">{formatCurrency(net)}</div>
            <div className="metric-sub">{net >= 0 ? "Income covers spending" : "Spending is ahead of income"}</div>
          </article>

          <article
            className="metric-card"
            data-state={memberCount > 0 && dues.none.length === 0 && dues.partial.length === 0 ? "positive" : undefined}
          >
            <div className="metric-head">
              <span>Monthly dues</span>
              <Users size={16} />
            </div>
            <div className="metric-value">
              {dues.full.length}
              <span className="muted"> / {memberCount}</span>
            </div>
            <div className="metric-sub">
              {dues.partial.length} short · {dues.none.length} unpaid
            </div>
          </article>
        </section>

        <div className="dashboard-grid">
          <section className="panel">
            <div className="panel-head">
              <h2>Income vs spending</h2>
              <span className="muted">Last {TREND_MONTHS} months</span>
            </div>
            <IncomeSpendingChart data={flow} />
          </section>

          <div className="dashboard-side">
            <section className="panel">
              <div className="panel-head">
                <h2>Income by source</h2>
                <span className="muted">Last {TREND_MONTHS} months</span>
              </div>
              {incomeMix.length > 0 ? (
                <ul className="stack" style={{ listStyle: "none", margin: 0, padding: "4px 16px 16px", gap: 12 }}>
                  {incomeMix.map((entry) => (
                    <li key={entry.category}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13 }}>
                        <span>{entry.label}</span>
                        <span className="muted">
                          {formatCurrency(entry.total)} · {Math.round((entry.total / mixTotal) * 100)}%
                        </span>
                      </div>
                      <div className="progress-track" style={{ marginTop: 6 }}>
                        <div className="progress-fill" style={{ width: `${(entry.total / mixTotal) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty-state">
                  <p>No income recorded in this period.</p>
                </div>
              )}
            </section>

            <section className="panel">
              <div className="panel-head">
                <h2>Silai fund</h2>
                <span className="muted">
                  {formatCurrency(silaiRaised)} of {formatCurrency(silaiTarget)} · {silaiPct}%
                </span>
              </div>
              <SilaiStatusChart data={silaiFundStatus} />
            </section>
          </div>
        </div>

        <section className="panel">
          <div className="panel-head">
            <h2>Recent receipts</h2>
            <Link href="/records?tab=invoices" className="btn btn-ghost btn-sm">
              View all
              <ArrowRight size={14} />
            </Link>
          </div>

          {safeRecentInvoices.length > 0 ? (
            <div className="table-wrap">
              <table className="data-table data-table-cards data-table-compact">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Received from</th>
                    <th>For</th>
                    <th className="num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {safeRecentInvoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td data-label="Date">{invoice.date ? formatDateOnly(invoice.date) : "—"}</td>
                      <td data-label="Received from" data-card-label="hidden">
                        {invoice.customer_name ?? "Unknown"}
                      </td>
                      <td data-label="For">{invoice.item_name ?? "—"}</td>
                      <td data-label="Amount" className="num">
                        {formatCurrency(Number(invoice.total))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <p>No receipts yet. Run the Zoho sync after adding your environment variables.</p>
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
