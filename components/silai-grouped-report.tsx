"use client";

import { useMemo } from "react";
import { formatCurrency } from "@/lib/format";
import { ExportToolbar } from "@/components/export-toolbar";
import {
  exportSectionsToCsv,
  exportSectionsToHtml,
  exportSectionToImage,
  exportSilaiGroupedToExcel,
  printReportSection,
  type ExportSection
} from "@/lib/export";

export type SilaiGroupedRow = {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  address: string | null;
  group: string | null;
  orderNumber: number | null;
  total: number;
  isMember: boolean;
};

type SilaiGroupedReportProps = {
  rows: SilaiGroupedRow[];
};

const OTHERS_GROUP_LABEL = "Others";
const PRINT_TARGET = "silai-grouped";

// Groups are streets/areas with a fixed physical order the temple committee
// walks in; anything not in this list (a newly-added group not yet added
// here) sorts after the known ones and before "Others".
const GROUP_ORDER = [
  "Ramaiya Nagar",
  "Kalaignar Nagar 2nd Street",
  "Kalaignar Nagar 1st Street",
  "Kalluri Salai",
  "Kalluri Salai Cross Street",
  "Balamurugan Nagar"
];

function groupSortRank(name: string) {
  if (name === OTHERS_GROUP_LABEL) return Number.POSITIVE_INFINITY;
  const index = GROUP_ORDER.indexOf(name);
  return index === -1 ? GROUP_ORDER.length : index;
}

function sortWithinGroup(rows: SilaiGroupedRow[]) {
  return [...rows].sort((a, b) => {
    const aOrder = a.orderNumber ?? Number.POSITIVE_INFINITY;
    const bOrder = b.orderNumber ?? Number.POSITIVE_INFINITY;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.name.localeCompare(b.name);
  });
}

export function SilaiGroupedReport({ rows }: SilaiGroupedReportProps) {
  const groups = useMemo(() => {
    const byGroup = new Map<string, SilaiGroupedRow[]>();

    rows.forEach((row) => {
      const key = row.group?.trim() || OTHERS_GROUP_LABEL;
      const list = byGroup.get(key) ?? [];
      list.push(row);
      byGroup.set(key, list);
    });

    const groupNames = Array.from(byGroup.keys()).sort((a, b) => {
      const rankA = groupSortRank(a);
      const rankB = groupSortRank(b);
      if (rankA !== rankB) return rankA - rankB;
      return a.localeCompare(b);
    });

    return groupNames.map((groupName) => {
      const groupRows = sortWithinGroup(byGroup.get(groupName) ?? []);
      const subtotal = groupRows.reduce((sum, row) => sum + row.total, 0);
      return { groupName, rows: groupRows, subtotal };
    });
  }, [rows]);

  const totalCollected = rows.reduce((sum, row) => sum + row.total, 0);
  const contributorCount = rows.filter((row) => row.total > 0).length;

  const groupExportHeaders = ["Name", "Phone", "Address", "Total"];
  const groupExportRows = (groupRows: SilaiGroupedRow[], subtotal: number) => [
    ...groupRows.map((row) => [
      row.name,
      row.phone ?? "",
      row.address ?? "",
      row.total > 0 ? formatCurrency(row.total) : ""
    ]),
    ["Subtotal", "", "", formatCurrency(subtotal)]
  ];

  const exportPdf = () => printReportSection(PRINT_TARGET);
  const exportImage = () => exportSectionToImage(PRINT_TARGET, "silai-grouped-report.png");
  const exportExcel = () =>
    exportSilaiGroupedToExcel(
      "silai-grouped-report.xlsx",
      [
        { label: "Total Collected", value: totalCollected },
        { label: "Members Contributed", value: contributorCount }
      ],
      groups.map((group) => ({
        groupName: group.groupName,
        rows: group.rows.map((row) => ({ name: row.name, phone: row.phone, address: row.address, total: row.total })),
        subtotal: group.subtotal
      }))
    );

  const fullReportSections = (): ExportSection[] => [
    {
      title: "Metrics",
      headers: ["Metric", "Value"],
      rows: [
        ["Total Collected", formatCurrency(totalCollected)],
        ["Members Contributed", contributorCount]
      ]
    },
    ...groups.map((group) => ({
      title: `${group.groupName} (${group.rows.length})`,
      headers: groupExportHeaders,
      rows: groupExportRows(group.rows, group.subtotal)
    }))
  ];

  return (
    <div>
      <ExportToolbar
        onExportCsv={() => exportSectionsToCsv("silai-grouped-report.csv", fullReportSections())}
        onExportHtml={() => exportSectionsToHtml("silai-grouped-report.html", "Silai Grouped Report", fullReportSections())}
        onExportPdf={exportPdf}
        onExportImage={exportImage}
        onExportExcel={exportExcel}
      />

      <div className="metric-grid" aria-label="Silai grouped summary">
        <article className="metric-card">
          <div className="metric-head">
            <span>Total Collected</span>
          </div>
          <div className="metric-value">{formatCurrency(totalCollected)}</div>
          <div className="metric-sub">சிலை வைப்பதற்கான நிதி — all contributors, all time</div>
        </article>
        <article className="metric-card">
          <div className="metric-head">
            <span>Members Contributed</span>
          </div>
          <div className="metric-value">{contributorCount}</div>
          <div className="metric-sub">Across {groups.length} group{groups.length === 1 ? "" : "s"}</div>
        </article>
      </div>

      {groups.length > 0 ? (
        groups.map((group) => (
          <div key={group.groupName}>
            <h3>
              {group.groupName} ({group.rows.length})
            </h3>
            <div className="table-panel" style={{ minWidth: 0, overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Address</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.name}</td>
                      <td>{row.phone ?? "—"}</td>
                      <td>{row.address ?? "—"}</td>
                      <td>{row.total > 0 ? formatCurrency(row.total) : "—"}</td>
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
          <p>No Silai contributions recorded.</p>
        </div>
      )}
    </div>
  );
}
