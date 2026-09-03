"use client";

import { useMemo, useState } from "react";
import { formatCurrency, formatDateOnly } from "@/lib/format";
import { ExportMenu } from "@/components/ui/export-menu";
import { Section } from "@/components/ui/section";
import { SectionGroup } from "@/components/ui/section-group";
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
import { groupKeyFor, sortGroupNames } from "@/lib/silai-groups";
import { useUrlParamSetter } from "@/lib/reports/use-url-param";
import { BillsTable } from "@/components/reports/bills-table";
import { paymentExportRows, type BillPaymentRow } from "@/lib/reports/bill-payments";

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
  balance: number;
  /** Individual Zoho payments applied to this bill. */
  payments?: BillPaymentRow[];
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
  initialYear?: string;
  initialShowAllMembers?: boolean;
};

export function EventFundReport({
  title,
  subtitle,
  fileSlug,
  printTarget,
  contributionRows,
  expenseRows,
  billRows,
  initialYear,
  initialShowAllMembers = false
}: EventFundReportProps) {
  const years = useMemo(() => {
    const set = new Set<string>();
    contributionRows.forEach((row) => set.add(row.year));
    expenseRows.forEach((row) => set.add(row.year));
    billRows.forEach((row) => set.add(row.year));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [contributionRows, expenseRows, billRows]);

  const [selectedYear, setSelectedYear] = useState(initialYear ?? years[0] ?? "");
  const [showBillPayments, setShowBillPayments] = useState(false);
  const [showAllMembers, setShowAllMembers] = useState(initialShowAllMembers);
  const setUrlParams = useUrlParamSetter();

  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    setUrlParams({ year });
  };

  const handleShowAllMembersChange = (checked: boolean) => {
    setShowAllMembers(checked);
    setUrlParams({ all: checked ? "1" : null });
  };

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
  const totalBillsDue = yearBillRows.reduce((sum, row) => sum + row.balance, 0);
  const totalBillsPaid = totalBills - totalBillsDue;
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
  // Each section is addressable on its own, so its export menu covers that
  // section rather than the whole report.
  const sectionId = (part: string) => `${printTarget}-${part}`;
  const printPart = (part: string) => () => printReportSection(sectionId(part));
  const imagePart = (part: string) => () =>
    exportSectionToImage(sectionId(part), `${fileSlug}-${part}-${selectedYear}.png`);

  const metricsExportHeaders = ["Metric", "Value"];
  const metricsExportRows = () => [
    ["Total Contributions", formatCurrency(totalContributions)],
    ["Total Spent", formatCurrency(totalSpent)],
    ["Balance", formatCurrency(balance)],
    ["Bills Paid", formatCurrency(totalBillsPaid)],
    ["Bills Due", formatCurrency(totalBillsDue)]
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

  const billExportHeaders = ["Bill #", "Vendor", "Date", "Total", "Paid", "Due"];
  // The export mirrors what's on screen: with the breakdown showing, each
  // bill's payments follow it as indented rows.
  const billExportRows = (): ExportCell[][] => [
    ...yearBillRows.flatMap((row) => [
      [
        row.number ?? "",
        row.vendorName ?? "",
        row.date ? formatDateOnly(row.date) : "",
        formatCurrency(row.total),
        formatCurrency(row.total - row.balance),
        { value: formatCurrency(row.balance), highlight: row.balance > 0 ? "danger" : "success" } as ExportCell
      ],
      ...(showBillPayments ? paymentExportRows(row.payments ?? [], 6, 4) : [])
    ]),
    ["Total", "", "", formatCurrency(totalBills), formatCurrency(totalBillsPaid), formatCurrency(totalBillsDue)]
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
    <div className="stack">
      {/* Year, the "show all members" toggle and the whole-report export in
          one strip. They used to be three separate bars scattered down the
          page, with the second toggle only discoverable after scrolling
          past the summary tiles. */}
      <ReportToolbar
        actions={
          <ExportMenu
            label="Export report"
            onExportCsv={() => exportSectionsToCsv(`${fileSlug}-${selectedYear}.csv`, fullReportSections())}
            onExportHtml={() =>
              exportSectionsToHtml(
                `${fileSlug}-${selectedYear}.html`,
                `${title} — ${selectedYear}`,
                fullReportSections()
              )
            }
            onExportPdf={exportPdf}
            onExportImage={exportImage}
          />
        }
      >
        <FilterField label="Year">
          <select
            id={`${fileSlug}-year`}
            className="select"
            aria-label="Year"
            value={selectedYear}
            onChange={(event) => handleYearChange(event.target.value)}
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </FilterField>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={showAllMembers}
            onChange={(event) => handleShowAllMembersChange(event.target.checked)}
          />
          Show all members (including not yet paid)
        </label>
      </ReportToolbar>

      <div className="metric-grid" aria-label={`${title} summary`}>
        <article className="metric-card" data-emphasis="lead">
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

      <SectionGroup
        printId={sectionId("contributions")}
        title="Contributions"
        description={`${selectedYear} · ${contributionGroups.length} street${
          contributionGroups.length === 1 ? "" : "s"
        }`}
        actions={
          <ExportMenu
            label="Export contributions"
            onExportCsv={() =>
              exportSectionsToCsv(
                `${fileSlug}-contributions-${selectedYear}.csv`,
                contributionExportSections()
              )
            }
            onExportHtml={() =>
              exportSectionsToHtml(
                `${fileSlug}-contributions-${selectedYear}.html`,
                `${title} — Contributions`,
                contributionExportSections()
              )
            }
            onExportPdf={printPart("contributions")}
            onExportImage={imagePart("contributions")}
          />
        }
      >
        {contributionGroups.length > 0 ? (
          contributionGroups.map((group) => (
            <Section key={group.groupName} title={group.groupName} count={group.rows.length}>
              <div className="table-panel-scroll">
                <table className="data-table data-table-cards">
                  <thead>
                    <tr>
                      <th>Donor</th>
                      <th>Phone</th>
                      <th>Address</th>
                      <th className="num">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row, index) => (
                      <tr key={`${row.donorName ?? "unknown"}-${index}`}>
                        <td data-label="Donor">{row.donorName ?? "—"}</td>
                        <td data-label="Phone">{row.phone ?? "—"}</td>
                        <td data-label="Address">{row.address ?? "—"}</td>
                        <td data-label="Amount" className={`num ${amountClass(row.total)}`}>
                          {formatCurrency(row.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3}>Subtotal</td>
                      <td data-label="Amount" className="num">
                        {formatCurrency(group.subtotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Section>
          ))
        ) : (
          <div className="empty-state">
            <p>{showAllMembers ? "No members found." : "No contributions recorded."}</p>
          </div>
        )}
      </SectionGroup>

      <Section
        printId={sectionId("expenses")}
        title="Expenses"
        count={yearExpenseRows.length}
        actions={
          <ExportMenu
            onExportCsv={() =>
              exportToCsv(
                `${fileSlug}-expenses-${selectedYear}.csv`,
                expenseExportHeaders,
                expenseExportRows()
              )
            }
            onExportHtml={() =>
              exportToHtml(
                `${fileSlug}-expenses-${selectedYear}.html`,
                `${title} — Expenses`,
                expenseExportHeaders,
                expenseExportRows()
              )
            }
            onExportPdf={printPart("expenses")}
            onExportImage={imagePart("expenses")}
          />
        }
      >
        {yearExpenseRows.length > 0 ? (
          <div className="table-panel-scroll">
            <table className="data-table data-table-cards">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Date</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {yearExpenseRows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Item">{row.itemName ?? "—"}</td>
                    <td data-label="Date">{row.date ? formatDateOnly(row.date) : "—"}</td>
                    <td data-label="Amount" className="num">
                      {formatCurrency(row.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>Total Expenses</td>
                  <td data-label="Amount" className="num">
                    {formatCurrency(totalExpenses)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <p>No expenses recorded.</p>
          </div>
        )}
      </Section>

      <Section
        printId={sectionId("bills")}
        title="Bills"
        count={yearBillRows.length}
        actions={
          <ExportMenu
            onExportCsv={() =>
              exportToCsv(`${fileSlug}-bills-${selectedYear}.csv`, billExportHeaders, billExportRows())
            }
            onExportHtml={() =>
              exportToHtml(
                `${fileSlug}-bills-${selectedYear}.html`,
                `${title} — Bills`,
                billExportHeaders,
                billExportRows()
              )
            }
            onExportPdf={printPart("bills")}
            onExportImage={imagePart("bills")}
          />
        }
      >
        {yearBillRows.length > 0 ? (
          <BillsTable
            rows={yearBillRows}
            showPayments={showBillPayments}
            onShowPaymentsChange={setShowBillPayments}
            totals={{ total: totalBills, paid: totalBillsPaid, due: totalBillsDue }}
          />
        ) : (
          <div className="empty-state">
            <p>No bills recorded.</p>
          </div>
        )}
      </Section>
    </div>
  );
}
