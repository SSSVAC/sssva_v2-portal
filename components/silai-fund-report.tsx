"use client";

import { formatCurrency, formatDateOnly } from "@/lib/format";
import { ExportToolbar } from "@/components/export-toolbar";
import {
  exportToCsv,
  exportToHtml,
  exportSectionsToCsv,
  exportSectionsToHtml,
  printReportSection,
  type ExportSection
} from "@/lib/export";

export type SilaiContributionRow = {
  donorName: string | null;
  date: string | null;
  total: number;
};

export type SilaiExpenseRow = {
  id: string;
  itemName: string | null;
  date: string | null;
  total: number;
};

export type SilaiBillRow = {
  id: string;
  number: string | null;
  vendorName: string | null;
  date: string | null;
  total: number;
};

type SilaiFundReportProps = {
  contributionRows: SilaiContributionRow[];
  expenseRows: SilaiExpenseRow[];
  billRows: SilaiBillRow[];
};

function sumTotals<T extends { total: number }>(rows: T[]) {
  return rows.reduce((sum, row) => sum + row.total, 0);
}

const PRINT_TARGET = "silai-fund";

export function SilaiFundReport({ contributionRows, expenseRows, billRows }: SilaiFundReportProps) {
  const totalContributions = sumTotals(contributionRows);
  const totalExpenses = sumTotals(expenseRows);
  const totalBills = sumTotals(billRows);
  const totalSpent = totalExpenses + totalBills;
  const balance = totalContributions - totalSpent;

  const exportPdf = () => printReportSection(PRINT_TARGET);

  const metricsExportHeaders = ["Metric", "Value"];
  const metricsExportRows = () => [
    ["Total Contributions", formatCurrency(totalContributions)],
    ["Total Spent", formatCurrency(totalSpent)],
    ["Balance", formatCurrency(balance)],
    ["Expenses", formatCurrency(totalExpenses)],
    ["Bills", formatCurrency(totalBills)]
  ];

  const contributionExportHeaders = ["Donor", "Date", "Amount"];
  const contributionExportRows = () => [
    ...contributionRows.map((row) => [row.donorName ?? "", row.date ? formatDateOnly(row.date) : "", formatCurrency(row.total)]),
    ["Total", "", formatCurrency(totalContributions)]
  ];

  const expenseExportHeaders = ["Item", "Date", "Amount"];
  const expenseExportRows = () => [
    ...expenseRows.map((row) => [row.itemName ?? "", row.date ? formatDateOnly(row.date) : "", formatCurrency(row.total)]),
    ["Total", "", formatCurrency(totalExpenses)]
  ];

  const billExportHeaders = ["Bill #", "Vendor", "Date", "Amount"];
  const billExportRows = () => [
    ...billRows.map((row) => [row.number ?? "", row.vendorName ?? "", row.date ? formatDateOnly(row.date) : "", formatCurrency(row.total)]),
    ["Total", "", "", formatCurrency(totalBills)]
  ];

  const fullReportSections = (): ExportSection[] => [
    { title: "Metrics", headers: metricsExportHeaders, rows: metricsExportRows() },
    { title: "Contributions", headers: contributionExportHeaders, rows: contributionExportRows() },
    { title: "Expenses", headers: expenseExportHeaders, rows: expenseExportRows() },
    { title: "Bills", headers: billExportHeaders, rows: billExportRows() }
  ];

  return (
    <div>
      <ExportToolbar
        onExportCsv={() => exportSectionsToCsv("silai-fund-report.csv", fullReportSections())}
        onExportHtml={() => exportSectionsToHtml("silai-fund-report.html", "Silai Fund Report", fullReportSections())}
        onExportPdf={exportPdf}
      />

      <div className="metric-grid" aria-label="Silai fund summary">
        <article className="metric-card">
          <div className="metric-head">
            <span>Total Contributions</span>
          </div>
          <div className="metric-value">{formatCurrency(totalContributions)}</div>
          <div className="metric-sub">சிலை வைப்பதற்கான நிதி — all time</div>
        </article>
        <article className="metric-card">
          <div className="metric-head">
            <span>Total Spent</span>
          </div>
          <div className="metric-value">{formatCurrency(totalSpent)}</div>
          <div className="metric-sub">Expenses + Bills</div>
        </article>
        <article className="metric-card">
          <div className="metric-head">
            <span>Balance</span>
          </div>
          <div className="metric-value">{formatCurrency(balance)}</div>
          <div className="metric-sub">Contributions minus spent</div>
        </article>
        <article className="metric-card">
          <div className="metric-head">
            <span>Expenses</span>
          </div>
          <div className="metric-value">{formatCurrency(totalExpenses)}</div>
        </article>
        <article className="metric-card">
          <div className="metric-head">
            <span>Bills</span>
          </div>
          <div className="metric-value">{formatCurrency(totalBills)}</div>
        </article>
      </div>

      <h3>Contributions</h3>
      <ExportToolbar
        onExportCsv={() => exportToCsv("silai-fund-contributions.csv", contributionExportHeaders, contributionExportRows())}
        onExportHtml={() =>
          exportToHtml("silai-fund-contributions.html", "Silai Fund — Contributions", contributionExportHeaders, contributionExportRows())
        }
        onExportPdf={exportPdf}
      />
      {contributionRows.length > 0 ? (
        <div className="table-panel" style={{ minWidth: 0, overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Donor</th>
                <th>Date</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {contributionRows.map((row, index) => (
                <tr key={`${row.donorName ?? "unknown"}-${row.date ?? "unknown"}-${index}`}>
                  <td>{row.donorName ?? "—"}</td>
                  <td>{row.date ? formatDateOnly(row.date) : "—"}</td>
                  <td>{formatCurrency(row.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>Total Contributions</td>
                <td>{formatCurrency(totalContributions)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <p>No contributions recorded.</p>
        </div>
      )}

      <h3>Expenses</h3>
      <ExportToolbar
        onExportCsv={() => exportToCsv("silai-fund-expenses.csv", expenseExportHeaders, expenseExportRows())}
        onExportHtml={() => exportToHtml("silai-fund-expenses.html", "Silai Fund — Expenses", expenseExportHeaders, expenseExportRows())}
        onExportPdf={exportPdf}
      />
      {expenseRows.length > 0 ? (
        <div className="table-panel" style={{ minWidth: 0, overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Date</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {expenseRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.itemName ?? "—"}</td>
                  <td>{row.date ? formatDateOnly(row.date) : "—"}</td>
                  <td>{formatCurrency(row.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>Total Expenses</td>
                <td>{formatCurrency(totalExpenses)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <p>No expenses recorded.</p>
        </div>
      )}

      <h3>Bills</h3>
      <ExportToolbar
        onExportCsv={() => exportToCsv("silai-fund-bills.csv", billExportHeaders, billExportRows())}
        onExportHtml={() => exportToHtml("silai-fund-bills.html", "Silai Fund — Bills", billExportHeaders, billExportRows())}
        onExportPdf={exportPdf}
      />
      {billRows.length > 0 ? (
        <div className="table-panel" style={{ minWidth: 0, overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Bill #</th>
                <th>Vendor</th>
                <th>Date</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {billRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.number ?? "—"}</td>
                  <td>{row.vendorName ?? "—"}</td>
                  <td>{row.date ? formatDateOnly(row.date) : "—"}</td>
                  <td>{formatCurrency(row.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>Total Bills</td>
                <td>{formatCurrency(totalBills)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <p>No bills recorded.</p>
        </div>
      )}
    </div>
  );
}
