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
import { useUrlParamSetter } from "@/lib/reports/use-url-param";
import type { NonCashDonationRow } from "@/lib/reports/all-time-fund";

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
  balance: number;
};

function dueClass(balance: number) {
  return balance > 0 ? "cell-danger" : "cell-success";
}

export type SilaiVendorRow = {
  vendorName: string;
  billCount: number;
  total: number;
  paid: number;
  due: number;
};

function buildVendorRows(billRows: SilaiBillRow[]): SilaiVendorRow[] {
  const byVendor = new Map<string, SilaiVendorRow>();

  billRows.forEach((row) => {
    const vendorName = row.vendorName ?? "Unknown Vendor";
    const existing = byVendor.get(vendorName) ?? { vendorName, billCount: 0, total: 0, paid: 0, due: 0 };
    existing.billCount += 1;
    existing.total += row.total;
    existing.paid += row.total - row.balance;
    existing.due += row.balance;
    byVendor.set(vendorName, existing);
  });

  return Array.from(byVendor.values()).sort((a, b) => b.total - a.total);
}

type SilaiFundReportProps = {
  title?: string;
  subtitle?: string;
  fileSlug?: string;
  printTarget?: string;
  contributionRows: SilaiContributionRow[];
  nonCashDonationRows?: NonCashDonationRow[];
  expenseRows: SilaiExpenseRow[];
  billRows: SilaiBillRow[];
  initialShowAllMembers?: boolean;
};

function sumTotals<T extends { total: number }>(rows: T[]) {
  return rows.reduce((sum, row) => sum + row.total, 0);
}

export function SilaiFundReport({
  title = "Silai Fund Report",
  subtitle = "சிலை வைப்பதற்கான நிதி — all time",
  fileSlug = "silai-fund",
  printTarget = "silai-fund",
  contributionRows,
  nonCashDonationRows = [],
  expenseRows,
  billRows,
  initialShowAllMembers = false
}: SilaiFundReportProps) {
  const [showAllMembers, setShowAllMembers] = useState(initialShowAllMembers);
  const setUrlParams = useUrlParamSetter();

  const handleShowAllMembersChange = (checked: boolean) => {
    setShowAllMembers(checked);
    setUrlParams({ all: checked ? "1" : null });
  };

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
  const totalBillsDue = billRows.reduce((sum, row) => sum + row.balance, 0);
  const totalBillsPaid = totalBills - totalBillsDue;
  const totalSpent = totalExpenses + totalBills;
  const totalPaid = totalExpenses + totalBillsPaid;
  const balance = totalContributions - totalSpent;

  const vendorRows = useMemo(() => buildVendorRows(billRows), [billRows]);

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

  const exportPdf = () => printReportSection(printTarget);
  const exportImage = () => exportSectionToImage(printTarget, `${fileSlug}-report.png`);

  const metricsExportHeaders = ["Metric", "Value"];
  const metricsExportRows = () => [
    ["Total Contributions", formatCurrency(totalContributions)],
    ["Total Spent", formatCurrency(totalSpent)],
    ["Total Paid", formatCurrency(totalPaid)],
    ["Balance", formatCurrency(balance)],
    ["Expenses", formatCurrency(totalExpenses)],
    ["Bills", formatCurrency(totalBills)],
    ["Bills Paid", formatCurrency(totalBillsPaid)],
    ["Bills Due", formatCurrency(totalBillsDue)]
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

  const nonCashExportHeaders = ["Donor", "Address", "Detail"];
  const nonCashExportRows = () => nonCashDonationRows.map((row) => [row.donorName ?? "", row.address ?? "", row.detail]);

  const expenseExportHeaders = ["Item", "Date", "Amount"];
  const expenseExportRows = () => [
    ...expenseRows.map((row) => [row.itemName ?? "", row.date ? formatDateOnly(row.date) : "", formatCurrency(row.total)]),
    ["Total", "", formatCurrency(totalExpenses)]
  ];

  const billExportHeaders = ["Bill #", "Vendor", "Date", "Total", "Paid", "Due"];
  const billExportRows = (): ExportCell[][] => [
    ...billRows.map((row) => [
      row.number ?? "",
      row.vendorName ?? "",
      row.date ? formatDateOnly(row.date) : "",
      formatCurrency(row.total),
      formatCurrency(row.total - row.balance),
      { value: formatCurrency(row.balance), highlight: row.balance > 0 ? "danger" : "success" } as ExportCell
    ]),
    ["Total", "", "", formatCurrency(totalBills), formatCurrency(totalBillsPaid), formatCurrency(totalBillsDue)]
  ];

  const vendorExportHeaders = ["Vendor", "Bills", "Total", "Paid", "Due"];
  const vendorExportRows = (): ExportCell[][] => [
    ...vendorRows.map((row) => [
      row.vendorName,
      String(row.billCount),
      formatCurrency(row.total),
      formatCurrency(row.paid),
      { value: formatCurrency(row.due), highlight: row.due > 0 ? "danger" : "success" } as ExportCell
    ]),
    ["Total", "", formatCurrency(totalBills), formatCurrency(totalBillsPaid), formatCurrency(totalBillsDue)]
  ];

  const fullReportSections = (): ExportSection[] => [
    { title: "Metrics", headers: metricsExportHeaders, rows: metricsExportRows() },
    ...contributionExportSections(),
    ...(nonCashDonationRows.length > 0
      ? [{ title: "Non-Cash Donations", headers: nonCashExportHeaders, rows: nonCashExportRows() }]
      : []),
    { title: "Expenses", headers: expenseExportHeaders, rows: expenseExportRows() },
    { title: "Bills", headers: billExportHeaders, rows: billExportRows() },
    { title: "Vendor Payments", headers: vendorExportHeaders, rows: vendorExportRows() }
  ];

  return (
    <div>
      <ExportToolbar
        onExportCsv={() => exportSectionsToCsv(`${fileSlug}-report.csv`, fullReportSections())}
        onExportHtml={() => exportSectionsToHtml(`${fileSlug}-report.html`, title, fullReportSections())}
        onExportPdf={exportPdf}
        onExportImage={exportImage}
      />

      <div className="metric-grid" aria-label={`${title} summary`}>
        <article className="metric-card">
          <div className="metric-head">
            <span>Total Contributions</span>
          </div>
          <div className="metric-value">{formatCurrency(totalContributions)}</div>
          <div className="metric-sub">{subtitle}</div>
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
            <span>Total Paid</span>
          </div>
          <div className="metric-value">{formatCurrency(totalPaid)}</div>
          <div className="metric-sub">Expenses + Bills Paid</div>
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
            <span>Bills Due</span>
          </div>
          <div className={`metric-value ${totalBillsDue > 0 ? "cell-danger" : "cell-success"}`}>
            {formatCurrency(totalBillsDue)}
          </div>
          <div className="metric-sub">{formatCurrency(totalBillsPaid)} paid of {formatCurrency(totalBills)}</div>
        </article>
      </div>

      <div className="filter-banner no-print" style={{ justifyContent: "flex-start", gap: 10 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={showAllMembers}
            onChange={(event) => handleShowAllMembersChange(event.target.checked)}
          />
          Show all members (including not yet paid)
        </label>
      </div>

      <ExportToolbar
        onExportCsv={() => exportSectionsToCsv(`${fileSlug}-contributions.csv`, contributionExportSections())}
        onExportHtml={() =>
          exportSectionsToHtml(`${fileSlug}-contributions.html`, `${title} — Contributions`, contributionExportSections())
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

      {nonCashDonationRows.length > 0 && (
        <>
          <h3>Non-Cash Donations</h3>
          <ExportToolbar
            onExportCsv={() => exportToCsv(`${fileSlug}-non-cash-donations.csv`, nonCashExportHeaders, nonCashExportRows())}
            onExportHtml={() =>
              exportToHtml(`${fileSlug}-non-cash-donations.html`, `${title} — Non-Cash Donations`, nonCashExportHeaders, nonCashExportRows())
            }
            onExportPdf={exportPdf}
            onExportImage={exportImage}
          />
          <div className="table-panel table-panel-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Donor</th>
                  <th>Address</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {nonCashDonationRows.map((row, index) => (
                  <tr key={`${row.donorName ?? "unknown"}-${index}`}>
                    <td>{row.donorName ?? "—"}</td>
                    <td>{row.address ?? "—"}</td>
                    <td>{row.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h3>Expenses</h3>
      <ExportToolbar
        onExportCsv={() => exportToCsv(`${fileSlug}-expenses.csv`, expenseExportHeaders, expenseExportRows())}
        onExportHtml={() => exportToHtml(`${fileSlug}-expenses.html`, `${title} — Expenses`, expenseExportHeaders, expenseExportRows())}
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
        onExportCsv={() => exportToCsv(`${fileSlug}-bills.csv`, billExportHeaders, billExportRows())}
        onExportHtml={() => exportToHtml(`${fileSlug}-bills.html`, `${title} — Bills`, billExportHeaders, billExportRows())}
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
                <th>Total</th>
                <th>Paid</th>
                <th>Due</th>
              </tr>
            </thead>
            <tbody>
              {billRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.number ?? "—"}</td>
                  <td>{row.vendorName ?? "—"}</td>
                  <td>{row.date ? formatDateOnly(row.date) : "—"}</td>
                  <td>{formatCurrency(row.total)}</td>
                  <td>{formatCurrency(row.total - row.balance)}</td>
                  <td className={dueClass(row.balance)}>{formatCurrency(row.balance)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>Total Bills</td>
                <td>{formatCurrency(totalBills)}</td>
                <td>{formatCurrency(totalBillsPaid)}</td>
                <td>{formatCurrency(totalBillsDue)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <p>No bills recorded.</p>
        </div>
      )}

      <h3>Vendor Payments</h3>
      <ExportToolbar
        onExportCsv={() => exportToCsv(`${fileSlug}-vendor-payments.csv`, vendorExportHeaders, vendorExportRows())}
        onExportHtml={() =>
          exportToHtml(`${fileSlug}-vendor-payments.html`, `${title} — Vendor Payments`, vendorExportHeaders, vendorExportRows())
        }
        onExportPdf={exportPdf}
        onExportImage={exportImage}
      />
      {vendorRows.length > 0 ? (
        <div className="table-panel table-panel-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Bills</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Due</th>
              </tr>
            </thead>
            <tbody>
              {vendorRows.map((row) => (
                <tr key={row.vendorName}>
                  <td>{row.vendorName}</td>
                  <td>{row.billCount}</td>
                  <td>{formatCurrency(row.total)}</td>
                  <td>{formatCurrency(row.paid)}</td>
                  <td className={dueClass(row.due)}>{formatCurrency(row.due)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>Total</td>
                <td>{formatCurrency(totalBills)}</td>
                <td>{formatCurrency(totalBillsPaid)}</td>
                <td>{formatCurrency(totalBillsDue)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <p>No vendor payments recorded.</p>
        </div>
      )}
    </div>
  );
}
