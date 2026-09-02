import type { Database } from "@/types/database";

export type FunctionRow = Database["public"]["Tables"]["event_functions"]["Row"];
export type SectionRow = Database["public"]["Tables"]["function_sections"]["Row"];
export type ItemRow = Database["public"]["Tables"]["function_items"]["Row"];

/** Which columns a section renders. See supabase/schema.sql for why. */
export type SectionKind = "items" | "menu" | "schedule";

export const SECTION_KINDS: { id: SectionKind; label: string; description: string }[] = [
  { id: "items", label: "Requirements", description: "Item, quantity, expected ₹, actual ₹, ubhayam" },
  { id: "menu", label: "Menu", description: "Item, quantity, unit — settled per section, not per line" },
  { id: "schedule", label: "Schedule", description: "Time and event, no costs" }
];

export const ITEM_STATUSES = ["pending", "committed", "purchased", "done"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const ITEM_STATUS_LABEL: Record<ItemStatus, string> = {
  pending: "Pending",
  committed: "Committed",
  purchased: "Purchased",
  done: "Done"
};

// Status colour follows the same rule as the rest of the app: it describes
// the state of the value, so it maps to the semantic pills rather than to a
// per-status decorative hue.
export const ITEM_STATUS_PILL: Record<ItemStatus, string> = {
  pending: "pill-neutral",
  committed: "pill-warning",
  purchased: "pill-info",
  done: "pill-success"
};

export const FUNCTION_STATUSES = ["planning", "active", "completed", "archived"] as const;
export type FunctionStatus = (typeof FUNCTION_STATUSES)[number];

export type SectionTotals = {
  itemCount: number;
  sponsoredCount: number;
  /** Items with no sponsor on a section that has no section-wide sponsor. */
  openCount: number;
  expected: number;
  actual: number;
};

export type SectionWithItems = SectionRow & {
  items: ItemRow[];
  totals: SectionTotals;
};

export type FunctionDetail = FunctionRow & {
  sections: SectionWithItems[];
  totals: SectionTotals & { sectionCount: number };
};

export type FunctionSummary = FunctionRow & {
  sectionCount: number;
  itemCount: number;
  sponsoredCount: number;
  expected: number;
  actual: number;
};

export function isSectionKind(value: string): value is SectionKind {
  return value === "items" || value === "menu" || value === "schedule";
}

export function itemStatus(value: string): ItemStatus {
  return (ITEM_STATUSES as readonly string[]).includes(value) ? (value as ItemStatus) : "pending";
}
