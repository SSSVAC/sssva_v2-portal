export type ExportColumn = {
  label: string;
};

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

export function exportToCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  exportSectionsToCsv(filename, [{ title: null, headers, rows }]);
}

export type ExportSection = {
  title: string | null;
  headers: string[];
  rows: (string | number)[][];
};

// Concatenates multiple header+rows tables into a single CSV file, each
// preceded by an optional title line and separated by a blank line, so a
// report made of several distinct tables can still be exported as one file.
export function exportSectionsToCsv(filename: string, sections: ExportSection[]) {
  const blocks = sections.map((section) => {
    const lines = [section.headers, ...section.rows].map((row) => row.map(escapeCsvCell).join(","));
    return section.title ? [escapeCsvCell(section.title), ...lines].join("\r\n") : lines.join("\r\n");
  });

  // Leading BOM so Excel opens the file as UTF-8 (needed for Tamil text).
  downloadBlob(filename, "﻿" + blocks.join("\r\n\r\n"), "text/csv;charset=utf-8;");
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderHtmlTable(headers: string[], rows: (string | number)[][]) {
  const theadHtml = `<tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>`;
  const tbodyHtml = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(String(cell))}</td>`).join("")}</tr>`)
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
  @media (max-width: 640px) {
    body { padding: 16px; }
    h1 { font-size: 18px; }
    h2 { font-size: 14px; margin: 20px 0 6px; }
    table { min-width: 0; }
    th, td { padding: 8px 10px; font-size: 13px; }
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

export function exportToHtml(filename: string, title: string, headers: string[], rows: (string | number)[][]) {
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
  rows: { name: string; address: string | null; total: number }[];
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
    { key: "address", width: 44 },
    { key: "total", width: 16 }
  ];

  const titleRow = sheet.addRow(["Silai by Group Report"]);
  titleRow.font = { bold: true, size: 16 };
  sheet.mergeCells(titleRow.number, 1, titleRow.number, 3);

  const generatedRow = sheet.addRow([
    `Generated ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date())}`
  ]);
  generatedRow.font = { color: { argb: "FF6B7280" }, italic: true };
  sheet.mergeCells(generatedRow.number, 1, generatedRow.number, 3);

  sheet.addRow([]);

  metrics.forEach((metric) => {
    const row = sheet.addRow([metric.label, "", metric.value]);
    row.font = { bold: true };
    if (typeof metric.value === "number") {
      row.getCell(3).numFmt = EXCEL_CURRENCY_FORMAT;
    }
  });

  sheet.addRow([]);

  groups.forEach((group) => {
    const groupRow = sheet.addRow([`${group.groupName} (${group.rows.length})`]);
    groupRow.font = { bold: true, color: { argb: "FF115E59" } };
    groupRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EXCEL_GROUP_FILL } };
    });
    sheet.mergeCells(groupRow.number, 1, groupRow.number, 3);

    const headerRow = sheet.addRow(["Name", "Address", "Total"]);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EXCEL_HEADER_FILL } };
    });

    group.rows.forEach((row) => {
      const dataRow = sheet.addRow([row.name, row.address ?? "", row.total]);
      dataRow.getCell(3).numFmt = EXCEL_CURRENCY_FORMAT;
    });

    const subtotalRow = sheet.addRow(["Subtotal", "", group.subtotal]);
    subtotalRow.font = { bold: true };
    subtotalRow.getCell(3).numFmt = EXCEL_CURRENCY_FORMAT;
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
