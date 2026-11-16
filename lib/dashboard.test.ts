import { describe, expect, it } from "vitest";
import { buildIncomeMix, buildMonthlyFlow, categorizeIncome } from "./dashboard";

describe("categorizeIncome", () => {
  it("classifies the known item names", () => {
    expect(categorizeIncome("Donations and/or Sponsorships")).toBe("donations");
    expect(categorizeIncome("Archanai")).toBe("archanai");
    expect(categorizeIncome("Abishegam")).toBe("abhishegam");
    expect(categorizeIncome("Murugar & Iyyapan Statue Funds")).toBe("silai");
    expect(categorizeIncome("Mandala Poorthi")).toBe("events");
    expect(categorizeIncome("Kanda Sashti Vizha")).toBe("events");
    expect(categorizeIncome("Others")).toBe("other");
    expect(categorizeIncome(null)).toBe("other");
  });

  it("does not file Varushabishegam under Abhishegam", () => {
    expect(categorizeIncome("Varushabishegam")).toBe("events");
  });
});

describe("buildMonthlyFlow", () => {
  it("sums per month and zero-fills months with nothing", () => {
    const flow = buildMonthlyFlow(
      ["2026-09", "2026-10", "2026-11"],
      [
        { date: "2026-10-03", total: 100 },
        { date: "2026-10-20", total: 50 },
        { date: null, total: 999 }
      ],
      [{ date: "2026-11-01", total: 30 }]
    );
    expect(flow).toEqual([
      { month: "2026-09", income: 0, spending: 0 },
      { month: "2026-10", income: 150, spending: 0 },
      { month: "2026-11", income: 0, spending: 30 }
    ]);
  });
});

describe("buildIncomeMix", () => {
  it("groups by category within the months, largest first", () => {
    const mix = buildIncomeMix(
      [
        { date: "2026-10-01", total: 200, item_name: "Archanai" },
        { date: "2026-10-02", total: 500, item_name: "Donations and/or Sponsorships" },
        { date: "2026-10-03", total: 100, item_name: "Archanai" },
        { date: "2025-01-03", total: 900, item_name: "Archanai" }
      ],
      new Set(["2026-10"])
    );
    expect(mix.map((entry) => [entry.category, entry.total])).toEqual([
      ["donations", 500],
      ["archanai", 300]
    ]);
  });
});
