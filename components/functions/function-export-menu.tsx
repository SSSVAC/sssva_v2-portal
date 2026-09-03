"use client";

import { ExportMenu } from "@/components/ui/export-menu";
import {
  exportSectionsToCsv,
  exportSectionsToHtml,
  exportSectionToImage,
  exportToCsv,
  exportToHtml,
  printReportSection
} from "@/lib/export";
import {
  functionExportSections,
  sectionExportHeaders,
  sectionExportRows,
  sectionExportTitle
} from "@/lib/functions/export";
import type { FunctionDetail, SectionWithItems } from "@/lib/functions/types";

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      // Tamil section titles produce nothing here, so fall back to the code
      // or a generic name rather than an empty filename.
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "section"
  );
}

/** Whole-function export, for the tracker's page header. */
export function FunctionExportMenu({ fn }: { fn: FunctionDetail }) {
  const sections = () => functionExportSections(fn);

  return (
    <ExportMenu
      label="Export"
      onExportCsv={() => exportSectionsToCsv(`${fn.slug}.csv`, sections())}
      onExportHtml={() => exportSectionsToHtml(`${fn.slug}.html`, fn.title, sections())}
      onExportPdf={() => printReportSection(`function-${fn.slug}`)}
      onExportImage={() => exportSectionToImage(`function-${fn.slug}`, `${fn.slug}.png`)}
    />
  );
}

/** One section's own export, for its section header. */
export function SectionExportMenu({
  section,
  functionSlug,
  printId
}: {
  section: SectionWithItems;
  functionSlug: string;
  printId: string;
}) {
  const name = `${functionSlug}-${section.code ? slugify(section.code) : slugify(section.title)}`;
  const title = sectionExportTitle(section);

  return (
    <ExportMenu
      onExportCsv={() => exportToCsv(`${name}.csv`, sectionExportHeaders(section), sectionExportRows(section))}
      onExportHtml={() =>
        exportToHtml(`${name}.html`, title, sectionExportHeaders(section), sectionExportRows(section))
      }
      onExportPdf={() => printReportSection(printId)}
      onExportImage={() => exportSectionToImage(printId, `${name}.png`)}
    />
  );
}
