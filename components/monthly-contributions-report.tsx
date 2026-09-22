"use client";

import { useCallback, useMemo, useState } from "react";
import { MessageCircle, Search, Share2 } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { useToast } from "@/components/toast";
import { ExportMenu } from "@/components/ui/export-menu";
import { Section } from "@/components/ui/section";
import { FilterField, ReportToolbar } from "@/components/ui/report-toolbar";
import { CellValue } from "@/components/ui/cell-value";
import { useUrlParamSetter } from "@/lib/reports/use-url-param";
import {
  exportSectionsToCsv,
  exportSectionsToHtml,
  exportSectionToImage,
  printReportSection,
  shareOrCopyText,
  type ExportCell,
  type ExportSection
} from "@/lib/export";
import {
  contributionStatus,
  contributionStatusClass,
  summariseMonth,
  type ContributionMonth,
  type MonthlyContributionRow
} from "@/lib/reports/monthly-contributions";
import {
  buildContributionFollowUp,
  buildContributionUpdate,
  buildMemberReminder,
  whatsAppLink
} from "@/lib/reports/contribution-message";

export type { ContributionMonth, MonthlyContributionRow };

/** Which members the table is showing, by how they stand this month. */
type StatusFilter = "all" | "full" | "partial" | "none" | "outstanding";

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "All members",
  outstanding: "Not settled",
  none: "Not paid",
  partial: "Short",
  full: "Paid"
};

const PRINT_TARGET = "monthly-contributions";

type MonthlyContributionsReportProps = {
  year: number;
  /** Years with a sheet worth opening, newest first. */
  years: number[];
  months: ContributionMonth[];
  rows: MonthlyContributionRow[];
  minimum: number;
  /**
   * "Now" as the association reckons it, computed on the server in IST. Sent
   * as props rather than read from the browser so the server and client
   * render the same thing, and so a member abroad sees the same month as the
   * temple does.
   */
  currentMonthKey: string;
  today: number;
  followUpDay: number;
  /** False on a share link, where phone and area are withheld. */
  showContact: boolean;
};

export function MonthlyContributionsReport({
  year,
  years,
  months,
  rows,
  minimum,
  currentMonthKey,
  today,
  followUpDay,
  showContact
}: MonthlyContributionsReportProps) {
  const { showToast } = useToast();
  const setUrlParams = useUrlParamSetter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sharing, setSharing] = useState<null | "update" | "follow-up">(null);

  // The month the tiles, the message and the follow-up all talk about: this
  // month while the year is running, December once it's over — a sheet for
  // 2025 opened in 2026 should summarise the year it is, not a month that
  // isn't on it.
  const focusMonth = useMemo(
    () => months.find((month) => month.key === currentMonthKey) ?? months[months.length - 1],
    [months, currentMonthKey]
  );

  const summary = useMemo(
    () => summariseMonth(rows, focusMonth.key, minimum),
    [rows, focusMonth.key, minimum]
  );

  // Stable across renders so the filtering below can depend on it without
  // recomputing every row on every keystroke. Month keys are ISO, so a
  // string compare is the "has this month happened yet" test.
  const statusOf = useCallback(
    (row: MonthlyContributionRow, monthKey: string) =>
      contributionStatus(row.amounts[monthKey] ?? 0, minimum, monthKey > currentMonthKey),
    [minimum, currentMonthKey]
  );

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rows.filter((row) => {
      if (
        query &&
        ![row.memberName, row.area ?? "", row.phone ?? ""].some((field) =>
          field.toLowerCase().includes(query)
        )
      ) {
        return false;
      }

      if (statusFilter === "all") return true;

      const status = statusOf(row, focusMonth.key);
      if (statusFilter === "outstanding") return status === "none" || status === "partial";
      return status === statusFilter;
    });
  }, [rows, search, statusFilter, focusMonth.key, statusOf]);

  const yearTotal = rows.reduce((sum, row) => sum + row.total, 0);
  const outstandingCount = summary.none.length + summary.partial.length;
  const followUpDue = today >= followUpDay && outstandingCount > 0 && focusMonth.key === currentMonthKey;

  const monthTotals = useMemo(
    () => months.map((month) => rows.reduce((sum, row) => sum + (row.amounts[month.key] ?? 0), 0)),
    [months, rows]
  );

  const handleYearChange = (next: string) => {
    setUrlParams({ year: next === String(years[0]) ? null : next });
  };

  async function share(kind: "update" | "follow-up") {
    setSharing(kind);
    try {
      const message =
        kind === "update"
          ? buildContributionUpdate({ monthLabel: focusMonth.label, summary, minimum })
          : buildContributionFollowUp({ monthLabel: focusMonth.label, summary, minimum });

      const result = await shareOrCopyText(`${focusMonth.label} contributions`, message);
      if (result === "copied") {
        showToast("Message copied — paste it into the group.", "success");
      }
    } catch (error) {
      console.error("Share failed", error);
      showToast("Could not share the message. Please try again.", "error");
    } finally {
      setSharing(null);
    }
  }

  function reminderLink(row: MonthlyContributionRow) {
    if (!showContact) return null;

    return whatsAppLink(
      row.phone,
      buildMemberReminder({
        memberName: row.memberName,
        monthLabel: focusMonth.label,
        minimum,
        paidSoFar: row.amounts[focusMonth.key] ?? 0
      })
    );
  }

  const exportHeaders = [
    "Member",
    ...(showContact ? ["Area", "Phone"] : []),
    ...months.map((month) => month.short),
    "Total",
    "Months paid"
  ];
  const exportRows = (): ExportCell[][] => [
    ...visibleRows.map((row) => [
      row.memberName,
      ...(showContact ? [row.area ?? "", row.phone ?? ""] : []),
      ...months.map((month): ExportCell => {
        const status = statusOf(row, month.key);
        if (status === "future") return "";

        const amount = row.amounts[month.key] ?? 0;
        return {
          value: amount > 0 ? formatCurrency(amount) : "—",
          highlight: status === "full" ? "success" : status === "partial" ? "warning" : "danger"
        };
      }),
      formatCurrency(row.total),
      `${row.monthsPaid}`
    ]),
    [
      "Total",
      ...(showContact ? ["", ""] : []),
      ...monthTotals.map((total) => (total > 0 ? formatCurrency(total) : "—")),
      formatCurrency(yearTotal),
      ""
    ]
  ];

  const exportSections = (): ExportSection[] => [
    {
      title: "Summary",
      headers: ["Metric", "Value"],
      rows: [
        [`Collected in ${focusMonth.label}`, formatCurrency(summary.collected)],
        [`Paid in ${focusMonth.label}`, `${summary.full.length} of ${rows.length}`],
        [`Short in ${focusMonth.label}`, `${summary.partial.length}`],
        [`Not paid in ${focusMonth.label}`, `${summary.none.length}`],
        [`Collected in ${year}`, formatCurrency(yearTotal)],
        ["Monthly minimum", formatCurrency(minimum)]
      ]
    },
    { title: `Monthly Contributions ${year}`, headers: exportHeaders, rows: exportRows() }
  ];

  const fileSlug = `monthly-contributions-${year}`;

  return (
    <div className="stack">
      <ReportToolbar
        actions={
          <>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={sharing !== null}
              onClick={() => void share("update")}
            >
              <Share2 size={14} />
              {sharing === "update" ? "Sharing…" : "Share update"}
            </button>
            <ExportMenu
              label="Export"
              onExportCsv={() => exportSectionsToCsv(`${fileSlug}.csv`, exportSections())}
              onExportHtml={() =>
                exportSectionsToHtml(`${fileSlug}.html`, `Monthly Contributions ${year}`, exportSections())
              }
              onExportPdf={() => printReportSection(PRINT_TARGET)}
              onExportImage={() => exportSectionToImage(PRINT_TARGET, `${fileSlug}.png`)}
            />
          </>
        }
      >
        <FilterField label="Year">
          <select
            className="select"
            aria-label="Year"
            value={year}
            onChange={(event) => handleYearChange(event.target.value)}
          >
            {years.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </FilterField>

        <FilterField label={focusMonth.label}>
          <select
            className="select"
            aria-label={`Filter by ${focusMonth.label} status`}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          >
            {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((value) => (
              <option key={value} value={value}>
                {STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </FilterField>

        <div className="searchbox">
          <Search size={14} />
          <input
            className="input"
            type="search"
            value={search}
            placeholder="Search members…"
            aria-label="Search members"
            onChange={(event) => setSearch(event.target.value)}
            style={{ paddingTop: 6, paddingBottom: 6 }}
          />
        </div>
      </ReportToolbar>

      {/* The tiles answer this month's question — who still owes — rather
          than the year's, which the grid below already shows in full. */}
      <div className="metric-grid" aria-label={`Contributions summary for ${focusMonth.label}`}>
        <article className="metric-card" data-emphasis="lead">
          <div className="metric-head">
            <span>{focusMonth.label}</span>
          </div>
          <div className="metric-value">{formatCurrency(summary.collected)}</div>
          <div className="metric-sub">
            {summary.full.length} of {rows.length} members paid {formatCurrency(minimum)}
          </div>
        </article>
        <article className="metric-card" data-state={summary.none.length > 0 ? "critical" : "positive"}>
          <div className="metric-head">
            <span>Not paid</span>
          </div>
          <div className="metric-value">{summary.none.length}</div>
          <div className="metric-sub">Nothing recorded for {focusMonth.label}</div>
        </article>
        <article className="metric-card" data-state={summary.partial.length > 0 ? "warning" : "positive"}>
          <div className="metric-head">
            <span>Short</span>
          </div>
          <div className="metric-value">{summary.partial.length}</div>
          <div className="metric-sub">Gave less than {formatCurrency(minimum)}</div>
        </article>
        <article className="metric-card">
          <div className="metric-head">
            <span>Collected in {year}</span>
          </div>
          <div className="metric-value">{formatCurrency(yearTotal)}</div>
          <div className="metric-sub">Across {rows.length} members</div>
        </article>
      </div>

      {followUpDue && (
        <div className="filter-banner no-print" role="status">
          <strong>
            It&apos;s the {today}
            {today === 1 ? "st" : today === 2 ? "nd" : today === 3 ? "rd" : "th"}.
          </strong>{" "}
          {outstandingCount} member{outstandingCount === 1 ? " has" : "s have"} not settled{" "}
          {focusMonth.label} yet.
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ marginLeft: "auto" }}
            disabled={sharing !== null}
            onClick={() => void share("follow-up")}
          >
            <Share2 size={14} />
            {sharing === "follow-up" ? "Sharing…" : "Share follow-up"}
          </button>
        </div>
      )}

      <Section
        printId={PRINT_TARGET}
        title={`Members — ${year}`}
        count={visibleRows.length === rows.length ? rows.length : `${visibleRows.length} of ${rows.length}`}
        badge={
          <span className="pill pill-neutral">
            {formatCurrency(minimum)}/month
          </span>
        }
      >
        {visibleRows.length > 0 ? (
          <div className="table-panel-scroll">
            <table className="data-table data-table-cards data-table-year-cards">
              <thead>
                <tr>
                  <th>Member</th>
                  {showContact && <th>Area</th>}
                  {showContact && <th>Phone</th>}
                  {months.map((month) => (
                    <th key={month.key} className="num" title={month.label}>
                      {month.short}
                    </th>
                  ))}
                  <th className="num">Total</th>
                  {showContact && <th>Remind</th>}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const link = reminderLink(row);
                  const owes = statusOf(row, focusMonth.key);

                  return (
                    <tr key={row.id}>
                      <td data-label="Member">{row.memberName}</td>
                      {showContact && (
                        <td data-label="Area">
                          <CellValue value={row.area} />
                        </td>
                      )}
                      {showContact && (
                        <td data-label="Phone">
                          <CellValue value={row.phone} />
                        </td>
                      )}
                      {months.map((month) => {
                        const status = statusOf(row, month.key);
                        const amount = row.amounts[month.key] ?? 0;

                        return (
                          <td
                            key={month.key}
                            data-label={month.short}
                            className={`num month-cell ${contributionStatusClass(status)}`}
                          >
                            {status === "future" ? (
                              <span className="month-cell-future" aria-label="Not due yet">
                                ·
                              </span>
                            ) : amount > 0 ? (
                              formatCurrency(amount)
                            ) : (
                              "—"
                            )}
                          </td>
                        );
                      })}
                      <td data-label="Total" className="num">
                        {formatCurrency(row.total)}
                      </td>
                      {showContact && (
                        <td data-label="Remind">
                          {/* Only the people a reminder is for, and only when
                              there's a number to send it to. */}
                          {link && (owes === "none" || owes === "partial") ? (
                            <a
                              className="btn btn-ghost btn-sm"
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <MessageCircle size={13} />
                              Remind
                            </a>
                          ) : (
                            <span className="cell-empty">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={showContact ? 3 : 1}>Total</td>
                  {monthTotals.map((total, index) => (
                    <td key={months[index].key} data-label={months[index].short} className="num">
                      {total > 0 ? formatCurrency(total) : "—"}
                    </td>
                  ))}
                  <td data-label="Total" className="num">
                    {formatCurrency(yearTotal)}
                  </td>
                  {showContact && <td />}
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <p>No members match this filter.</p>
          </div>
        )}
      </Section>
    </div>
  );
}
