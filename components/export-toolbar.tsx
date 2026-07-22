"use client";

import { useState } from "react";
import { Download, FileCode, Image as ImageIcon, Printer } from "lucide-react";

type ExportToolbarProps = {
  onExportCsv: () => void;
  onExportHtml: () => void;
  onExportPdf: () => void;
  onExportImage: () => Promise<void>;
};

export function ExportToolbar({ onExportCsv, onExportHtml, onExportPdf, onExportImage }: ExportToolbarProps) {
  const [generatingImage, setGeneratingImage] = useState(false);

  async function handleExportImage() {
    setGeneratingImage(true);
    try {
      await onExportImage();
    } catch (error) {
      console.error("Failed to export image", error);
      window.alert("Failed to export image. Please try again.");
    } finally {
      setGeneratingImage(false);
    }
  }

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
      <button
        type="button"
        className="button secondary"
        disabled={generatingImage}
        onClick={() => void handleExportImage()}
      >
        <ImageIcon size={15} />
        {generatingImage ? "Generating…" : "Export Image"}
      </button>
    </div>
  );
}
