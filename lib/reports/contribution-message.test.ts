import { describe, expect, it } from "vitest";
import {
  buildContributionFollowUp,
  buildContributionUpdate,
  buildMemberReminder,
  normalizeWhatsAppNumber,
  whatsAppLink
} from "./contribution-message";
import type { MonthSummary, MonthlyContributionRow } from "./monthly-contributions";

function row(memberName: string, amount: number): MonthlyContributionRow {
  return {
    id: memberName,
    memberName,
    area: null,
    phone: null,
    amounts: { "2026-09": amount },
    total: amount,
    monthsPaid: amount >= 200 ? 1 : 0
  };
}

const SUMMARY: MonthSummary = {
  monthKey: "2026-09",
  full: [row("Anand", 200), row("Bhuvana", 500)],
  partial: [row("Chandra", 100)],
  none: [row("Deepa", 0)],
  collected: 800
};

const SETTLED: MonthSummary = { monthKey: "2026-09", full: SUMMARY.full, partial: [], none: [], collected: 700 };

describe("normalizeWhatsAppNumber", () => {
  it("accepts the ways a number is actually written", () => {
    expect(normalizeWhatsAppNumber("98765 43210")).toBe("919876543210");
    expect(normalizeWhatsAppNumber("+91 98765-43210")).toBe("919876543210");
    expect(normalizeWhatsAppNumber("098765 43210")).toBe("919876543210");
    expect(normalizeWhatsAppNumber("919876543210")).toBe("919876543210");
    expect(normalizeWhatsAppNumber("+91 098765 43210")).toBe("919876543210");
  });

  it("refuses anything that isn't a plausible number", () => {
    // Better no link than one that opens a chat with a stranger.
    expect(normalizeWhatsAppNumber(null)).toBeNull();
    expect(normalizeWhatsAppNumber("")).toBeNull();
    expect(normalizeWhatsAppNumber("12345")).toBeNull();
    expect(normalizeWhatsAppNumber("landline 044-2345-6789")).toBeNull();
  });
});

describe("whatsAppLink", () => {
  it("opens a chat with the message ready to send", () => {
    expect(whatsAppLink("98765 43210", "Hello there")).toBe("https://wa.me/919876543210?text=Hello%20there");
  });

  it("is absent when the member has no usable number", () => {
    expect(whatsAppLink(null, "Hello")).toBeNull();
  });
});

describe("buildContributionUpdate", () => {
  const text = buildContributionUpdate({ monthLabel: "Sept 2026", summary: SUMMARY, minimum: 200 });

  it("leads with what came in and from how many", () => {
    expect(text.startsWith("*Monthly Contributions — Sept 2026*")).toBe(true);
    expect(text).toContain("*Collected:* ₹800");
    expect(text).toContain("*Paid:* 2 of 4 members");
  });

  it("names who is short and by how much, and who hasn't paid", () => {
    expect(text).toContain("Chandra — ₹100");
    expect(text).toContain("❌ *Not yet paid (1)*");
    expect(text).toContain("Deepa");
  });

  it("lists settled members without repeating the same amount for each", () => {
    expect(text).toContain("Anand, Bhuvana");
    expect(text).not.toContain("Anand — ₹200");
  });

  it("says so when everyone has paid", () => {
    const settled = buildContributionUpdate({ monthLabel: "Sept 2026", summary: SETTLED, minimum: 200 });

    expect(settled).toContain("Every member has paid this month");
    expect(settled).not.toContain("Not yet paid");
  });
});

describe("buildContributionFollowUp", () => {
  it("asks only the members who still owe, short ones included", () => {
    const text = buildContributionFollowUp({ monthLabel: "Sept 2026", summary: SUMMARY, minimum: 200 });

    expect(text).toContain("*Reminder — Sept 2026 contributions*");
    expect(text).toContain("still pending for 2 members");
    expect(text).toContain("Deepa, Chandra");
    // A reminder is not the place to publish what everyone else gave.
    expect(text).not.toContain("Anand");
  });

  it("thanks the group rather than chasing nobody", () => {
    const text = buildContributionFollowUp({ monthLabel: "Sept 2026", summary: SETTLED, minimum: 200 });

    expect(text).toContain("all settled");
    expect(text).not.toContain("Reminder");
  });
});

describe("buildMemberReminder", () => {
  it("asks for the balance when something has already come in", () => {
    const text = buildMemberReminder({
      memberName: "Chandra",
      monthLabel: "Sept 2026",
      minimum: 200,
      paidSoFar: 100
    });

    expect(text).toContain("Namaskaram Chandra");
    expect(text).toContain("received ₹100");
    expect(text).toContain("balance of ₹100");
  });

  it("is a plain reminder when nothing has", () => {
    const text = buildMemberReminder({
      memberName: "Deepa",
      monthLabel: "Sept 2026",
      minimum: 200,
      paidSoFar: 0
    });

    expect(text).toContain("gentle reminder about your Sept 2026 contribution of ₹200");
    expect(text).not.toContain("balance");
  });
});
