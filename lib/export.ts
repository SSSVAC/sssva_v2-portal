export type ExportColumn = {
  label: string;
};

function downloadBlob(filename: string, content: string, mimeType: string) {
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
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(","));
  // Leading BOM so Excel opens the file as UTF-8 (needed for Tamil text).
  downloadBlob(filename, "﻿" + lines.join("\r\n"), "text/csv;charset=utf-8;");
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function exportToHtml(filename: string, title: string, headers: string[], rows: (string | number)[][]) {
  const theadHtml = `<tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>`;
  const tbodyHtml = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(String(cell))}</td>`).join("")}</tr>`)
    .join("");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: system-ui, sans-serif; padding: 24px; color: #111827; }
  h1 { font-size: 20px; margin-bottom: 16px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #d1d5db; padding: 8px 10px; text-align: left; font-size: 14px; }
  th { background: #f3f4f6; }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<table>
  <thead>${theadHtml}</thead>
  <tbody>${tbodyHtml}</tbody>
</table>
</body>
</html>`;

  downloadBlob(filename, html, "text/html;charset=utf-8;");
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
