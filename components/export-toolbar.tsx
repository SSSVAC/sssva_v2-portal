"use client";

import { Download, FileCode, Printer } from "lucide-react";

type ExportToolbarProps = {
  onExportCsv: () => void;
  onExportHtml: () => void;
  onExportPdf: () => void;
};

export function ExportToolbar({ onExportCsv, onExportHtml, onExportPdf }: ExportToolbarProps) {
  return (
    <div className="export-toolbar no-print">
      <button type="button" className="button secondary" onClick={onExportCsv}>
        <Download size={15} />
        Export CSV
      </button>
      <button type="button" className="button secondary" onClick={onExportHtml}>
        <FileCode size={15} />
        Export HTML
      </button>
      <button type="button" className="button secondary" onClick={onExportPdf}>
        <Printer size={15} />
        Export PDF
      </button>
    </div>
  );
}
