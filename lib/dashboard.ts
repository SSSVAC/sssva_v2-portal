import {
  ABHISHEGAM_ITEM_NAMES,
  ARCHANAI_ITEM_NAMES,
  DONATION_ITEM_NAME,
  FUND_ITEM_NAMES
} from "@/lib/reports/constants";

// What the Overview groups income into. "Where did the money come from" is
// the question a temple committee asks; invoice status (sent/overdue) is not,
// since donations are paid when they are given.
export type IncomeCategory = "donations" | "archanai" | "abhishegam" | "silai" | "events" | "other";

export const INCOME_CATEGORY_LABEL: Record<IncomeCategory, string> = {
  donations: "Monthly donations",
  archanai: "Archanai",
  abhishegam: "Abhishegam",
  silai: "Silai fund",
  events: "Festivals & events",
  other: "Other"
};

// Zoho item names of the annual functions that have their own event report.
const EVENT_ITEM_NAMES = [
  "Ugadi",
  "Varushabishegam",
  "வருஷாபிஷேகம்",
  "Margazhi",
  "Marghazhi",
  "மார்கழி",
  "Mandala",
  "மண்டல",
  "Kanda Sashti",
  "கந்த சஷ்டி",
  "Sani Peyarchi"
];

function matchesAny(normalized: string, names: string[]) {
  return names.some((name) => normalized.includes(name.toLowerCase()));
}

/**
 * Events are checked first on purpose: "Varushabishegam" contains
 * "abishegam", so the plain Abhishegam match would swallow the annual
 * function if it ran before it.
 */
export function categorizeIncome(itemName: string | null): IncomeCategory {
  if (!itemName) return "other";
  const normalized = itemName.toLowerCase();

  if (matchesAny(normalized, EVENT_ITEM_NAMES)) return "events";
  if (matchesAny(normalized, FUND_ITEM_NAMES)) return "silai";
  if (matchesAny(normalized, ARCHANAI_ITEM_NAMES)) return "archanai";
  if (matchesAny(normalized, ABHISHEGAM_ITEM_NAMES)) return "abhishegam";
  if (normalized.includes(DONATION_ITEM_NAME.toLowerCase())) return "donations";
  return "other";
}

type Dated = { date: string | null; total: number | null };

function sumByMonth(rows: Dated[]) {
  const totals = new Map<string, number>();
  rows.forEach((row) => {
    if (!row.date) return;
    const key = row.date.slice(0, 7);
    totals.set(key, (totals.get(key) ?? 0) + Number(row.total ?? 0));
  });
  return totals;
}

export type MonthlyFlow = { month: string; income: number; spending: number };

/** One point per month key, in the order given; a month with nothing is 0. */
export function buildMonthlyFlow(monthKeys: string[], income: Dated[], spending: Dated[]): MonthlyFlow[] {
  const incomeByMonth = sumByMonth(income);
  const spendingByMonth = sumByMonth(spending);

  return monthKeys.map((month) => ({
    month,
    income: incomeByMonth.get(month) ?? 0,
    spending: spendingByMonth.get(month) ?? 0
  }));
}

/** Income per category within the given months, largest first, zeros dropped. */
export function buildIncomeMix(
  invoices: (Dated & { item_name: string | null })[],
  monthKeys: Set<string>
) {
  const totals = new Map<IncomeCategory, number>();

  invoices.forEach((invoice) => {
    if (!invoice.date || !monthKeys.has(invoice.date.slice(0, 7))) return;
    const category = categorizeIncome(invoice.item_name);
    totals.set(category, (totals.get(category) ?? 0) + Number(invoice.total ?? 0));
  });

  return Array.from(totals.entries())
    .filter(([, total]) => total > 0)
    .map(([category, total]) => ({ category, label: INCOME_CATEGORY_LABEL[category], total }))
    .sort((a, b) => b.total - a.total);
}
