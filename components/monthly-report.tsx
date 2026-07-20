"use client";

import { useMemo, useState } from "react";
import { formatCurrency, formatDateOnly } from "@/lib/format";
import { ExportToolbar } from "@/components/export-toolbar";
import { exportToCsv, exportToHtml, exportSectionsToCsv, exportSectionsToHtml, printReportSection, type ExportSection } from "@/lib/export";
import type { DonationMonth } from "@/components/monthly-donations-report";

export type MonthlyIncomeCategory = "donations" | "archanai" | "abhishegam" | "others";

export type MonthlyIncomeRow = {
  date: string;
  total: number;
  category: MonthlyIncomeCategory;
  customerName: string | null;
};

export type MonthlyExpenseRow = {
  id: string;
  itemName: string | null;
  accountName: string | null;
  date: string | null;
  total: number;
};

export type MonthlyBillRow = {
  id: string;
  number: string | null;
  vendorName: string | null;
  accountName: string | null;
  date: string | null;
  total: number;
};

type MonthlyReportProps = {
  months: DonationMonth[];
  incomeRows: MonthlyIncomeRow[];
  expenseRows: MonthlyExpenseRow[];
  billRows: MonthlyBillRow[];
};

const INCOME_CATEGORY_LABELS: Record<MonthlyIncomeCategory, string> = {
  donations: "Monthly Donations",
  archanai: "Archanai",
  abhishegam: "Abhishegam",
  others: "Others"
};

function sumTotals<T extends { total: number }>(rows: T[]) {
  return rows.reduce((sum, row) => sum + row.total, 0);
}

function buildDonorRowsForCategory(rows: MonthlyIncomeRow[], category: MonthlyIncomeCategory) {
  const totalsByName = new Map<string, number>();

  rows
    .filter((row) => row.category === category)
    .forEach((row) => {
      const name = row.customerName?.trim() || "Unknown";
      totalsByName.set(name, (totalsByName.get(name) ?? 0) + row.total);
    });

  return Array.from(totalsByName.entries())
    .map(([donorName, total]) => ({ donorName, total }))
    .sort((a, b) => a.donorName.localeCompare(b.donorName));
}

export function MonthlyReport({ months, incomeRows, expenseRows, billRows }: MonthlyReportProps) {
  const defaultMonth = months.length > 0 ? months[months.length - 1].key : "";
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);

  const selectedMonthLabel = months.find((month) => month.key === selectedMonth)?.label ?? selectedMonth;

  const monthIncomeRows = useMemo(
    () => incomeRows.filter((row) => row.date.slice(0, 7) === selectedMonth),
    [incomeRows, selectedMonth]
  );
  const monthExpenseRows = useMemo(
    () => expenseRows.filter((row) => (row.date ?? "").slice(0, 7) === selectedMonth),
    [expenseRows, selectedMonth]
  );
  const monthBillRows = useMemo(
    () => billRows.filter((row) => (row.date ?? "").slice(0, 7) === selectedMonth),
    [billRows, selectedMonth]
  );

  const totalDonations = sumTotals(monthIncomeRows.filter((row) => row.category === "donations"));
  const totalArchanai = sumTotals(monthIncomeRows.filter((row) => row.category === "archanai"));
  const totalAbhishegam = sumTotals(monthIncomeRows.filter((row) => row.category === "abhishegam"));
  const totalOthers = sumTotals(monthIncomeRows.filter((row) => row.category === "others"));
  const totalReceived = totalDonations + totalArchanai + totalAbhishegam + totalOthers;

  const totalExpenses = sumTotals(monthExpenseRows);
  const totalBills = sumTotals(monthBillRows);
  const totalSpends = totalExpenses + totalBills;

  const balance = totalReceived - totalSpends;

  const donationDonorRows = useMemo(() => buildDonorRowsForCategory(monthIncomeRows, "donations"), [monthIncomeRows]);
  const othersDonorRows = useMemo(() => buildDonorRowsForCategory(monthIncomeRows, "others"), [monthIncomeRows]);

  const metricsExportHeaders = ["Metric", "Value"];
  const metricsExportRows = () => [
    ["Total Received", formatCurrency(totalReceived)],
    ["Total Spends", formatCurrency(totalSpends)],
    ["Balance", formatCurrency(balance)],
    ["Monthly Donations", formatCurrency(totalDonations)],
    ["Archanai", formatCurrency(totalArchanai)],
    ["Abhishegam", formatCurrency(totalAbhishegam)],
    ["Others", formatCurrency(totalOthers)],
    ["Expenses", formatCurrency(totalExpenses)],
    ["Bills", formatCurrency(totalBills)]
  ];

  const incomeExportHeaders = ["Category", "Amount"];
  const incomeExportRows = () => [
    ["Monthly Donations", formatCurrency(totalDonations)],
    ["Archanai", formatCurrency(totalArchanai)],
    ["Abhishegam", formatCurrency(totalAbhishegam)],
    ["Others", formatCurrency(totalOthers)],
    ["Total Received", formatCurrency(totalReceived)]
  ];

  const donationDonorExportHeaders = ["Donor", "Amount"];
  const donationDonorExportRows = () => [
    ...donationDonorRows.map((row) => [row.donorName, formatCurrency(row.total)]),
    ["Total", formatCurrency(totalDonations)]
  ];

  const othersDonorExportHeaders = ["Donor", "Amount"];
  const othersDonorExportRows = () => [
    ...othersDonorRows.map((row) => [row.donorName, formatCurrency(row.total)]),
    ["Total", formatCurrency(totalOthers)]
  ];

  const expenseExportHeaders = ["Item", "Account", "Date", "Amount"];
  const expenseExportRows = () =>
    monthExpenseRows.map((row) => [
      row.itemName ?? "",
      row.accountName ?? "",
      row.date ? formatDateOnly(row.date) : "",
      formatCurrency(row.total)
    ]);

  const billExportHeaders = ["Bill #", "Vendor", "Account", "Date", "Amount"];
  const billExportRows = () =>
    monthBillRows.map((row) => [
      row.number ?? "",
      row.vendorName ?? "",
      row.accountName ?? "",
      row.date ? formatDateOnly(row.date) : "",
      formatCurrency(row.total)
    ]);

  const exportPdf = () => printReportSection("monthly-report");

  const fullReportTitle = `Monthly Report — ${selectedMonthLabel}`;
  const fullReportSections = (): ExportSection[] => [
    { title: "Metrics", headers: metricsExportHeaders, rows: metricsExportRows() },
    { title: "Income by Category", headers: incomeExportHeaders, rows: incomeExportRows() },
    { title: "Monthly Donations — Donor Detail", headers: donationDonorExportHeaders, rows: donationDonorExportRows() },
    { title: "Others — Detail", headers: othersDonorExportHeaders, rows: othersDonorExportRows() },
    { title: "Expenses", headers: expenseExportHeaders, rows: expenseExportRows() },
    { title: "Bills", headers: billExportHeaders, rows: billExportRows() }
  ];

  return (
    <div>
      <div className="filter-banner no-print">
        <label htmlFor="monthly-report-month">Month</label>
        <select
          id="monthly-report-month"
          className="filter-input"
          style={{ maxWidth: 200 }}
          value={selectedMonth}
          onChange={(event) => setSelectedMonth(event.target.value)}
        >
          {[...months].reverse().map((month) => (
            <option key={month.key} value={month.key}>
              {month.label}
            </option>
          ))}
        </select>
      </div>

      <p className="muted" style={{ marginTop: 0 }}>
        {selectedMonthLabel}
      </p>

      <ExportToolbar
        onExportCsv={() => exportSectionsToCsv(`monthly-report-${selectedMonth}.csv`, fullReportSections())}
        onExportHtml={() => exportSectionsToHtml(`monthly-report-${selectedMonth}.html`, fullReportTitle, fullReportSections())}
        onExportPdf={exportPdf}
      />

      <div className="metric-grid" aria-label="Monthly report summary">
        <article className="metric-card">
          <div className="metric-head">
            <span>Total Received</span>
          </div>
          <div className="metric-value">{formatCurrency(totalReceived)}</div>
          <div className="metric-sub">Donations, Archanai, Abhishegam &amp; Others</div>
        </article>
        <article className="metric-card">
          <div className="metric-head">
            <span>Total Spends</span>
          </div>
          <div className="metric-value">{formatCurrency(totalSpends)}</div>
          <div className="metric-sub">Expenses + Bills</div>
        </article>
        <article className="metric-card">
          <div className="metric-head">
            <span>Balance</span>
          </div>
          <div className="metric-value">{formatCurrency(balance)}</div>
          <div className="metric-sub">Received minus spends</div>
        </article>
        <article className="metric-card">
          <div className="metric-head">
            <span>Monthly Donations</span>
          </div>
          <div className="metric-value">{formatCurrency(totalDonations)}</div>
        </article>
        <article className="metric-card">
          <div className="metric-head">
            <span>Archanai</span>
          </div>
          <div className="metric-value">{formatCurrency(totalArchanai)}</div>
        </article>
        <article className="metric-card">
          <div className="metric-head">
            <span>Abhishegam</span>
          </div>
          <div className="metric-value">{formatCurrency(totalAbhishegam)}</div>
        </article>
        <article className="metric-card">
          <div className="metric-head">
            <span>Others</span>
          </div>
          <div className="metric-value">{formatCurrency(totalOthers)}</div>
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

      <h3>Income</h3>
      <ExportToolbar
        onExportCsv={() => exportToCsv(`monthly-report-income-${selectedMonth}.csv`, incomeExportHeaders, incomeExportRows())}
        onExportHtml={() =>
          exportToHtml(`monthly-report-income-${selectedMonth}.html`, "Monthly Report — Income", incomeExportHeaders, incomeExportRows())
        }
        onExportPdf={exportPdf}
      />
      <div className="table-panel" style={{ minWidth: 0, overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{INCOME_CATEGORY_LABELS.donations}</td>
              <td>{formatCurrency(totalDonations)}</td>
            </tr>
            <tr>
              <td>{INCOME_CATEGORY_LABELS.archanai}</td>
              <td>{formatCurrency(totalArchanai)}</td>
            </tr>
            <tr>
              <td>{INCOME_CATEGORY_LABELS.abhishegam}</td>
              <td>{formatCurrency(totalAbhishegam)}</td>
            </tr>
            <tr>
              <td>{INCOME_CATEGORY_LABELS.others}</td>
              <td>{formatCurrency(totalOthers)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td>Total Received</td>
              <td>{formatCurrency(totalReceived)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <h3>Monthly Donations — Donor Detail</h3>
      <ExportToolbar
        onExportCsv={() =>
          exportToCsv(`monthly-report-donations-${selectedMonth}.csv`, donationDonorExportHeaders, donationDonorExportRows())
        }
        onExportHtml={() =>
          exportToHtml(
            `monthly-report-donations-${selectedMonth}.html`,
            "Monthly Report — Monthly Donations",
            donationDonorExportHeaders,
            donationDonorExportRows()
          )
        }
        onExportPdf={exportPdf}
      />
      {donationDonorRows.length > 0 ? (
        <div className="table-panel" style={{ minWidth: 0, overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Donor</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {donationDonorRows.map((row) => (
                <tr key={row.donorName}>
                  <td>{row.donorName}</td>
                  <td>{formatCurrency(row.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td>{formatCurrency(totalDonations)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <p>No monthly donations recorded for this month.</p>
        </div>
      )}

      <h3>Others — Detail</h3>
      <ExportToolbar
        onExportCsv={() => exportToCsv(`monthly-report-others-${selectedMonth}.csv`, othersDonorExportHeaders, othersDonorExportRows())}
        onExportHtml={() =>
          exportToHtml(
            `monthly-report-others-${selectedMonth}.html`,
            "Monthly Report — Others",
            othersDonorExportHeaders,
            othersDonorExportRows()
          )
        }
        onExportPdf={exportPdf}
      />
      {othersDonorRows.length > 0 ? (
        <div className="table-panel" style={{ minWidth: 0, overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Donor</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {othersDonorRows.map((row) => (
                <tr key={row.donorName}>
                  <td>{row.donorName}</td>
                  <td>{formatCurrency(row.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td>{formatCurrency(totalOthers)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <p>No other income recorded for this month.</p>
        </div>
      )}

      <h3>Expenses</h3>
      <ExportToolbar
        onExportCsv={() => exportToCsv(`monthly-report-expenses-${selectedMonth}.csv`, expenseExportHeaders, expenseExportRows())}
        onExportHtml={() =>
          exportToHtml(`monthly-report-expenses-${selectedMonth}.html`, "Monthly Report — Expenses", expenseExportHeaders, expenseExportRows())
        }
        onExportPdf={exportPdf}
      />
      {monthExpenseRows.length > 0 ? (
        <div className="table-panel" style={{ minWidth: 0, overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Account</th>
                <th>Date</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {monthExpenseRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.itemName ?? "—"}</td>
                  <td>{row.accountName ?? "—"}</td>
                  <td>{row.date ? formatDateOnly(row.date) : "—"}</td>
                  <td>{formatCurrency(row.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>Total Expenses</td>
                <td>{formatCurrency(totalExpenses)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <p>No expenses recorded for this month.</p>
        </div>
      )}

      <h3>Bills</h3>
      <ExportToolbar
        onExportCsv={() => exportToCsv(`monthly-report-bills-${selectedMonth}.csv`, billExportHeaders, billExportRows())}
        onExportHtml={() =>
          exportToHtml(`monthly-report-bills-${selectedMonth}.html`, "Monthly Report — Bills", billExportHeaders, billExportRows())
        }
        onExportPdf={exportPdf}
      />
      {monthBillRows.length > 0 ? (
        <div className="table-panel" style={{ minWidth: 0, overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Bill #</th>
                <th>Vendor</th>
                <th>Account</th>
                <th>Date</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {monthBillRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.number ?? "—"}</td>
                  <td>{row.vendorName ?? "—"}</td>
                  <td>{row.accountName ?? "—"}</td>
                  <td>{row.date ? formatDateOnly(row.date) : "—"}</td>
                  <td>{formatCurrency(row.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>Total Bills</td>
                <td>{formatCurrency(totalBills)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <p>No bills recorded for this month.</p>
        </div>
      )}
    </div>
  );
}
