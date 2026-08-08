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

export type EventContributionRow = {
  year: string;
  donorName: string | null;
  group: string | null;
  phone: string | null;
  address: string | null;
  isMember: boolean;
  total: number;
};

export type EventExpenseRow = {
  year: string;
  id: string;
  itemName: string | null;
  date: string | null;
  total: number;
};

export type EventBillRow = {
  year: string;
  id: string;
  number: string | null;
  vendorName: string | null;
  date: string | null;
  total: number;
};

// Matches the per-member Silai fund minimum used elsewhere as a general
// "reached a meaningful amount" full/partial/none indicator.
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

function sumTotals<T extends { total: number }>(rows: T[]) {
  return rows.reduce((sum, row) => sum + row.total, 0);
}

type EventFundReportProps = {
  title: string;
  subtitle?: string;
  fileSlug: string;
  printTarget: string;
  contributionRows: EventContributionRow[];
  expenseRows: EventExpenseRow[];
  billRows: EventBillRow[];
};

export function EventFundReport({
  title,
  subtitle,
  fileSlug,
  printTarget,
  contributionRows,
  expenseRows,
  billRows
}: EventFundReportProps) {
  const years = useMemo(() => {
    const set = new Set<string>();
    contributionRows.forEach((row) => set.add(row.year));
    expenseRows.forEach((row) => set.add(row.year));
    billRows.forEach((row) => set.add(row.year));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [contributionRows, expenseRows, billRows]);

  const [selectedYear, setSelectedYear] = useState(years[0] ?? "");
  const [showAllMembers, setShowAllMembers] = useState(false);

  const yearContributionRows = useMemo(
    () => contributionRows.filter((row) => row.year === selectedYear),
    [contributionRows, selectedYear]
  );
  const yearExpenseRows = useMemo(() => expenseRows.filter((row) => row.year === selectedYear), [expenseRows, selectedYear]);
  const yearBillRows = useMemo(() => billRows.filter((row) => row.year === selectedYear), [billRows, selectedYear]);

  // yearContributionRows includes every member (even those with total: 0) so
  // this toggle can reveal who hasn't paid yet for the selected year.
  const visibleContributionRows = useMemo(
    () => (showAllMembers ? yearContributionRows : yearContributionRows.filter((row) => row.total > 0)),
    [yearContributionRows, showAllMembers]
  );

  const totalContributions = sumTotals(yearContributionRows);
  const totalExpenses = sumTotals(yearExpenseRows);
  const totalBills = sumTotals(yearBillRows);
  const totalSpent = totalExpenses + totalBills;
  const balance = totalContributions - totalSpent;

  const contributionGroups = useMemo(() => {
    const byGroup = new Map<string, EventContributionRow[]>();

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

  const exportPdf = () => printReportSection(printTarget);
  const exportImage = () => exportSectionToImage(printTarget, `${fileSlug}-${selectedYear}.png`);

  const metricsExportHeaders = ["Metric", "Value"];
  const metricsExportRows = () => [
    ["Total Contributions", formatCurrency(totalContributions)],
    ["Total Spent", formatCurrency(totalSpent)],
    ["Balance", formatCurrency(balance)]
  ];

  const contributionExportHeaders = ["Donor", "Phone", "Address", "Amount"];
  const contributionGroupExportRows = (rows: EventContributionRow[], subtotal: number): ExportCell[][] => [
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
    ...yearExpenseRows.map((row) => [row.itemName ?? "", row.date ? formatDateOnly(row.date) : "", formatCurrency(row.total)]),
    ["Total", "", formatCurrency(totalExpenses)]
  ];

  const billExportHeaders = ["Bill #", "Vendor", "Date", "Amount"];
  const billExportRows = () => [
    ...yearBillRows.map((row) => [row.number ?? "", row.vendorName ?? "", row.date ? formatDateOnly(row.date) : "", formatCurrency(row.total)]),
    ["Total", "", "", formatCurrency(totalBills)]
  ];

  const fullReportSections = (): ExportSection[] => [
    { title: "Metrics", headers: metricsExportHeaders, rows: metricsExportRows() },
    ...contributionExportSections(),
    { title: "Expenses", headers: expenseExportHeaders, rows: expenseExportRows() },
    { title: "Bills", headers: billExportHeaders, rows: billExportRows() }
  ];

  if (years.length === 0) {
    return (
      <div className="empty-state">
        <p>No data recorded yet.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="filter-banner no-print">
        <label htmlFor={`${fileSlug}-year`}>Year</label>
        <select
          id={`${fileSlug}-year`}
          className="filter-input"
          style={{ maxWidth: 160 }}
          value={selectedYear}
          onChange={(event) => setSelectedYear(event.target.value)}
        >
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>

      <ExportToolbar
        onExportCsv={() => exportSectionsToCsv(`${fileSlug}-${selectedYear}.csv`, fullReportSections())}
        onExportHtml={() => exportSectionsToHtml(`${fileSlug}-${selectedYear}.html`, `${title} — ${selectedYear}`, fullReportSections())}
        onExportPdf={exportPdf}
        onExportImage={exportImage}
      />

      <div className="metric-grid" aria-label={`${title} summary`}>
        <article className="metric-card">
          <div className="metric-head">
            <span>Total Contributions</span>
          </div>
          <div className="metric-value">{formatCurrency(totalContributions)}</div>
          {subtitle && <div className="metric-sub">{subtitle}</div>}
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
        onExportCsv={() => exportSectionsToCsv(`${fileSlug}-contributions-${selectedYear}.csv`, contributionExportSections())}
        onExportHtml={() =>
          exportSectionsToHtml(`${fileSlug}-contributions-${selectedYear}.html`, `${title} — Contributions`, contributionExportSections())
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
        onExportCsv={() => exportToCsv(`${fileSlug}-expenses-${selectedYear}.csv`, expenseExportHeaders, expenseExportRows())}
        onExportHtml={() =>
          exportToHtml(`${fileSlug}-expenses-${selectedYear}.html`, `${title} — Expenses`, expenseExportHeaders, expenseExportRows())
        }
        onExportPdf={exportPdf}
        onExportImage={exportImage}
      />
      {yearExpenseRows.length > 0 ? (
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
              {yearExpenseRows.map((row) => (
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
        onExportCsv={() => exportToCsv(`${fileSlug}-bills-${selectedYear}.csv`, billExportHeaders, billExportRows())}
        onExportHtml={() => exportToHtml(`${fileSlug}-bills-${selectedYear}.html`, `${title} — Bills`, billExportHeaders, billExportRows())}
        onExportPdf={exportPdf}
        onExportImage={exportImage}
      />
      {yearBillRows.length > 0 ? (
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
              {yearBillRows.map((row) => (
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
