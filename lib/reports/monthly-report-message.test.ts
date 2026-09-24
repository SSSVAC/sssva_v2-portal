import { describe, expect, it } from "vitest";
import {
  buildMonthlyReportMessage,
  type MessageBillRow,
  type MessageExpenseRow,
  type MessageIncomeRow
} from "./monthly-report-message";

const NOW = new Date("2026-09-24T06:00:00Z");

const INCOME: MessageIncomeRow[] = [
  { category: "donations", total: 20000 },
  { category: "donations", total: 10000 },
  { category: "archanai", total: 8000 },
  { category: "others", total: 2300 }
];

const EXPENSES: MessageExpenseRow[] = [
  { itemName: "Flowers", accountName: "Pooja Expenses", total: 2000 },
  { itemName: null, accountName: "Electricity", total: 3400 },
  { itemName: "  ", accountName: null, total: 600 }
];

const BILLS: MessageBillRow[] = [
  { number: "BILL-01", vendorName: "Sri Traders", total: 10000, balance: 4000 },
  { number: "BILL-02", vendorName: "Kumar Electricals", total: 5000, balance: 0 }
];

function message(overrides: Partial<Parameters<typeof buildMonthlyReportMessage>[0]> = {}) {
  return buildMonthlyReportMessage({
    monthLabel: "Sep 2026",
    incomeRows: INCOME,
    expenseRows: EXPENSES,
    billRows: BILLS,
    now: NOW,
    ...overrides
  });
}

describe("buildMonthlyReportMessage", () => {
  it("leads with the month and what came in, split by category", () => {
    const text = message();

    expect(text.startsWith("*Monthly Report — Sep 2026*")).toBe(true);
    expect(text).toContain("*Received:* ₹40,300");
    expect(text).toContain("• Monthly Donations — ₹30,000");
    expect(text).toContain("• Archanai — ₹8,000");
    expect(text).toContain("• Others — ₹2,300");
  });

  it("leaves out a category with nothing in it", () => {
    expect(message()).not.toContain("Abhishegam");
  });

  it("adds bills to expenses to reach what went out", () => {
    const text = message();

    // 6,000 of expenses + 15,000 of bills raised this month.
    expect(text).toContain("*Spends:* ₹21,000");
    expect(text).toContain("• Expenses — ₹6,000");
    expect(text).toContain("• Bills — ₹15,000");
    expect(text).toContain("*Balance:* ₹19,300");
  });

  it("says what is still owed, and on which bills", () => {
    const text = message();

    expect(text).toContain("*Bills still due:* ₹4,000 of ₹15,000");
    expect(text).toContain("*Unpaid bills (1)*");
    expect(text).toContain("1. Sri Traders — ₹4,000");
    // A settled bill is not something the group has to act on.
    expect(text).not.toContain("Kumar Electricals");
  });

  it("names an expense by its item, falling back to the account", () => {
    const text = message();

    expect(text).toContain("*Expenses (3)*");
    expect(text).toContain("1. Flowers — ₹2,000");
    expect(text).toContain("2. Electricity — ₹3,400");
    // Neither an item nor an account: still a line, still in the total.
    expect(text).toContain("3. Expense — ₹600");
  });

  it("counts the tail rather than printing forty expenses into a chat", () => {
    const many: MessageExpenseRow[] = Array.from({ length: 15 }, (_, index) => ({
      itemName: `Item ${index + 1}`,
      accountName: null,
      total: 100
    }));
    const text = message({ expenseRows: many, billRows: [] });

    expect(text).toContain("*Expenses (15)*");
    expect(text).toContain("12. Item 12 — ₹100");
    expect(text).not.toContain("13. Item 13");
    expect(text).toContain("…and 3 more expenses — ₹300");
    // The summed line keeps the total honest.
    expect(text).toContain("*Spends:* ₹1,500");
  });

  it("shows a deficit month as one", () => {
    const text = message({ incomeRows: [{ category: "donations", total: 1000 }] });

    expect(text).toContain("*Balance:* -₹20,000");
  });

  it("says so for a month with nothing in it", () => {
    const text = message({ incomeRows: [], expenseRows: [], billRows: [] });

    expect(text).toContain("Nothing recorded for Sep 2026 yet.");
    expect(text).not.toContain("*Received:*");
  });

  it("dates itself the way the rest of the app writes dates", () => {
    expect(message()).toContain("_Generated 24 Sept 2026 from the SSSVA portal_");
  });
});
