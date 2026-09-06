import { describe, expect, it } from "vitest";
import { buildRecentCollectionText, sumDays, takeRecentDays } from "./recent-collection";
import { groupContributionsByDate, type SilaiContributionEntry } from "./contribution-entries";

function entry(
  overrides: Partial<SilaiContributionEntry> & { id: string; total: number }
): SilaiContributionEntry {
  return {
    date: null,
    donorName: null,
    group: null,
    phone: null,
    address: null,
    ...overrides
  };
}

const ENTRIES: SilaiContributionEntry[] = [
  entry({ id: "i1", date: "2026-09-05", donorName: "Suresh", address: "Ponmuthu Nagar", total: 500 }),
  entry({ id: "i2", date: "2026-09-04", donorName: "Lakshmi", address: "Kalluri Salai", total: 3000 }),
  entry({ id: "i3", date: "2026-09-04", donorName: "Ravi", address: null, total: 1200 }),
  entry({ id: "i4", date: "2026-09-02", donorName: "Anand", address: "Bazaar Street", total: 250 }),
  entry({ id: "i5", date: "2026-08-30", donorName: "Kumar", address: "Bazaar Street", total: 100 }),
  entry({ id: "i6", date: null, donorName: "Undated donor", total: 999 })
];

const METRICS = [
  { label: "Total Contributions", value: "₹5,050" },
  { label: "Bills Due", value: "₹0" }
];

const NOW = new Date("2026-09-06T04:00:00Z");

describe("takeRecentDays", () => {
  it("takes the most recent collection days, newest first", () => {
    const groups = takeRecentDays(groupContributionsByDate(ENTRIES, "desc"));

    expect(groups.map((group) => group.dateKey)).toEqual(["2026-09-05", "2026-09-04", "2026-09-02"]);
  });

  it("orders by date regardless of how the caller's groups are sorted", () => {
    const ascending = takeRecentDays(groupContributionsByDate(ENTRIES, "asc"));

    expect(ascending.map((group) => group.dateKey)).toEqual([
      "2026-09-05",
      "2026-09-04",
      "2026-09-02"
    ]);
  });

  it("leaves out undated contributions, which have no place on a timeline", () => {
    const groups = takeRecentDays(groupContributionsByDate(ENTRIES, "desc"), 10);

    expect(groups.every((group) => group.dateKey !== null)).toBe(true);
    expect(groups).toHaveLength(4);
  });

  it("returns what there is when the fund has fewer days than asked for", () => {
    const groups = takeRecentDays(groupContributionsByDate(ENTRIES.slice(0, 1), "desc"));

    expect(groups).toHaveLength(1);
  });

  it("sums only the days it was given", () => {
    expect(sumDays(takeRecentDays(groupContributionsByDate(ENTRIES, "desc")))).toBe(4950);
  });
});

describe("buildRecentCollectionText", () => {
  const text = buildRecentCollectionText({
    title: "Silai Fund Report",
    subtitle: "சிலை வைப்பதற்கான நிதி — all time",
    metrics: METRICS,
    groups: groupContributionsByDate(ENTRIES, "desc"),
    now: NOW
  });

  it("leads with the report's headline figures", () => {
    expect(text.startsWith("*Silai Fund Report*")).toBe(true);
    expect(text).toContain("*Total Contributions:* ₹5,050");
    expect(text).toContain("*Bills Due:* ₹0");
  });

  it("lists each of the last three days with its own subtotal", () => {
    expect(text).toContain("*Last 3 collection days*");
    expect(text).toContain("*4 Sept 2026* — ₹4,200 · 2 contributions");
    expect(text).toContain("*5 Sept 2026* — ₹500 · 1 contribution");
    expect(text).toContain("1. Suresh - Ponmuthu Nagar - ₹500");
    expect(text).toContain("2. Ravi - ₹1,200");
    expect(text).toContain("*Collected in these 3 days:* ₹4,950 from 4 contributions");
  });

  it("stops at the days it shared, not the whole fund", () => {
    expect(text).not.toContain("Kumar");
    expect(text).not.toContain("Undated donor");
  });

  it("never claims more days than were collected on", () => {
    const single = buildRecentCollectionText({
      title: "Silai Fund Report",
      metrics: METRICS,
      groups: groupContributionsByDate(ENTRIES.slice(0, 1), "desc"),
      now: NOW
    });

    expect(single).toContain("*Latest collection day*");
    expect(single).toContain("*Collected on this day:* ₹500 from 1 contribution");
  });

  it("says so rather than promising days a new fund doesn't have", () => {
    const empty = buildRecentCollectionText({
      title: "Silai Fund Report",
      metrics: METRICS,
      groups: groupContributionsByDate([], "desc"),
      now: NOW
    });

    expect(empty).toContain("_No dated contributions recorded yet._");
    expect(empty).toContain("_Generated 6 Sept 2026_");
  });
});
