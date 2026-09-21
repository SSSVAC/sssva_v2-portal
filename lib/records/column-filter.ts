import type { RecordColumn } from "@/components/editable-data-table";

/** The per-column filter value that means "rows with nothing in this column". */
export const EMPTY_FILTER_VALUE = "__empty__";

/**
 * Does one cell pass one column filter?
 *
 * Text and date columns match on a substring, which is what makes them
 * useful: "nagar" finds every address on it, and "2026-09" a whole month.
 *
 * Numbers don't work that way. A total of ₹500 read as the string "500"
 * matched 1500, 2500 and 500.50 as well, so filtering the invoices for a
 * ₹500 contribution returned every amount that merely contained those
 * digits. A number filter is therefore an exact value: the typed figure is
 * parsed and compared numerically, so 500 finds 500 and "500.00" alike, and
 * nothing else. The search box above the table still matches loosely across
 * every column for when a fuzzy look-up is what's wanted.
 */
export function matchesColumnFilter(
  type: RecordColumn["type"],
  rawValue: unknown,
  filterValue: string
): boolean {
  if (!filterValue) return true;

  if (type === "boolean") {
    return String(Boolean(rawValue)) === filterValue;
  }

  if (type === "select" && filterValue === EMPTY_FILTER_VALUE) {
    return rawValue === null || rawValue === undefined || rawValue === "";
  }

  if (type === "number") {
    const target = Number(filterValue.trim());
    // A filter that isn't a number can't match one. Half-typed input ("-",
    // "1e") lands here and shows nothing until it parses, rather than
    // silently falling back to matching every row.
    if (!Number.isFinite(target)) return false;

    // An empty cell is not zero: Number(null) is 0, which would put every
    // blank balance in the results for a filter of 0.
    if (rawValue === null || rawValue === undefined || rawValue === "") return false;

    const value = Number(rawValue);
    return Number.isFinite(value) && value === target;
  }

  return String(rawValue ?? "")
    .toLowerCase()
    .includes(filterValue.toLowerCase());
}
