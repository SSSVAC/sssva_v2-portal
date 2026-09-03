"use client";

import { useMemo, useState } from "react";
import { formatCurrency, formatDateOnly } from "@/lib/format";
import { ExportMenu } from "@/components/ui/export-menu";
import { Section } from "@/components/ui/section";
import { SectionGroup } from "@/components/ui/section-group";
import { ReportToolbar } from "@/components/ui/report-toolbar";
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
import { BillsTable } from "@/components/reports/bills-table";
import { paymentExportRows, type BillPaymentRow } from "@/lib/reports/bill-payments";

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
  vendorName?: string | null;
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
  /** Individual Zoho payments applied to this bill. */
  payments?: BillPaymentRow[];
};

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
  const [showBillPayments, setShowBillPayments] = useState(false);
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
  // Cash actually in hand right now: what came in, less what has gone out.
  const balance = totalContributions - totalPaid;
  // Where the fund lands once the outstanding bills are settled — the same
  // as `balance - totalBillsDue`, expressed against everything incurred so
  // the two figures can't drift apart.
  const projectedBalance = totalContributions - totalSpent;

  // visibleContributionRows already arrive sorted in street walking order,
  // so bucketing here by group preserves the correct order within each
  // section too.
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

  // Each section is addressable on its own, so its export menu covers that
  // section rather than the whole report. printTarget is unique per page, so
  // suffixing it is enough to keep these ids distinct.
  const sectionId = (part: string) => `${printTarget}-${part}`;
  const printPart = (part: string) => () => printReportSection(sectionId(part));
  const imagePart = (part: string) => () => exportSectionToImage(sectionId(part), `${fileSlug}-${part}.png`);

  const metricsExportHeaders = ["Metric", "Value"];
  // Leads with the same five figures the tiles show, then the breakdown
  // behind them — so an exported sheet and the screen agree.
  const metricsExportRows = () => [
    ["Total Contributions", formatCurrency(totalContributions)],
    ["Total Paid", formatCurrency(totalPaid)],
    ["Current Balance", formatCurrency(balance)],
    ["Bills Due", formatCurrency(totalBillsDue)],
    ["P&L post settling dues", formatCurrency(projectedBalance)],
    ["Expenses", formatCurrency(totalExpenses)],
    ["Bills", formatCurrency(totalBills)],
    ["Bills Paid", formatCurrency(totalBillsPaid)],
    ["Total Spent", formatCurrency(totalSpent)]
  ];

  const contributionExportHeaders = ["Donor", "Phone", "Address", "Amount"];
  const contributionGroupExportRows = (
    rows: SilaiContributionRow[],
    subtotal: number
  ): ExportCell[][] => [
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
  const nonCashExportRows = () =>
    nonCashDonationRows.map((row) => [row.donorName ?? "", row.address ?? "", row.detail]);

  const expenseExportHeaders = ["Item", "Date", "Amount"];
  const expenseExportRows = () => [
    ...expenseRows.map((row) => [
      row.itemName ?? "",
      row.date ? formatDateOnly(row.date) : "",
      formatCurrency(row.total)
    ]),
    ["Total", "", formatCurrency(totalExpenses)]
  ];

  const billExportHeaders = ["Bill #", "Vendor", "Date", "Total", "Paid", "Due"];
  // The export mirrors what's on screen: with the breakdown showing, each
  // bill's payments follow it as indented rows.
  const billExportRows = (): ExportCell[][] => [
    ...billRows.flatMap((row) => [
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
    ...(nonCashDonationRows.length > 0
      ? [{ title: "Non-Cash Donations", headers: nonCashExportHeaders, rows: nonCashExportRows() }]
      : []),
    { title: "Expenses", headers: expenseExportHeaders, rows: expenseExportRows() },
    { title: "Bills", headers: billExportHeaders, rows: billExportRows() }
  ];

  return (
    <div className="stack">
      <ReportToolbar
        actions={
          <ExportMenu
            label="Export report"
            onExportCsv={() => exportSectionsToCsv(`${fileSlug}-report.csv`, fullReportSections())}
            onExportHtml={() => exportSectionsToHtml(`${fileSlug}-report.html`, title, fullReportSections())}
            onExportPdf={exportPdf}
            onExportImage={exportImage}
          />
        }
      >
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={showAllMembers}
            onChange={(event) => handleShowAllMembersChange(event.target.checked)}
          />
          Show all members (including not yet paid)
        </label>
      </ReportToolbar>

      {/* Contributions is the figure the report exists to report, so it
          carries the lead emphasis. Bills Due is the only tile whose value
          can be in a bad state, so it is the only one that ever takes a
          semantic colour — the rest stay neutral. */}
      {/* Contributions is the figure the report exists to report, so it
          carries the lead emphasis. The three tiles that can be in a bad
          state — a fund in deficit now, bills outstanding, or a shortfall
          once those are settled — take a semantic colour; the rest stay
          neutral. */}
      <div className="metric-grid" aria-label={`${title} summary`}>
        <article className="metric-card" data-emphasis="lead">
          <div className="metric-head">
            <span>Total Contributions</span>
          </div>
          <div className="metric-value">{formatCurrency(totalContributions)}</div>
          <div className="metric-sub">{subtitle}</div>
        </article>
        <article className="metric-card">
          <div className="metric-head">
            <span>Total Paid</span>
          </div>
          <div className="metric-value">{formatCurrency(totalPaid)}</div>
          <div className="metric-sub">
            {formatCurrency(totalExpenses)} expenses + {formatCurrency(totalBillsPaid)} bills paid
          </div>
        </article>
        <article className="metric-card" data-state={balance < 0 ? "critical" : "positive"}>
          <div className="metric-head">
            <span>Current Balance</span>
          </div>
          <div className="metric-value">{formatCurrency(balance)}</div>
          <div className="metric-sub">Contributions minus what has been paid out</div>
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
        <article className="metric-card" data-state={projectedBalance < 0 ? "critical" : "positive"}>
          <div className="metric-head">
            <span>P&amp;L post settling dues</span>
          </div>
          <div className="metric-value">{formatCurrency(projectedBalance)}</div>
          <div className="metric-sub">
            {totalBillsDue > 0
              ? `After clearing the ${formatCurrency(totalBillsDue)} still due`
              : "Nothing left to settle"}
          </div>
        </article>
      </div>

      <SectionGroup
        printId={sectionId("contributions")}
        title="Contributions"
        description={`${visibleContributionRows.length} contributor${
          visibleContributionRows.length === 1 ? "" : "s"
        } across ${contributionGroups.length} street${contributionGroups.length === 1 ? "" : "s"}`}
        actions={
          <ExportMenu
            label="Export contributions"
            onExportCsv={() =>
              exportSectionsToCsv(`${fileSlug}-contributions.csv`, contributionExportSections())
            }
            onExportHtml={() =>
              exportSectionsToHtml(
                `${fileSlug}-contributions.html`,
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

      {nonCashDonationRows.length > 0 && (
        <Section
          printId={sectionId("non-cash-donations")}
          title="Non-Cash Donations"
          count={nonCashDonationRows.length}
          actions={
            <ExportMenu
              onExportCsv={() =>
                exportToCsv(`${fileSlug}-non-cash-donations.csv`, nonCashExportHeaders, nonCashExportRows())
              }
              onExportHtml={() =>
                exportToHtml(
                  `${fileSlug}-non-cash-donations.html`,
                  `${title} — Non-Cash Donations`,
                  nonCashExportHeaders,
                  nonCashExportRows()
                )
              }
              onExportPdf={printPart("non-cash-donations")}
              onExportImage={imagePart("non-cash-donations")}
            />
          }
        >
          <div className="table-panel-scroll">
            <table className="data-table data-table-cards">
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
                    <td data-label="Donor">{row.donorName ?? "—"}</td>
                    <td data-label="Address">{row.address ?? "—"}</td>
                    <td data-label="Detail">{row.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      <Section
        printId={sectionId("expenses")}
        title="Expenses"
        count={expenseRows.length}
        actions={
          <ExportMenu
            onExportCsv={() =>
              exportToCsv(`${fileSlug}-expenses.csv`, expenseExportHeaders, expenseExportRows())
            }
            onExportHtml={() =>
              exportToHtml(
                `${fileSlug}-expenses.html`,
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
        {expenseRows.length > 0 ? (
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
                {expenseRows.map((row) => (
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
        count={billRows.length}
        actions={
          <ExportMenu
            onExportCsv={() => exportToCsv(`${fileSlug}-bills.csv`, billExportHeaders, billExportRows())}
            onExportHtml={() =>
              exportToHtml(`${fileSlug}-bills.html`, `${title} — Bills`, billExportHeaders, billExportRows())
            }
            onExportPdf={printPart("bills")}
            onExportImage={imagePart("bills")}
          />
        }
      >
        {billRows.length > 0 ? (
          <BillsTable
            rows={billRows}
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
