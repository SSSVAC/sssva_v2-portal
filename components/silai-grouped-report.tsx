"use client";

import { useMemo } from "react";
import { formatCurrency } from "@/lib/format";
import { ExportMenu } from "@/components/ui/export-menu";
import { Section } from "@/components/ui/section";
import { SectionGroup } from "@/components/ui/section-group";
import { ReportToolbar } from "@/components/ui/report-toolbar";
import {
  exportSectionsToCsv,
  exportSectionsToHtml,
  exportSectionToImage,
  exportSilaiGroupedToExcel,
  copySilaiGroupedToWhatsApp,
  printReportSection,
  type ExportCell,
  type ExportSection
} from "@/lib/export";
import { groupByStreet } from "@/lib/silai-groups";

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

const PRINT_TARGET = "silai-by-group";

// Matches the per-member Silai fund minimum used elsewhere (Members Silai
// Contributions' fully-paid threshold). Only affects the HTML export's cell
// coloring, not the on-screen table or the other export formats.
const HIGHLIGHT_THRESHOLD = 3000;

function amountCell(total: number): ExportCell {
  const text = total > 0 ? formatCurrency(total) : "";

  if (total >= HIGHLIGHT_THRESHOLD) return { value: text, highlight: "success" };
  if (total > 0) return { value: text, highlight: "warning" };
  return text;
}

export function SilaiGroupedReport({ rows }: SilaiGroupedReportProps) {
  const groups = useMemo(() => {
    return groupByStreet(rows).map((group) => ({
      ...group,
      subtotal: group.rows.reduce((sum, row) => sum + row.total, 0)
    }));
  }, [rows]);

  const totalCollected = rows.reduce((sum, row) => sum + row.total, 0);
  const contributorCount = rows.filter((row) => row.total > 0).length;

  const groupExportHeaders = ["Name", "Phone", "Address", "Total"];
  const groupExportRows = (groupRows: SilaiGroupedRow[], subtotal: number): ExportCell[][] => [
    ...groupRows.map((row) => [row.name, row.phone ?? "", row.address ?? "", amountCell(row.total)]),
    ["Subtotal", "", "", amountCell(subtotal)]
  ];

  const excelGroups = () =>
    groups.map((group) => ({
      groupName: group.groupName,
      rows: group.rows.map((row) => ({ name: row.name, phone: row.phone, address: row.address, total: row.total })),
      subtotal: group.subtotal
    }));

  const exportPdf = () => printReportSection(PRINT_TARGET);
  const exportImage = () => exportSectionToImage(PRINT_TARGET, "silai-grouped-report.png");
  const exportExcel = () =>
    exportSilaiGroupedToExcel(
      "silai-grouped-report.xlsx",
      [
        { label: "Total Collected", value: totalCollected },
        { label: "Members Contributed", value: contributorCount }
      ],
      excelGroups()
    );
  const copyWhatsAppText = () => copySilaiGroupedToWhatsApp(totalCollected, contributorCount, excelGroups());

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
    <div className="stack">
      <ReportToolbar
        actions={
          <ExportMenu
            label="Export report"
            onExportCsv={() => exportSectionsToCsv("silai-grouped-report.csv", fullReportSections())}
            onExportHtml={() =>
              exportSectionsToHtml("silai-grouped-report.html", "Silai Grouped Report", fullReportSections())
            }
            onExportPdf={exportPdf}
            onExportImage={exportImage}
            onExportExcel={exportExcel}
            onCopyWhatsAppText={copyWhatsAppText}
          />
        }
      >
        <span className="muted">
          {contributorCount} contributor{contributorCount === 1 ? "" : "s"} across {groups.length} group
          {groups.length === 1 ? "" : "s"}
        </span>
      </ReportToolbar>

      <div className="metric-grid" aria-label="Silai grouped summary">
        <article className="metric-card" data-emphasis="lead">
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
          <div className="metric-sub">
            Across {groups.length} group{groups.length === 1 ? "" : "s"}
          </div>
        </article>
      </div>

      <SectionGroup title="Contributors by group">
        {groups.length > 0 ? (
          groups.map((group) => (
            <Section key={group.groupName} title={group.groupName} count={group.rows.length}>
              <div className="table-panel-scroll">
                <table className="data-table data-table-cards">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Address</th>
                      <th className="num">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.name}</td>
                        <td data-label="Phone">{row.phone ?? "—"}</td>
                        <td data-label="Address">{row.address ?? "—"}</td>
                        <td data-label="Total" className="num">
                          {row.total > 0 ? formatCurrency(row.total) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3}>Subtotal</td>
                      <td data-label="Total" className="num">
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
            <p>No Silai contributions recorded.</p>
          </div>
        )}
      </SectionGroup>
    </div>
  );
}
