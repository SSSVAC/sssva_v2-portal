"use client";

import { useMemo } from "react";
import { formatCurrency } from "@/lib/format";
import { ExportToolbar } from "@/components/export-toolbar";
import { exportSectionsToCsv, exportSectionsToHtml, printReportSection, type ExportSection } from "@/lib/export";

export type SilaiGroupedRow = {
  id: string;
  name: string;
  company: string | null;
  address: string | null;
  group: string | null;
  orderNumber: number | null;
  total: number;
};

type SilaiGroupedReportProps = {
  rows: SilaiGroupedRow[];
};

const OTHERS_GROUP_LABEL = "Others";
const PRINT_TARGET = "silai-grouped";

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
      if (a === OTHERS_GROUP_LABEL) return 1;
      if (b === OTHERS_GROUP_LABEL) return -1;
      return a.localeCompare(b);
    });

    return groupNames.map((groupName) => {
      const groupRows = sortWithinGroup(byGroup.get(groupName) ?? []);
      const subtotal = groupRows.reduce((sum, row) => sum + row.total, 0);
      return { groupName, rows: groupRows, subtotal };
    });
  }, [rows]);

  const totalCollected = rows.reduce((sum, row) => sum + row.total, 0);
  const contributorCount = rows.length;

  const groupExportHeaders = ["Name", "Company", "Address", "Total"];
  const groupExportRows = (groupRows: SilaiGroupedRow[], subtotal: number) => [
    ...groupRows.map((row) => [row.name, row.company ?? "", row.address ?? "", formatCurrency(row.total)]),
    ["Subtotal", "", "", formatCurrency(subtotal)]
  ];

  const exportPdf = () => printReportSection(PRINT_TARGET);

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
                    <th>Company</th>
                    <th>Address</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.name}</td>
                      <td>{row.company ?? "—"}</td>
                      <td>{row.address ?? "—"}</td>
                      <td>{formatCurrency(row.total)}</td>
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
