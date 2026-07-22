"use client";

import { useMemo } from "react";
import { formatCurrency } from "@/lib/format";
import { ExportToolbar } from "@/components/export-toolbar";
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

  const sectionExportHeaders = ["Name", "Phone", "Address", "Group", "Paid", "Balance Due"];
  const sectionExportRows = (sectionRows: (typeof followUpRows)[number][], balanceDueSubtotal: number) => [
    ...sectionRows.map((row) => [
      row.name,
      row.phone ?? "",
      row.address ?? "",
      row.group ?? "",
      formatCurrency(row.paid),
      formatCurrency(row.balanceDue)
    ]),
    ["Subtotal", "", "", "", "", formatCurrency(balanceDueSubtotal)]
  ];

  const excelSections = () =>
    sections.map((section) => ({
      status: section.status,
      sectionName: section.sectionName,
      rows: section.rows.map((row) => ({
        name: row.name,
        phone: row.phone,
        address: row.address,
        group: row.group,
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
    <div>
      <ExportToolbar
        onExportCsv={() => exportSectionsToCsv("silai-followup-report.csv", fullReportSections())}
        onExportHtml={() => exportSectionsToHtml("silai-followup-report.html", "Silai Follow-up Report", fullReportSections())}
        onExportPdf={exportPdf}
        onExportImage={exportImage}
        onExportExcel={exportExcel}
        onCopyWhatsAppText={copyWhatsAppText}
      />

      <div className="metric-grid" aria-label="Silai follow-up summary">
        <article className="metric-card">
          <div className="metric-head">
            <span>Not Paid</span>
          </div>
          <div className="metric-value">{notPaidCount}</div>
          <div className="metric-sub">Members with no contribution recorded</div>
        </article>
        <article className="metric-card">
          <div className="metric-head">
            <span>Partially Paid</span>
          </div>
          <div className="metric-value">{partiallyPaidCount}</div>
          <div className="metric-sub">Below the fund minimum</div>
        </article>
        <article className="metric-card">
          <div className="metric-head">
            <span>Total Balance Due</span>
          </div>
          <div className="metric-value">{formatCurrency(totalBalanceDue)}</div>
          <div className="metric-sub">Outstanding across both sections</div>
        </article>
      </div>

      {followUpRows.length > 0 ? (
        sections.map((section) => (
          <div key={section.status}>
            <h3>
              <span className={`status-pill ${STATUS_CLASS[section.status]}`}>{section.sectionName}</span>{" "}
              ({section.rows.length})
            </h3>
            {section.rows.length > 0 ? (
              <div className="table-panel" style={{ minWidth: 0, overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Address</th>
                      <th>Group</th>
                      <th>Paid</th>
                      <th>Balance Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.rows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.name}</td>
                        <td>{row.phone ?? "—"}</td>
                        <td>{row.address ?? "—"}</td>
                        <td>{row.group ?? "—"}</td>
                        <td>{row.paid > 0 ? formatCurrency(row.paid) : "—"}</td>
                        <td>{formatCurrency(row.balanceDue)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={5}>Subtotal</td>
                      <td>{formatCurrency(section.balanceDueSubtotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <p>No members in this section.</p>
              </div>
            )}
          </div>
        ))
      ) : (
        <div className="empty-state">
          <p>Every member has fully paid the Silai fund minimum.</p>
        </div>
      )}
    </div>
  );
}
