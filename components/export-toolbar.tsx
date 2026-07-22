"use client";

import { useState } from "react";
import { Copy, Download, FileCode, FileSpreadsheet, Image as ImageIcon, Printer } from "lucide-react";

type ExportToolbarProps = {
  onExportCsv: () => void;
  onExportHtml: () => void;
  onExportPdf: () => void;
  onExportImage: () => Promise<void>;
  onExportExcel?: () => Promise<void>;
  onCopyWhatsAppText?: () => Promise<void>;
};

export function ExportToolbar({
  onExportCsv,
  onExportHtml,
  onExportPdf,
  onExportImage,
  onExportExcel,
  onCopyWhatsAppText
}: ExportToolbarProps) {
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generatingExcel, setGeneratingExcel] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copying" | "copied">("idle");

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

  async function handleExportExcel() {
    if (!onExportExcel) return;

    setGeneratingExcel(true);
    try {
      await onExportExcel();
    } catch (error) {
      console.error("Failed to export Excel file", error);
      window.alert("Failed to export Excel file. Please try again.");
    } finally {
      setGeneratingExcel(false);
    }
  }

  async function handleCopyWhatsAppText() {
    if (!onCopyWhatsAppText) return;

    setCopyState("copying");
    try {
      await onCopyWhatsAppText();
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch (error) {
      console.error("Failed to copy summary", error);
      window.alert("Failed to copy summary. Please try again.");
      setCopyState("idle");
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
      {onExportExcel && (
        <button
          type="button"
          className="button secondary"
          disabled={generatingExcel}
          onClick={() => void handleExportExcel()}
        >
          <FileSpreadsheet size={15} />
          {generatingExcel ? "Generating…" : "Export Excel"}
        </button>
      )}
      {onCopyWhatsAppText && (
        <button
          type="button"
          className="button secondary"
          disabled={copyState === "copying"}
          onClick={() => void handleCopyWhatsAppText()}
        >
          <Copy size={15} />
          {copyState === "copied" ? "Copied!" : copyState === "copying" ? "Copying…" : "Copy for WhatsApp"}
        </button>
      )}
    </div>
  );
}
