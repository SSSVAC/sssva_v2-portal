import type { ReportCategory } from "@/lib/reports/types";

// Each report family has ONE fixed identity colour, used for its sidebar
// dot, its gallery-card edge and its category chip. Fixed per family, never
// rotated by position — that was the old metric-card accent bug, where a
// tile's colour depended on where it happened to sit in the grid.
export const CATEGORY_ACCENT: Record<ReportCategory, string> = {
  financial: "var(--cat-financial)",
  silai: "var(--cat-silai)",
  events: "var(--cat-events)"
};

export const CATEGORY_ACCENT_SOFT: Record<ReportCategory, string> = {
  financial: "var(--cat-financial-soft)",
  silai: "var(--cat-silai-soft)",
  events: "var(--cat-events-soft)"
};

export const RECORD_TABLES = [
  { id: "customers", label: "Customers" },
  { id: "invoices", label: "Invoices" },
  { id: "expenses", label: "Expenses" },
  { id: "bills", label: "Bills" }
] as const;

export type RecordTableId = (typeof RECORD_TABLES)[number]["id"];
