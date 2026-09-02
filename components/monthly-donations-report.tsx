"use client";

import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/format";
import { Search } from "lucide-react";
import { ExportMenu } from "@/components/ui/export-menu";
import { Section } from "@/components/ui/section";
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
    <div className="stack">
      <div className="metric-grid" aria-label="Monthly donations summary">
        <article className="metric-card" data-emphasis="lead">
          <div className="metric-head">
            <span>Total Collected</span>
          </div>
          <div className="metric-value">{formatCurrency(grandTotal)}</div>
          <div className="metric-sub">
            Last {months.length} months
            {months.length > 0 ? ` (${months[0].label} – ${months[months.length - 1].label})` : ""}
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

      <Section
        title="Member Monthly Donation"
        count={`${sortedDonors.length} of ${donors.length}`}
        actions={
          <ExportMenu
            onExportCsv={() => exportSectionsToCsv("member-monthly-donation.csv", exportSections())}
            onExportHtml={() =>
              exportSectionsToHtml(
                "member-monthly-donation.html",
                "Member Monthly Donation",
                exportSections()
              )
            }
            onExportPdf={() => printReportSection("member-monthly-donation")}
            onExportImage={() =>
              exportSectionToImage("member-monthly-donation", "member-monthly-donation.png")
            }
          />
        }
      >
        <div className="records-toolbar no-print" style={{ padding: "12px 16px 0", marginBottom: 12 }}>
          <div className="searchbox">
            <Search size={14} />
            <input
              type="search"
              placeholder="Search by name…"
              aria-label="Search members by name"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="input"
              style={{ paddingTop: 6, paddingBottom: 6 }}
            />
          </div>
        </div>

        {sortedDonors.length > 0 ? (
          <div className="table-panel-scroll">
            <table className="data-table data-table-cards">
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
                      return (
                        <td key={month.key} data-label={month.label} className="num">
                          {amount > 0 ? formatCurrency(amount) : "—"}
                        </td>
                      );
                    })}
                    <td data-label="Total" className="num">
                      {formatCurrency(donor.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  {monthTotals.map((amount, index) => (
                    <td key={months[index].key} data-label={months[index].label} className="num">
                      {formatCurrency(amount)}
                    </td>
                  ))}
                  <td data-label="Total" className="num">
                    {formatCurrency(grandTotal)}
                  </td>
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
