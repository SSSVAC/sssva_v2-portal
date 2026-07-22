import { formatCurrency } from "@/lib/format";

export type ExportColumn = {
  label: string;
};

// A plain string/number renders as-is. The object form additionally colors
// the cell's background in HTML exports (CSV/Excel ignore `highlight` and
// just use the value) — e.g. flagging amounts that cross a threshold.
export type ExportCell = string | number | { value: string | number; highlight?: "success" | "warning" };

function cellValue(cell: ExportCell): string | number {
  return typeof cell === "object" ? cell.value : cell;
}

function downloadBlob(filename: string, content: BlobPart, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeCsvCell(value: string | number) {
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportToCsv(filename: string, headers: string[], rows: ExportCell[][]) {
  exportSectionsToCsv(filename, [{ title: null, headers, rows }]);
}

export type ExportSection = {
  title: string | null;
  headers: string[];
  rows: ExportCell[][];
};

// Concatenates multiple header+rows tables into a single CSV file, each
// preceded by an optional title line and separated by a blank line, so a
// report made of several distinct tables can still be exported as one file.
export function exportSectionsToCsv(filename: string, sections: ExportSection[]) {
  const blocks = sections.map((section) => {
    const lines = [section.headers, ...section.rows.map((row) => row.map(cellValue))].map((row) =>
      row.map(escapeCsvCell).join(",")
    );
    return section.title ? [escapeCsvCell(section.title), ...lines].join("\r\n") : lines.join("\r\n");
  });

  // Leading BOM so Excel opens the file as UTF-8 (needed for Tamil text).
  downloadBlob(filename, "﻿" + blocks.join("\r\n\r\n"), "text/csv;charset=utf-8;");
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Each <td> carries a data-label matching its column header. On desktop
// this is unused; on mobile the table collapses into a per-row card and
// data-label supplies the "field name" next to each value via ::before,
// since a shrunk/scrolling table is unreadable on a phone screen.
function renderHtmlTable(headers: string[], rows: ExportCell[][]) {
  const theadHtml = `<tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>`;
  const tbodyHtml = rows
    .map(
      (row) =>
        `<tr>${row
          .map((cell, index) => {
            const highlight = typeof cell === "object" ? cell.highlight : undefined;
            const classAttr = highlight ? ` class="cell-${highlight}"` : "";
            return `<td data-label="${escapeHtml(headers[index] ?? "")}"${classAttr}>${escapeHtml(String(cellValue(cell)))}</td>`;
          })
          .join("")}</tr>`
    )
    .join("");

  return `<div class="table-wrap"><table><thead>${theadHtml}</thead><tbody>${tbodyHtml}</tbody></table></div>`;
}

function buildHtmlDocument(title: string, bodyHtml: string) {
  const generatedOn = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date());

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 32px;
    background: #f7f8fa;
    color: #18202f;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  h1 { margin: 0 0 4px; font-size: 22px; }
  h2 { margin: 28px 0 8px; font-size: 16px; }
  h2:first-of-type { margin-top: 8px; }
  .meta { margin: 0 0 20px; color: #6b7280; font-size: 13px; }
  .table-wrap {
    overflow-x: auto;
    border: 1px solid #d9dee7;
    border-radius: 8px;
    background: #ffffff;
  }
  table { border-collapse: collapse; width: 100%; min-width: 480px; }
  th, td {
    padding: 10px 14px;
    text-align: left;
    font-size: 14px;
    white-space: nowrap;
    border-bottom: 1px solid #e5e7eb;
  }
  th {
    background: #f3f4f6;
    color: #6b7280;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }
  tbody tr:nth-child(even) { background: #fafafa; }
  tbody tr:last-child td { border-bottom: none; }
  .cell-success { background: #dcfce7; color: #166534; font-weight: 700; }
  .cell-warning { background: #fef3c7; color: #854d0e; font-weight: 700; }
  @media (max-width: 640px) {
    body { padding: 16px; }
    h1 { font-size: 18px; }
    h2 { font-size: 14px; margin: 20px 0 6px; }
    /* Card layout: a shrunk or horizontally-scrolling table is unreadable
       on a phone, so each row becomes its own card with label: value
       lines instead (data-label set per cell in renderHtmlTable). */
    .table-wrap { overflow-x: visible; border: none; border-radius: 0; background: none; }
    table, tbody { display: block; width: 100%; min-width: 0; }
    thead { display: none; }
    tr {
      display: block;
      margin-bottom: 12px;
      padding: 4px 12px;
      background: #ffffff;
      border: 1px solid #d9dee7;
      border-radius: 8px;
    }
    tbody tr:nth-child(even) { background: #ffffff; }
    td {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 16px;
      padding: 8px 0;
      border-bottom: 1px solid #f1f3f5;
      font-size: 14px;
      white-space: normal;
      text-align: right;
    }
    td:last-child { border-bottom: none; }
    td::before {
      content: attr(data-label);
      flex-shrink: 0;
      color: #6b7280;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      text-align: left;
    }
    td:empty { display: none; }
  }
  @media print {
    body { background: #fff; padding: 0; }
    .table-wrap { border: none; }
  }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<p class="meta">Generated ${escapeHtml(generatedOn)}</p>
${bodyHtml}
</body>
</html>`;
}

export function exportToHtml(filename: string, title: string, headers: string[], rows: ExportCell[][]) {
  downloadBlob(filename, buildHtmlDocument(title, renderHtmlTable(headers, rows)), "text/html;charset=utf-8;");
}

// Same multi-table composition as exportSectionsToCsv, rendered as one HTML
// page with a heading per section.
export function exportSectionsToHtml(filename: string, title: string, sections: ExportSection[]) {
  const bodyHtml = sections
    .map((section) => {
      const heading = section.title ? `<h2>${escapeHtml(section.title)}</h2>` : "";
      return `${heading}${renderHtmlTable(section.headers, section.rows)}`;
    })
    .join("");

  downloadBlob(filename, buildHtmlDocument(title, bodyHtml), "text/html;charset=utf-8;");
}

// Renders the report section marked with data-print-id="target" to a PNG at
// 1.5x its on-screen size, via html-to-image's SVG foreignObject approach
// (renders Tamil/unicode text correctly, unlike html2canvas's manual glyph
// drawing — the same reason printReportSection below uses the browser's
// native print path for PDF instead of a canvas screenshot library).
// Elements marked .no-print (filters, action toolbars, the export buttons
// themselves) are excluded, matching what print/PDF already hides.
export async function exportSectionToImage(target: string, filename: string) {
  const element = document.querySelector<HTMLElement>(`[data-print-id="${target}"]`);
  if (!element) return;

  const { toPng } = await import("html-to-image");
  const dataUrl = await toPng(element, {
    pixelRatio: 1.5,
    backgroundColor: "#ffffff",
    cacheBust: true,
    filter: (node) => !(node instanceof HTMLElement && node.classList.contains("no-print"))
  });

  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export type ExcelGroupSection = {
  groupName: string;
  rows: { name: string; phone: string | null; address: string | null; total: number }[];
  subtotal: number;
};

const EXCEL_HEADER_FILL = "FF0F766E"; // --primary
const EXCEL_GROUP_FILL = "FFE6F4F1"; // light tint of --primary
const EXCEL_SUBTOTAL_FILL = "FFDCFCE7"; // matches .status-paid
const EXCEL_CURRENCY_FORMAT = '"₹"#,##0;-"₹"#,##0;"—"';

// Builds a real, styled .xlsx (colored group/header/subtotal rows, borders,
// currency number formatting on actual numeric cells) via ExcelJS, rather
// than a plain CSV or an HTML-table-as-.xls trick — for a report meant to be
// printed/handed out, cell-level color and formatting is the point.
export async function exportSilaiGroupedToExcel(
  filename: string,
  metrics: { label: string; value: string | number }[],
  groups: ExcelGroupSection[]
) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Silai by Group");

  sheet.columns = [
    { key: "name", width: 32 },
    { key: "phone", width: 18 },
    { key: "address", width: 44 },
    { key: "total", width: 16 }
  ];

  const titleRow = sheet.addRow(["Silai by Group Report"]);
  titleRow.font = { bold: true, size: 16 };
  sheet.mergeCells(titleRow.number, 1, titleRow.number, 4);

  const generatedRow = sheet.addRow([
    `Generated ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date())}`
  ]);
  generatedRow.font = { color: { argb: "FF6B7280" }, italic: true };
  sheet.mergeCells(generatedRow.number, 1, generatedRow.number, 4);

  sheet.addRow([]);

  metrics.forEach((metric) => {
    const row = sheet.addRow([metric.label, "", "", metric.value]);
    row.font = { bold: true };
    if (typeof metric.value === "number") {
      row.getCell(4).numFmt = EXCEL_CURRENCY_FORMAT;
    }
  });

  sheet.addRow([]);

  groups.forEach((group) => {
    const groupRow = sheet.addRow([`${group.groupName} (${group.rows.length})`]);
    groupRow.font = { bold: true, color: { argb: "FF115E59" } };
    groupRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EXCEL_GROUP_FILL } };
    });
    sheet.mergeCells(groupRow.number, 1, groupRow.number, 4);

    const headerRow = sheet.addRow(["Name", "Phone", "Address", "Total"]);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EXCEL_HEADER_FILL } };
    });

    group.rows.forEach((row) => {
      const dataRow = sheet.addRow([row.name, row.phone ?? "", row.address ?? "", row.total]);
      dataRow.getCell(4).numFmt = EXCEL_CURRENCY_FORMAT;
    });

    const subtotalRow = sheet.addRow(["Subtotal", "", "", group.subtotal]);
    subtotalRow.font = { bold: true };
    subtotalRow.getCell(4).numFmt = EXCEL_CURRENCY_FORMAT;
    subtotalRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EXCEL_SUBTOTAL_FILL } };
    });

    sheet.addRow([]);
  });

  sheet.eachRow((row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      cell.border = { bottom: { style: "thin", color: { argb: "FFE5E7EB" } } };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(filename, buffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}

export type SilaiFollowUpStatus = "not_paid" | "partially_paid";

export type ExcelFollowUpGroupSection = {
  groupName: string;
  rows: {
    name: string;
    phone: string | null;
    address: string | null;
    status: SilaiFollowUpStatus;
    paid: number;
    balanceDue: number;
  }[];
  balanceDueSubtotal: number;
};

const EXCEL_STATUS_LABEL: Record<SilaiFollowUpStatus, string> = {
  not_paid: "Not Paid",
  partially_paid: "Partially Paid"
};

const EXCEL_STATUS_FILL: Record<SilaiFollowUpStatus, string> = {
  not_paid: "FFFEE2E2", // matches .status-overdue
  partially_paid: "FFFEF3C7" // matches .status-sent
};

const EXCEL_STATUS_FONT: Record<SilaiFollowUpStatus, string> = {
  not_paid: "FF991B1B",
  partially_paid: "FF854D0E"
};

// Same styling approach as exportSilaiGroupedToExcel, for the "who still
// needs to pay/finish paying" follow-up list — status cells get the same
// red/yellow used by the on-screen status pills.
export async function exportSilaiFollowUpToExcel(
  filename: string,
  metrics: { label: string; value: string | number }[],
  groups: ExcelFollowUpGroupSection[]
) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Silai Follow-up");

  sheet.columns = [
    { key: "name", width: 32 },
    { key: "phone", width: 18 },
    { key: "address", width: 44 },
    { key: "status", width: 16 },
    { key: "paid", width: 14 },
    { key: "balanceDue", width: 14 }
  ];

  const titleRow = sheet.addRow(["Silai Follow-up Report"]);
  titleRow.font = { bold: true, size: 16 };
  sheet.mergeCells(titleRow.number, 1, titleRow.number, 6);

  const generatedRow = sheet.addRow([
    `Generated ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date())}`
  ]);
  generatedRow.font = { color: { argb: "FF6B7280" }, italic: true };
  sheet.mergeCells(generatedRow.number, 1, generatedRow.number, 6);

  sheet.addRow([]);

  metrics.forEach((metric) => {
    const row = sheet.addRow([metric.label, "", "", "", "", metric.value]);
    row.font = { bold: true };
    if (typeof metric.value === "number") {
      row.getCell(6).numFmt = EXCEL_CURRENCY_FORMAT;
    }
  });

  sheet.addRow([]);

  groups.forEach((group) => {
    const groupRow = sheet.addRow([`${group.groupName} (${group.rows.length})`]);
    groupRow.font = { bold: true, color: { argb: "FF115E59" } };
    groupRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EXCEL_GROUP_FILL } };
    });
    sheet.mergeCells(groupRow.number, 1, groupRow.number, 6);

    const headerRow = sheet.addRow(["Name", "Phone", "Address", "Status", "Paid", "Balance Due"]);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EXCEL_HEADER_FILL } };
    });

    group.rows.forEach((row) => {
      const dataRow = sheet.addRow([
        row.name,
        row.phone ?? "",
        row.address ?? "",
        EXCEL_STATUS_LABEL[row.status],
        row.paid,
        row.balanceDue
      ]);
      dataRow.getCell(5).numFmt = EXCEL_CURRENCY_FORMAT;
      dataRow.getCell(6).numFmt = EXCEL_CURRENCY_FORMAT;
      const statusCell = dataRow.getCell(4);
      statusCell.font = { bold: true, color: { argb: EXCEL_STATUS_FONT[row.status] } };
      statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EXCEL_STATUS_FILL[row.status] } };
    });

    const subtotalRow = sheet.addRow(["Subtotal", "", "", "", "", group.balanceDueSubtotal]);
    subtotalRow.font = { bold: true };
    subtotalRow.getCell(6).numFmt = EXCEL_CURRENCY_FORMAT;
    subtotalRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EXCEL_SUBTOTAL_FILL } };
    });

    sheet.addRow([]);
  });

  sheet.eachRow((row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      cell.border = { bottom: { style: "thin", color: { argb: "FFE5E7EB" } } };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(filename, buffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}

// Falls back to a hidden textarea + execCommand for browsers/contexts where
// navigator.clipboard is unavailable (e.g. no secure context).
async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    if (!document.execCommand("copy")) {
      throw new Error("Copy command was not successful");
    }
  } finally {
    document.body.removeChild(textarea);
  }
}

// WhatsApp-ready text (*bold*/_italic_ are WhatsApp's own markdown) with the
// same per-contributor detail as the other exports — name, phone, address,
// amount — grouped and subtotaled, so a group leader can paste the whole
// roster into a chat rather than just a totals summary.
export async function copySilaiGroupedToWhatsApp(
  totalCollected: number,
  contributorCount: number,
  groups: ExcelGroupSection[]
) {
  const generatedOn = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date());

  const lines = [
    "*Silai by Group Report*",
    "சிலை வைப்பதற்கான நிதி",
    "",
    `*Total Collected:* ${formatCurrency(totalCollected)}`,
    `*Contributors:* ${contributorCount}`,
    ""
  ];

  groups.forEach((group) => {
    lines.push(`*${group.groupName} (${group.rows.length})*`);

    group.rows.forEach((row, index) => {
      const parts = [row.name, row.phone, row.address].filter((part): part is string => Boolean(part));
      const amount = row.total > 0 ? formatCurrency(row.total) : "—";
      lines.push(`${index + 1}. ${parts.join(" - ")} - ${amount}`);
    });

    lines.push(`*Subtotal:* ${formatCurrency(group.subtotal)}`, "");
  });

  lines.push(`_Generated ${generatedOn}_`);

  await copyTextToClipboard(lines.join("\n"));
}

// Same shape as copySilaiGroupedToWhatsApp, for the not-paid/partially-paid
// follow-up list — status plus paid/balance due per contributor.
export async function copySilaiFollowUpToWhatsApp(
  notPaidCount: number,
  partiallyPaidCount: number,
  totalBalanceDue: number,
  groups: ExcelFollowUpGroupSection[]
) {
  const generatedOn = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date());

  const lines = [
    "*Silai Follow-up Report*",
    "சிலை வைப்பதற்கான நிதி",
    "",
    `*Not Paid:* ${notPaidCount}`,
    `*Partially Paid:* ${partiallyPaidCount}`,
    `*Total Balance Due:* ${formatCurrency(totalBalanceDue)}`,
    ""
  ];

  groups.forEach((group) => {
    lines.push(`*${group.groupName} (${group.rows.length})*`);

    group.rows.forEach((row, index) => {
      const parts = [row.name, row.phone, row.address].filter((part): part is string => Boolean(part));
      const statusLabel = EXCEL_STATUS_LABEL[row.status];
      lines.push(
        `${index + 1}. ${parts.join(" - ")} - ${statusLabel} - Paid ${formatCurrency(row.paid)} - Due ${formatCurrency(row.balanceDue)}`
      );
    });

    lines.push(`*Balance Due Subtotal:* ${formatCurrency(group.balanceDueSubtotal)}`, "");
  });

  lines.push(`_Generated ${generatedOn}_`);

  await copyTextToClipboard(lines.join("\n"));
}

// Prints only the report section marked with data-print-id="target" by
// stamping data-print-target on <body>; global print CSS uses that attribute
// to hide everything else. Lets users "Save as PDF" via the browser's print
// dialog, which renders Tamil/unicode text correctly (unlike canvas-based
// PDF libraries).
export function printReportSection(target: string) {
  document.body.setAttribute("data-print-target", target);

  const cleanup = () => {
    document.body.removeAttribute("data-print-target");
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);

  window.print();
}
