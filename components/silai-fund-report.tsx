"use client";

import { useMemo, useState } from "react";
import { formatCurrency, formatDateOnly } from "@/lib/format";
import { ExportToolbar } from "@/components/export-toolbar";
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
import { groupKeyFor, sortGroupNames } from "@/lib/silai-groups";

export type SilaiContributionRow = {
  donorName: string | null;
  group: string | null;
  phone: string | null;
  address: string | null;
  isMember: boolean;
  total: number;
};

// Matches the per-member Silai fund minimum used elsewhere (Members Silai
// Contributions' fully-paid threshold): full (green) at/above it, partial
// (yellow) below it, none (red) at zero.
const FULL_AMOUNT_THRESHOLD = 3000;

function amountClass(total: number) {
  if (total >= FULL_AMOUNT_THRESHOLD) return "cell-success";
  if (total > 0) return "cell-warning";
  return "cell-danger";
}

function amountCell(total: number): ExportCell {
  const value = formatCurrency(total);
  if (total >= FULL_AMOUNT_THRESHOLD) return { value, highlight: "success" };
  if (total > 0) return { value, highlight: "warning" };
  return { value, highlight: "danger" };
}

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
  const [showAllMembers, setShowAllMembers] = useState(false);

  // contributionRows includes every member (even those with total: 0) so
  // this toggle can reveal who hasn't paid yet; off by default keeps the
  // report showing only actual contributors, matching its original shape.
  const visibleContributionRows = useMemo(
    () => (showAllMembers ? contributionRows : contributionRows.filter((row) => row.total > 0)),
    [contributionRows, showAllMembers]
  );

  const totalContributions = sumTotals(contributionRows);
  const totalExpenses = sumTotals(expenseRows);
  const totalBills = sumTotals(billRows);
  const totalSpent = totalExpenses + totalBills;
  const balance = totalContributions - totalSpent;

  // visibleContributionRows already arrive sorted in street walking order
  // (see buildSilaiContributionRows in app/reports/page.tsx), so bucketing
  // here by group preserves the correct order within each section too.
  const contributionGroups = useMemo(() => {
    const byGroup = new Map<string, SilaiContributionRow[]>();

    visibleContributionRows.forEach((row) => {
      const key = groupKeyFor(row.group);
      const list = byGroup.get(key) ?? [];
      list.push(row);
      byGroup.set(key, list);
    });

    return sortGroupNames(Array.from(byGroup.keys())).map((groupName) => {
      const rows = byGroup.get(groupName) ?? [];
      return { groupName, rows, subtotal: sumTotals(rows) };
    });
  }, [visibleContributionRows]);

  const exportPdf = () => printReportSection(PRINT_TARGET);
  const exportImage = () => exportSectionToImage(PRINT_TARGET, "silai-fund-report.png");

  const metricsExportHeaders = ["Metric", "Value"];
  const metricsExportRows = () => [
    ["Total Contributions", formatCurrency(totalContributions)],
    ["Total Spent", formatCurrency(totalSpent)],
    ["Balance", formatCurrency(balance)],
    ["Expenses", formatCurrency(totalExpenses)],
    ["Bills", formatCurrency(totalBills)]
  ];

  const contributionExportHeaders = ["Donor", "Phone", "Address", "Amount"];
  const contributionGroupExportRows = (rows: SilaiContributionRow[], subtotal: number): ExportCell[][] => [
    ...rows.map((row) => [row.donorName ?? "", row.phone ?? "", row.address ?? "", amountCell(row.total)]),
    ["Subtotal", "", "", amountCell(subtotal)]
  ];
  const contributionExportSections = (): ExportSection[] =>
    contributionGroups.map((group) => ({
      title: `${group.groupName} (${group.rows.length})`,
      headers: contributionExportHeaders,
      rows: contributionGroupExportRows(group.rows, group.subtotal)
    }));

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
    ...contributionExportSections(),
    { title: "Expenses", headers: expenseExportHeaders, rows: expenseExportRows() },
    { title: "Bills", headers: billExportHeaders, rows: billExportRows() }
  ];

  return (
    <div>
      <ExportToolbar
        onExportCsv={() => exportSectionsToCsv("silai-fund-report.csv", fullReportSections())}
        onExportHtml={() => exportSectionsToHtml("silai-fund-report.html", "Silai Fund Report", fullReportSections())}
        onExportPdf={exportPdf}
        onExportImage={exportImage}
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
      </div>

      <div className="filter-banner no-print" style={{ justifyContent: "flex-start", gap: 10 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={showAllMembers}
            onChange={(event) => setShowAllMembers(event.target.checked)}
          />
          Show all members (including not yet paid)
        </label>
      </div>

      <ExportToolbar
        onExportCsv={() => exportSectionsToCsv("silai-fund-contributions.csv", contributionExportSections())}
        onExportHtml={() =>
          exportSectionsToHtml("silai-fund-contributions.html", "Silai Fund — Contributions", contributionExportSections())
        }
        onExportPdf={exportPdf}
        onExportImage={exportImage}
      />
      {contributionGroups.length > 0 ? (
        contributionGroups.map((group) => (
          <div key={group.groupName}>
            <h3>
              {group.groupName} ({group.rows.length})
            </h3>
            <div className="table-panel table-panel-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Donor</th>
                    <th>Phone</th>
                    <th>Address</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row, index) => (
                    <tr key={`${row.donorName ?? "unknown"}-${index}`}>
                      <td>{row.donorName ?? "—"}</td>
                      <td>{row.phone ?? "—"}</td>
                      <td>{row.address ?? "—"}</td>
                      <td className={amountClass(row.total)}>{formatCurrency(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}>Subtotal</td>
                    <td>{formatCurrency(group.subtotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        ))
      ) : (
        <div className="empty-state">
          <p>{showAllMembers ? "No members found." : "No contributions recorded."}</p>
        </div>
      )}

      <h3>Expenses</h3>
      <ExportToolbar
        onExportCsv={() => exportToCsv("silai-fund-expenses.csv", expenseExportHeaders, expenseExportRows())}
        onExportHtml={() => exportToHtml("silai-fund-expenses.html", "Silai Fund — Expenses", expenseExportHeaders, expenseExportRows())}
        onExportPdf={exportPdf}
        onExportImage={exportImage}
      />
      {expenseRows.length > 0 ? (
        <div className="table-panel table-panel-scroll">
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
        onExportImage={exportImage}
      />
      {billRows.length > 0 ? (
        <div className="table-panel table-panel-scroll">
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
