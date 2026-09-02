"use client";

import { useMemo } from "react";
import { formatCurrency } from "@/lib/format";
import { ExportMenu } from "@/components/ui/export-menu";
import { Section } from "@/components/ui/section";
import { ReportToolbar } from "@/components/ui/report-toolbar";
import {
  exportSectionsToCsv,
  exportSectionsToHtml,
  exportSectionToImage,
  exportSilaiFollowUpToExcel,
  copySilaiFollowUpToWhatsApp,
  printReportSection,
  SILAI_FOLLOWUP_STATUS_LABEL,
  type ExportSection,
  type SilaiFollowUpStatus
} from "@/lib/export";
import { groupByStreet } from "@/lib/silai-groups";
import type { MemberRow } from "@/components/fund-status-table";

type SilaiFollowUpReportProps = {
  members: MemberRow[];
};

const PRINT_TARGET = "silai-followup";

const STATUS_CLASS: Record<SilaiFollowUpStatus, string> = {
  not_paid: "status-overdue",
  partially_paid: "status-sent"
};

const STATUSES: SilaiFollowUpStatus[] = ["not_paid", "partially_paid"];

function isFollowUpStatus(status: MemberRow["status"]): status is SilaiFollowUpStatus {
  return status === "not_paid" || status === "partially_paid";
}

// Flattens the street-grouped order back into one list per status — same
// walking order as Silai by Group, but as a single table instead of a
// sub-table per street.
function flattenInStreetOrder(rows: (MemberRow & { status: SilaiFollowUpStatus })[]) {
  return groupByStreet(rows).flatMap((group) => group.rows);
}

export function SilaiFollowUpReport({ members }: SilaiFollowUpReportProps) {
  const followUpRows = useMemo(
    () => members.filter((member): member is MemberRow & { status: SilaiFollowUpStatus } => isFollowUpStatus(member.status)),
    [members]
  );

  const sections = useMemo(
    () =>
      STATUSES.map((status) => {
        const rows = flattenInStreetOrder(followUpRows.filter((row) => row.status === status));
        const balanceDueSubtotal = rows.reduce((sum, row) => sum + row.balanceDue, 0);
        return { status, sectionName: SILAI_FOLLOWUP_STATUS_LABEL[status], rows, balanceDueSubtotal };
      }),
    [followUpRows]
  );

  const notPaidCount = followUpRows.filter((row) => row.status === "not_paid").length;
  const partiallyPaidCount = followUpRows.filter((row) => row.status === "partially_paid").length;
  const totalBalanceDue = followUpRows.reduce((sum, row) => sum + row.balanceDue, 0);

  const sectionExportHeaders = ["Name", "Phone", "Address", "Paid", "Balance Due"];
  const sectionExportRows = (sectionRows: (typeof followUpRows)[number][], balanceDueSubtotal: number) => [
    ...sectionRows.map((row) => [row.name, row.phone ?? "", row.address ?? "", formatCurrency(row.paid), formatCurrency(row.balanceDue)]),
    ["Subtotal", "", "", "", formatCurrency(balanceDueSubtotal)]
  ];

  const excelSections = () =>
    sections.map((section) => ({
      status: section.status,
      sectionName: section.sectionName,
      rows: section.rows.map((row) => ({
        name: row.name,
        phone: row.phone,
        address: row.address,
        paid: row.paid,
        balanceDue: row.balanceDue
      })),
      balanceDueSubtotal: section.balanceDueSubtotal
    }));

  const exportPdf = () => printReportSection(PRINT_TARGET);
  const exportImage = () => exportSectionToImage(PRINT_TARGET, "silai-followup-report.png");
  const exportExcel = () =>
    exportSilaiFollowUpToExcel(
      "silai-followup-report.xlsx",
      [
        { label: "Not Paid", value: notPaidCount },
        { label: "Partially Paid", value: partiallyPaidCount },
        { label: "Total Balance Due", value: totalBalanceDue }
      ],
      excelSections()
    );
  const copyWhatsAppText = () =>
    copySilaiFollowUpToWhatsApp(notPaidCount, partiallyPaidCount, totalBalanceDue, excelSections());

  const fullReportSections = (): ExportSection[] => [
    {
      title: "Metrics",
      headers: ["Metric", "Value"],
      rows: [
        ["Not Paid", notPaidCount],
        ["Partially Paid", partiallyPaidCount],
        ["Total Balance Due", formatCurrency(totalBalanceDue)]
      ]
    },
    ...sections.map((section) => ({
      title: `${section.sectionName} (${section.rows.length})`,
      headers: sectionExportHeaders,
      rows: sectionExportRows(section.rows, section.balanceDueSubtotal)
    }))
  ];

  return (
    <div className="stack">
      <ReportToolbar
        actions={
          <ExportMenu
            label="Export report"
            onExportCsv={() => exportSectionsToCsv("silai-followup-report.csv", fullReportSections())}
            onExportHtml={() =>
              exportSectionsToHtml(
                "silai-followup-report.html",
                "Silai Follow-up Report",
                fullReportSections()
              )
            }
            onExportPdf={exportPdf}
            onExportImage={exportImage}
            onExportExcel={exportExcel}
            onCopyWhatsAppText={copyWhatsAppText}
          />
        }
      >
        <span className="muted">
          {followUpRows.length} member{followUpRows.length === 1 ? "" : "s"} still to follow up
        </span>
      </ReportToolbar>

      {/* This report exists to chase what's missing, so the two counts take
          the colours their status already means elsewhere in the app, and
          the money outstanding leads. */}
      <div className="metric-grid" aria-label="Silai follow-up summary">
        <article className="metric-card" data-emphasis="lead">
          <div className="metric-head">
            <span>Total Balance Due</span>
          </div>
          <div className="metric-value">{formatCurrency(totalBalanceDue)}</div>
          <div className="metric-sub">Outstanding across both sections</div>
        </article>
        <article className="metric-card" data-state={notPaidCount > 0 ? "critical" : "positive"}>
          <div className="metric-head">
            <span>Not Paid</span>
          </div>
          <div className="metric-value">{notPaidCount}</div>
          <div className="metric-sub">Members with no contribution recorded</div>
        </article>
        <article className="metric-card" data-state={partiallyPaidCount > 0 ? "warning" : "positive"}>
          <div className="metric-head">
            <span>Partially Paid</span>
          </div>
          <div className="metric-value">{partiallyPaidCount}</div>
          <div className="metric-sub">Below the fund minimum</div>
        </article>
      </div>

      {followUpRows.length > 0 ? (
        sections.map((section) => (
          <Section
            key={section.status}
            count={section.rows.length}
            title={
              <span className={`status-pill ${STATUS_CLASS[section.status]}`}>{section.sectionName}</span>
            }
          >
            {section.rows.length > 0 ? (
              <div className="table-panel-scroll">
                <table className="data-table data-table-cards">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Address</th>
                      <th className="num">Paid</th>
                      <th className="num">Balance Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.rows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.name}</td>
                        <td data-label="Phone">{row.phone ?? "—"}</td>
                        <td data-label="Address">{row.address ?? "—"}</td>
                        <td data-label="Paid" className="num">
                          {row.paid > 0 ? formatCurrency(row.paid) : "—"}
                        </td>
                        <td data-label="Balance Due" className="num">
                          {formatCurrency(row.balanceDue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4}>Subtotal</td>
                      <td data-label="Balance Due" className="num">
                        {formatCurrency(section.balanceDueSubtotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <p>No members in this section.</p>
              </div>
            )}
          </Section>
        ))
      ) : (
        <div className="empty-state">
          <p>Every member has fully paid the Silai fund minimum.</p>
        </div>
      )}
    </div>
  );
}
