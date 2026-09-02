"use client";

import { useMemo, useState } from "react";
import { formatCurrency, formatDateOnly } from "@/lib/format";
import { ExportMenu } from "@/components/ui/export-menu";
import { Section } from "@/components/ui/section";
import { FilterField, ReportToolbar } from "@/components/ui/report-toolbar";
import {
  exportToCsv,
  exportToHtml,
  exportSectionsToCsv,
  exportSectionsToHtml,
  exportSectionToImage,
  printReportSection,
  type ExportCell,
  type ExportSection
} from "@/lib/export";
import { useUrlParamSetter } from "@/lib/reports/use-url-param";
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
  balance: number;
};

function dueClass(balance: number) {
  return balance > 0 ? "cell-danger" : "cell-success";
}

type MonthlyReportProps = {
  months: DonationMonth[];
  incomeRows: MonthlyIncomeRow[];
  expenseRows: MonthlyExpenseRow[];
  billRows: MonthlyBillRow[];
  initialMonth?: string;
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

export function MonthlyReport({ months, incomeRows, expenseRows, billRows, initialMonth }: MonthlyReportProps) {
  const defaultMonth = months.length > 0 ? months[months.length - 1].key : "";
  const [selectedMonth, setSelectedMonth] = useState(initialMonth ?? defaultMonth);
  const setUrlParams = useUrlParamSetter();

  const selectedMonthLabel = months.find((month) => month.key === selectedMonth)?.label ?? selectedMonth;

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
    setUrlParams({ month });
  };

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
  const totalBillsDue = monthBillRows.reduce((sum, row) => sum + row.balance, 0);
  const totalBillsPaid = totalBills - totalBillsDue;
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
    ["Bills", formatCurrency(totalBills)],
    ["Bills Paid", formatCurrency(totalBillsPaid)],
    ["Bills Due", formatCurrency(totalBillsDue)]
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

  const billExportHeaders = ["Bill #", "Vendor", "Account", "Date", "Total", "Paid", "Due"];
  const billExportRows = (): ExportCell[][] =>
    monthBillRows.map((row) => [
      row.number ?? "",
      row.vendorName ?? "",
      row.accountName ?? "",
      row.date ? formatDateOnly(row.date) : "",
      formatCurrency(row.total),
      formatCurrency(row.total - row.balance),
      { value: formatCurrency(row.balance), highlight: row.balance > 0 ? "danger" : "success" } as ExportCell
    ]);

  const exportPdf = () => printReportSection("monthly-report");
  const exportImage = () => exportSectionToImage("monthly-report", `monthly-report-${selectedMonth}.png`);

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
    <div className="stack">
      <ReportToolbar
        actions={
          <ExportMenu
            label="Export report"
            onExportCsv={() => exportSectionsToCsv(`monthly-report-${selectedMonth}.csv`, fullReportSections())}
            onExportHtml={() =>
              exportSectionsToHtml(
                `monthly-report-${selectedMonth}.html`,
                fullReportTitle,
                fullReportSections()
              )
            }
            onExportPdf={exportPdf}
            onExportImage={exportImage}
          />
        }
      >
        <FilterField label="Month">
          <select
            id="monthly-report-month"
            className="select"
            aria-label="Month"
            value={selectedMonth}
            onChange={(event) => handleMonthChange(event.target.value)}
          >
            {[...months].reverse().map((month) => (
              <option key={month.key} value={month.key}>
                {month.label}
              </option>
            ))}
          </select>
        </FilterField>
        <span className="muted">{selectedMonthLabel}</span>
      </ReportToolbar>

      {/* Received leads the row; Bills Due is the only figure that can be in
          a bad state, so it is the only tile that ever takes a colour. */}
      <div className="metric-grid" aria-label="Monthly report summary">
        <article className="metric-card" data-emphasis="lead">
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
        <article className="metric-card" data-state={totalBillsDue > 0 ? "critical" : "positive"}>
          <div className="metric-head">
            <span>Bills Due</span>
          </div>
          <div className="metric-value">{formatCurrency(totalBillsDue)}</div>
          <div className="metric-sub">
            {formatCurrency(totalBillsPaid)} paid of {formatCurrency(totalBills)}
          </div>
        </article>
      </div>

      <Section
        title="Income"
        actions={
          <ExportMenu
            onExportCsv={() =>
              exportToCsv(
                `monthly-report-income-${selectedMonth}.csv`,
                incomeExportHeaders,
                incomeExportRows()
              )
            }
            onExportHtml={() =>
              exportToHtml(
                `monthly-report-income-${selectedMonth}.html`,
                "Monthly Report — Income",
                incomeExportHeaders,
                incomeExportRows()
              )
            }
            onExportPdf={exportPdf}
            onExportImage={exportImage}
          />
        }
      >
        <div className="table-panel-scroll">
          <table className="data-table data-table-cards">
            <thead>
              <tr>
                <th>Category</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{INCOME_CATEGORY_LABELS.donations}</td>
                <td data-label="Amount" className="num">
                  {formatCurrency(totalDonations)}
                </td>
              </tr>
              <tr>
                <td>{INCOME_CATEGORY_LABELS.archanai}</td>
                <td data-label="Amount" className="num">
                  {formatCurrency(totalArchanai)}
                </td>
              </tr>
              <tr>
                <td>{INCOME_CATEGORY_LABELS.abhishegam}</td>
                <td data-label="Amount" className="num">
                  {formatCurrency(totalAbhishegam)}
                </td>
              </tr>
              <tr>
                <td>{INCOME_CATEGORY_LABELS.others}</td>
                <td data-label="Amount" className="num">
                  {formatCurrency(totalOthers)}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td>Total Received</td>
                <td data-label="Amount" className="num">
                  {formatCurrency(totalReceived)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Section>

      <Section
        title="Monthly Donations — Donor Detail"
        count={donationDonorRows.length}
        actions={
          <ExportMenu
            onExportCsv={() =>
              exportToCsv(
                `monthly-report-donations-${selectedMonth}.csv`,
                donationDonorExportHeaders,
                donationDonorExportRows()
              )
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
            onExportImage={exportImage}
          />
        }
      >
        {donationDonorRows.length > 0 ? (
          <div className="table-panel-scroll">
            <table className="data-table data-table-cards">
              <thead>
                <tr>
                  <th>Donor</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {donationDonorRows.map((row) => (
                  <tr key={row.donorName}>
                    <td>{row.donorName}</td>
                    <td data-label="Amount" className="num">
                      {formatCurrency(row.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td data-label="Amount" className="num">
                    {formatCurrency(totalDonations)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <p>No monthly donations recorded for this month.</p>
          </div>
        )}
      </Section>

      <Section
        title="Others — Detail"
        count={othersDonorRows.length}
        actions={
          <ExportMenu
            onExportCsv={() =>
              exportToCsv(
                `monthly-report-others-${selectedMonth}.csv`,
                othersDonorExportHeaders,
                othersDonorExportRows()
              )
            }
            onExportHtml={() =>
              exportToHtml(
                `monthly-report-others-${selectedMonth}.html`,
                "Monthly Report — Others",
                othersDonorExportHeaders,
                othersDonorExportRows()
              )
            }
            onExportPdf={exportPdf}
            onExportImage={exportImage}
          />
        }
      >
        {othersDonorRows.length > 0 ? (
          <div className="table-panel-scroll">
            <table className="data-table data-table-cards">
              <thead>
                <tr>
                  <th>Donor</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {othersDonorRows.map((row) => (
                  <tr key={row.donorName}>
                    <td>{row.donorName}</td>
                    <td data-label="Amount" className="num">
                      {formatCurrency(row.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td data-label="Amount" className="num">
                    {formatCurrency(totalOthers)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <p>No other income recorded for this month.</p>
          </div>
        )}
      </Section>

      <Section
        title="Expenses"
        count={monthExpenseRows.length}
        actions={
          <ExportMenu
            onExportCsv={() =>
              exportToCsv(
                `monthly-report-expenses-${selectedMonth}.csv`,
                expenseExportHeaders,
                expenseExportRows()
              )
            }
            onExportHtml={() =>
              exportToHtml(
                `monthly-report-expenses-${selectedMonth}.html`,
                "Monthly Report — Expenses",
                expenseExportHeaders,
                expenseExportRows()
              )
            }
            onExportPdf={exportPdf}
            onExportImage={exportImage}
          />
        }
      >
        {monthExpenseRows.length > 0 ? (
          <div className="table-panel-scroll">
            <table className="data-table data-table-cards">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Account</th>
                  <th>Date</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {monthExpenseRows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Item">{row.itemName ?? "—"}</td>
                    <td data-label="Account">{row.accountName ?? "—"}</td>
                    <td data-label="Date">{row.date ? formatDateOnly(row.date) : "—"}</td>
                    <td data-label="Amount" className="num">
                      {formatCurrency(row.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>Total Expenses</td>
                  <td data-label="Amount" className="num">
                    {formatCurrency(totalExpenses)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <p>No expenses recorded for this month.</p>
          </div>
        )}
      </Section>

      <Section
        title="Bills"
        count={monthBillRows.length}
        actions={
          <ExportMenu
            onExportCsv={() =>
              exportToCsv(`monthly-report-bills-${selectedMonth}.csv`, billExportHeaders, billExportRows())
            }
            onExportHtml={() =>
              exportToHtml(
                `monthly-report-bills-${selectedMonth}.html`,
                "Monthly Report — Bills",
                billExportHeaders,
                billExportRows()
              )
            }
            onExportPdf={exportPdf}
            onExportImage={exportImage}
          />
        }
      >
        {monthBillRows.length > 0 ? (
          <div className="table-panel-scroll">
            <table className="data-table data-table-cards">
              <thead>
                <tr>
                  <th>Bill #</th>
                  <th>Vendor</th>
                  <th>Account</th>
                  <th>Date</th>
                  <th className="num">Total</th>
                  <th className="num">Paid</th>
                  <th className="num">Due</th>
                </tr>
              </thead>
              <tbody>
                {monthBillRows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Bill #">{row.number ?? "—"}</td>
                    <td data-label="Vendor">{row.vendorName ?? "—"}</td>
                    <td data-label="Account">{row.accountName ?? "—"}</td>
                    <td data-label="Date">{row.date ? formatDateOnly(row.date) : "—"}</td>
                    <td data-label="Total" className="num">
                      {formatCurrency(row.total)}
                    </td>
                    <td data-label="Paid" className="num">
                      {formatCurrency(row.total - row.balance)}
                    </td>
                    <td data-label="Due" className={`num ${dueClass(row.balance)}`}>
                      {formatCurrency(row.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4}>Total Bills</td>
                  <td data-label="Total" className="num">
                    {formatCurrency(totalBills)}
                  </td>
                  <td data-label="Paid" className="num">
                    {formatCurrency(totalBillsPaid)}
                  </td>
                  <td data-label="Due" className="num">
                    {formatCurrency(totalBillsDue)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <p>No bills recorded for this month.</p>
          </div>
        )}
      </Section>
    </div>
  );
}
