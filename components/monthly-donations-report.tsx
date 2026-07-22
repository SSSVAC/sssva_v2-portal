"use client";

import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/format";
import { ExportToolbar } from "@/components/export-toolbar";
import { SortableTh, type SortDirection } from "@/components/sortable-th";
import {
  exportSectionsToCsv,
  exportSectionsToHtml,
  exportSectionToImage,
  printReportSection,
  type ExportSection
} from "@/lib/export";

export type DonationMonth = {
  key: string;
  label: string;
};

export type DonorDonationRow = {
  id: string;
  donorName: string;
  amounts: Record<string, number>;
  total: number;
};

type MonthlyDonationsReportProps = {
  months: DonationMonth[];
  donors: DonorDonationRow[];
};

const NAME_SORT_KEY = "name";
const TOTAL_SORT_KEY = "total";

export function MonthlyDonationsReport({ months, donors }: MonthlyDonationsReportProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string>(NAME_SORT_KEY);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const sortedDonors = useMemo(() => {
    const filtered = donors.filter((donor) => !search || donor.donorName.toLowerCase().includes(search.toLowerCase()));
    const direction = sortDirection === "asc" ? 1 : -1;

    return filtered.sort((a, b) => {
      if (sortKey === NAME_SORT_KEY) return a.donorName.localeCompare(b.donorName) * direction;
      if (sortKey === TOTAL_SORT_KEY) return (a.total - b.total) * direction;
      return ((a.amounts[sortKey] ?? 0) - (b.amounts[sortKey] ?? 0)) * direction;
    });
  }, [donors, search, sortKey, sortDirection]);

  const toggleSort = (key: string) => {
    if (key === sortKey) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const monthTotals = useMemo(
    () => months.map((month) => sortedDonors.reduce((sum, donor) => sum + (donor.amounts[month.key] ?? 0), 0)),
    [months, sortedDonors]
  );

  const grandTotal = sortedDonors.reduce((sum, donor) => sum + donor.total, 0);
  const contributingCount = sortedDonors.filter((donor) => donor.total > 0).length;
  const averagePerContributor = contributingCount > 0 ? grandTotal / contributingCount : 0;

  const metricsExportHeaders = ["Metric", "Value"];
  const metricsExportRows = () => [
    ["Total Collected", formatCurrency(grandTotal)],
    ["Members", sortedDonors.length],
    ["Contributing", contributingCount],
    ["Average per Contributor", formatCurrency(averagePerContributor)]
  ];

  const exportHeaders = ["Member", ...months.map((month) => month.label), "Total"];
  const exportRows = () =>
    sortedDonors.map((donor) => [
      donor.donorName,
      ...months.map((month) => {
        const amount = donor.amounts[month.key] ?? 0;
        return amount > 0 ? formatCurrency(amount) : "—";
      }),
      formatCurrency(donor.total)
    ]);

  const exportSections = (): ExportSection[] => [
    { title: "Metrics", headers: metricsExportHeaders, rows: metricsExportRows() },
    { title: "Member Monthly Donation", headers: exportHeaders, rows: exportRows() }
  ];

  return (
    <div>
      <div className="metric-grid" aria-label="Monthly donations summary">
        <article className="metric-card">
          <div className="metric-head">
            <span>Total Collected</span>
          </div>
          <div className="metric-value">{formatCurrency(grandTotal)}</div>
          <div className="metric-sub">
            Last {months.length} months{months.length > 0 ? ` (${months[0].label} – ${months[months.length - 1].label})` : ""}
          </div>
        </article>
        <article className="metric-card">
          <div className="metric-head">
            <span>Members</span>
          </div>
          <div className="metric-value">{sortedDonors.length}</div>
          <div className="metric-sub">{contributingCount} contributed</div>
        </article>
        <article className="metric-card">
          <div className="metric-head">
            <span>Average per Contributor</span>
          </div>
          <div className="metric-value">{formatCurrency(averagePerContributor)}</div>
          <div className="metric-sub">Across the period</div>
        </article>
      </div>

      <ExportToolbar
        onExportCsv={() => exportSectionsToCsv("member-monthly-donation.csv", exportSections())}
        onExportHtml={() => exportSectionsToHtml("member-monthly-donation.html", "Member Monthly Donation", exportSections())}
        onExportPdf={() => printReportSection("donations")}
        onExportImage={() => exportSectionToImage("donations", "member-monthly-donation.png")}
      />

      <input
        type="text"
        placeholder="Search by name…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="filter-input no-print"
        style={{ maxWidth: 280, marginBottom: 16 }}
      />

      {sortedDonors.length > 0 ? (
        <div className="table-panel" style={{ minWidth: 0, overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <SortableTh
                  label="Member"
                  active={sortKey === NAME_SORT_KEY}
                  direction={sortDirection}
                  onClick={() => toggleSort(NAME_SORT_KEY)}
                />
                {months.map((month) => (
                  <SortableTh
                    key={month.key}
                    label={month.label}
                    active={sortKey === month.key}
                    direction={sortDirection}
                    onClick={() => toggleSort(month.key)}
                  />
                ))}
                <SortableTh
                  label="Total"
                  active={sortKey === TOTAL_SORT_KEY}
                  direction={sortDirection}
                  onClick={() => toggleSort(TOTAL_SORT_KEY)}
                />
              </tr>
            </thead>
            <tbody>
              {sortedDonors.map((donor) => (
                <tr key={donor.id}>
                  <td>{donor.donorName}</td>
                  {months.map((month) => {
                    const amount = donor.amounts[month.key] ?? 0;
                    return <td key={month.key}>{amount > 0 ? formatCurrency(amount) : "—"}</td>;
                  })}
                  <td>{formatCurrency(donor.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                {monthTotals.map((amount, index) => (
                  <td key={months[index].key}>{formatCurrency(amount)}</td>
                ))}
                <td>{formatCurrency(grandTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <p>No members match this filter.</p>
        </div>
      )}
    </div>
  );
}
