import { formatDateOnly } from "@/lib/format";

/**
 * One contribution as it was received — a single invoice, not a donor's
 * running total. The street view aggregates these per donor; the date view
 * shows them as they came in, which is why the date lives here and not on
 * SilaiContributionRow.
 */
export type SilaiContributionEntry = {
  /** The Zoho invoice id, so a donor giving twice on one day keeps two rows. */
  id: string;
  date: string | null;
  donorName: string | null;
  group: string | null;
  phone: string | null;
  address: string | null;
  total: number;
};

export type ContributionDateGroup = {
  /** The raw ISO date, or null for contributions Zoho carries no date for. */
  dateKey: string | null;
  label: string;
  rows: SilaiContributionEntry[];
  subtotal: number;
};

export const UNDATED_LABEL = "Undated";

/**
 * Newest first by default. An undated contribution has no place on a
 * timeline, so it sorts to the end whichever way the dates run rather than
 * leading the report; donor name breaks ties so the order is stable.
 */
export function sortContributionEntries(
  entries: SilaiContributionEntry[],
  direction: "asc" | "desc"
): SilaiContributionEntry[] {
  const factor = direction === "asc" ? 1 : -1;

  return [...entries].sort((a, b) => {
    if (a.date !== b.date) {
      if (!a.date) return 1;
      if (!b.date) return -1;
      // Zoho dates are ISO (YYYY-MM-DD), so lexical order is date order —
      // and doesn't drag every comparison through a Date constructor.
      return a.date.localeCompare(b.date) * factor;
    }
    return (a.donorName ?? "").localeCompare(b.donorName ?? "");
  });
}

/**
 * Buckets contributions into one group per day, the days themselves in
 * `direction` order. Mirrors the street view's shape — a run of sections,
 * each with its own subtotal — so the two views read the same way and the
 * same export path serves both.
 */
export function groupContributionsByDate(
  entries: SilaiContributionEntry[],
  direction: "asc" | "desc"
): ContributionDateGroup[] {
  const groups: ContributionDateGroup[] = [];
  let current: ContributionDateGroup | null = null;

  // The entries are already in date order, so a day ends the moment the date
  // changes — no second pass to sort the buckets back into order.
  for (const entry of sortContributionEntries(entries, direction)) {
    if (!current || current.dateKey !== entry.date) {
      current = {
        dateKey: entry.date,
        label: entry.date ? formatDateOnly(entry.date) : UNDATED_LABEL,
        rows: [],
        subtotal: 0
      };
      groups.push(current);
    }

    current.rows.push(entry);
    current.subtotal += entry.total;
  }

  return groups;
}

/**
 * Reads the Contributions view out of a report's search params, so a link to
 * `?view=date&order=asc` opens on that view server-side — the initial render
 * matches the URL instead of flashing the street view first.
 */
export function readContributionViewParams(searchParams: Record<string, string | undefined>) {
  return {
    initialContributionView: searchParams.view === "date" ? ("date" as const) : ("street" as const),
    initialDateOrder: searchParams.order === "asc" ? ("asc" as const) : ("desc" as const)
  };
}
