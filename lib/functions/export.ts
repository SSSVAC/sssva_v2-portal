import { formatCurrency } from "@/lib/format";
import type { ExportCell, ExportSection } from "@/lib/export";
import {
  ITEM_STATUS_LABEL,
  itemStatus,
  type FunctionDetail,
  type SectionWithItems
} from "@/lib/functions/types";

// A section's kind decides its columns on screen, so it has to decide them
// in an export too — otherwise a menu exports empty Expected/Actual columns
// and an agenda exports a Qty column it never had.
const HEADERS: Record<string, string[]> = {
  items: ["#", "Item", "Qty", "Expected", "Actual", "Ubhayam by", "Status"],
  menu: ["#", "Menu item", "Qty", "Unit", "Status"],
  schedule: ["Time", "Event"]
};

export function sectionExportHeaders(section: SectionWithItems) {
  return HEADERS[section.kind] ?? HEADERS.items;
}

function money(value: number | null) {
  return value === null ? "" : formatCurrency(value);
}

export function sectionExportRows(section: SectionWithItems): ExportCell[][] {
  if (section.kind === "schedule") {
    return section.items.map((item) => [item.time_label ?? "", item.name]);
  }

  if (section.kind === "menu") {
    return section.items.map((item, index) => [
      String(index + 1),
      item.name,
      item.qty ?? "",
      item.unit ?? "",
      ITEM_STATUS_LABEL[itemStatus(item.status)]
    ]);
  }

  const rows: ExportCell[][] = section.items.map((item, index) => [
    String(index + 1),
    item.name,
    item.qty ?? "",
    money(item.expected_amount),
    money(item.actual_amount),
    // An item with no name against it is still covered when the whole
    // section has an ubhayam, and the export should say so rather than
    // leaving a blank that reads as "nobody".
    item.sponsor ?? (section.sponsor ? `(${section.sponsor})` : ""),
    ITEM_STATUS_LABEL[itemStatus(item.status)]
  ]);

  if (section.items.length > 0) {
    rows.push([
      "",
      "Total",
      "",
      formatCurrency(section.totals.expected),
      formatCurrency(section.totals.actual),
      `${section.totals.sponsoredCount} of ${section.totals.itemCount} covered`,
      ""
    ]);
  }

  return rows;
}

/** Title as it appears on the sheet: the source numbering, then the name. */
export function sectionExportTitle(section: SectionWithItems) {
  const parts = [section.code, section.title].filter(Boolean);
  const title = parts.join(". ");
  // Parenthesised rather than dash-joined: a title like "14th — Morning"
  // already contains a dash, and "1. 14th — Morning — 10:00 AM" reads as
  // one run-on phrase.
  return section.subtitle ? `${title} (${section.subtitle})` : title;
}

export function sectionExportSection(section: SectionWithItems): ExportSection {
  return {
    title: sectionExportTitle(section),
    headers: sectionExportHeaders(section),
    rows: sectionExportRows(section)
  };
}

/**
 * The whole function: a summary block, then every section in page order.
 * Sections carrying their own vendor/settlement figures (Annathanam) get
 * those as a short block of their own, since they belong to the session
 * rather than to any one menu line.
 */
export function functionExportSections(fn: FunctionDetail): ExportSection[] {
  const summary: ExportSection = {
    title: "Summary",
    headers: ["Metric", "Value"],
    rows: [
      ["Items", String(fn.totals.itemCount)],
      ["Covered", String(fn.totals.sponsoredCount)],
      ["Still open", String(fn.totals.openCount)],
      ["Expected", formatCurrency(fn.totals.expected)],
      ["Spent", formatCurrency(fn.totals.actual)]
    ]
  };

  return [
    summary,
    ...fn.sections.flatMap((section) => {
      const own: ExportSection[] = [];

      const settlement: ExportCell[][] = [];
      if (section.sponsor) settlement.push(["Ubhayam / sponsor", section.sponsor]);
      if (section.vendor) settlement.push(["Vendor / self", section.vendor]);
      if (section.estimate_amount !== null) settlement.push(["Estimate", money(section.estimate_amount)]);
      if (section.advance_paid !== null) settlement.push(["Advance paid", money(section.advance_paid)]);
      if (section.balance_paid !== null) settlement.push(["Balance paid", money(section.balance_paid)]);

      if (settlement.length > 0) {
        own.push({
          title: `${sectionExportTitle(section)} — details`,
          headers: ["Field", "Value"],
          rows: settlement
        });
      }

      own.push(sectionExportSection(section));
      return own;
    })
  ];
}
