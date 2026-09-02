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
import type { DonationMonth } from "@/components/monthly-donations-report";

export type DonorContactRow = {
  id: string;
  donorName: string;
  address: string | null;
  amounts: Record<string, number>;
  total: number;
};

type DonorContactReportProps = {
  months: DonationMonth[];
  donors: DonorContactRow[];
};

const NAME_SORT_KEY = "name";
const ADDRESS_SORT_KEY = "address";
const TOTAL_SORT_KEY = "total";

export function DonorContactReport({ months, donors }: DonorContactReportProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string>(NAME_SORT_KEY);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const sortedDonors = useMemo(() => {
    const filtered = donors.filter(
      (donor) =>
        !search ||
        donor.donorName.toLowerCase().includes(search.toLowerCase()) ||
        (donor.address ?? "").toLowerCase().includes(search.toLowerCase())
    );
    const direction = sortDirection === "asc" ? 1 : -1;

    return filtered.sort((a, b) => {
      if (sortKey === NAME_SORT_KEY) return a.donorName.localeCompare(b.donorName) * direction;
      if (sortKey === ADDRESS_SORT_KEY) return (a.address ?? "").localeCompare(b.address ?? "") * direction;
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

  const grandTotal = sortedDonors.reduce((sum, donor) => sum + donor.total, 0);

  const metricsExportHeaders = ["Metric", "Value"];
  const metricsExportRows = () => [
    ["Contributors", sortedDonors.length],
    ["Total Collected", formatCurrency(grandTotal)]
  ];

  const exportHeaders = ["Name", "Address", ...months.map((month) => month.label), "Total"];
  const exportRows = () =>
    sortedDonors.map((donor) => [
      donor.donorName,
      donor.address ?? "",
      ...months.map((month) => {
        const amount = donor.amounts[month.key] ?? 0;
        return amount > 0 ? formatCurrency(amount) : "—";
      }),
      formatCurrency(donor.total)
    ]);

  const exportSections = (): ExportSection[] => [
    { title: "Metrics", headers: metricsExportHeaders, rows: metricsExportRows() },
    { title: "Monthly Donors", headers: exportHeaders, rows: exportRows() }
  ];

  return (
    <div className="stack">
      <div className="metric-grid" aria-label="Donor contact summary">
        <article className="metric-card" data-emphasis="lead">
          <div className="metric-head">
            <span>Total Collected</span>
          </div>
          <div className="metric-value">{formatCurrency(grandTotal)}</div>
          <div className="metric-sub">Across the period</div>
        </article>
        <article className="metric-card">
          <div className="metric-head">
            <span>Contributors</span>
          </div>
          <div className="metric-value">{sortedDonors.length}</div>
          <div className="metric-sub">
            Contributed in last {months.length} months
            {months.length > 0 ? ` (${months[0].label} – ${months[months.length - 1].label})` : ""}
          </div>
        </article>
      </div>

      <Section
        title="Monthly Donors"
        count={`${sortedDonors.length} of ${donors.length}`}
        actions={
          <ExportMenu
            onExportCsv={() => exportSectionsToCsv("monthly-donors.csv", exportSections())}
            onExportHtml={() =>
              exportSectionsToHtml("monthly-donors.html", "Monthly Donors", exportSections())
            }
            onExportPdf={() => printReportSection("monthly-donors")}
            onExportImage={() => exportSectionToImage("monthly-donors", "monthly-donors.png")}
          />
        }
      >
        <div className="records-toolbar no-print" style={{ padding: "12px 16px 0", marginBottom: 12 }}>
          <div className="searchbox">
            <Search size={14} />
            <input
              type="search"
              placeholder="Search by name or address…"
              aria-label="Search donors by name or address"
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
                  label="Name"
                  active={sortKey === NAME_SORT_KEY}
                  direction={sortDirection}
                  onClick={() => toggleSort(NAME_SORT_KEY)}
                />
                <SortableTh
                  label="Address"
                  active={sortKey === ADDRESS_SORT_KEY}
                  direction={sortDirection}
                  onClick={() => toggleSort(ADDRESS_SORT_KEY)}
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
                    <td data-label="Address">{donor.address ?? "—"}</td>
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
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <p>No contributors match this filter.</p>
          </div>
        )}
      </Section>
    </div>
  );
}
