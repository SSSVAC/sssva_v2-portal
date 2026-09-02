"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  Download,
  FileCode,
  FileSpreadsheet,
  Image as ImageIcon,
  Printer
} from "lucide-react";

export type ExportMenuProps = {
  onExportCsv: () => void;
  onExportHtml: () => void;
  onExportPdf: () => void;
  onExportImage: () => Promise<void>;
  onExportExcel?: () => Promise<void>;
  onCopyWhatsAppText?: () => Promise<void>;
  /** Button label. Defaults to "Export". */
  label?: string;
  /** Opens flush-left instead of flush-right — for menus near the left edge. */
  alignLeft?: boolean;
};

// Every export a section offers, behind one button. Same callbacks the old
// six-button toolbar took, so call sites only had to move — not rewire.
export function ExportMenu({
  onExportCsv,
  onExportHtml,
  onExportPdf,
  onExportImage,
  onExportExcel,
  onCopyWhatsAppText,
  label = "Export",
  alignLeft = false
}: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<null | "image" | "excel" | "copy">(null);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function runSync(action: () => void) {
    setOpen(false);
    action();
  }

  async function runAsync(kind: "image" | "excel" | "copy", action: () => Promise<void>) {
    setBusy(kind);
    try {
      await action();
      if (kind === "copy") {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
      setOpen(false);
    } catch (error) {
      console.error(`Export failed (${kind})`, error);
      window.alert("That export failed. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="menu no-print" ref={rootRef}>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Download size={14} />
        {label}
      </button>

      {open && (
        <div className={`menu-list${alignLeft ? " menu-list-left" : ""}`} role="menu">
          <div className="menu-label">Download</div>
          <button type="button" role="menuitem" className="menu-item" onClick={() => runSync(onExportCsv)}>
            <Download size={14} />
            CSV
          </button>
          {onExportExcel && (
            <button
              type="button"
              role="menuitem"
              className="menu-item"
              disabled={busy === "excel"}
              onClick={() => void runAsync("excel", onExportExcel)}
            >
              <FileSpreadsheet size={14} />
              {busy === "excel" ? "Generating…" : "Excel"}
            </button>
          )}
          <button type="button" role="menuitem" className="menu-item" onClick={() => runSync(onExportHtml)}>
            <FileCode size={14} />
            HTML
          </button>
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            disabled={busy === "image"}
            onClick={() => void runAsync("image", onExportImage)}
          >
            <ImageIcon size={14} />
            {busy === "image" ? "Generating…" : "Image (PNG)"}
          </button>

          <div className="menu-sep" />

          <button type="button" role="menuitem" className="menu-item" onClick={() => runSync(onExportPdf)}>
            <Printer size={14} />
            Print / Save as PDF
          </button>
          {onCopyWhatsAppText && (
            <button
              type="button"
              role="menuitem"
              className="menu-item"
              disabled={busy === "copy"}
              onClick={() => void runAsync("copy", onCopyWhatsAppText)}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copied!" : busy === "copy" ? "Copying…" : "Copy for WhatsApp"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
