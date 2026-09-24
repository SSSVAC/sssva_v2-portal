/**
 * The four buckets the Monthly Report splits income into, and what each is
 * called on screen, in an export and in a WhatsApp message.
 *
 * Here rather than in the report component so the message builder can label
 * a category without importing the component that renders it.
 */
export type MonthlyIncomeCategory = "donations" | "archanai" | "abhishegam" | "others";

export const INCOME_CATEGORY_LABELS: Record<MonthlyIncomeCategory, string> = {
  donations: "Monthly Donations",
  archanai: "Archanai",
  abhishegam: "Abhishegam",
  others: "Others"
};

export const INCOME_CATEGORY_ORDER: MonthlyIncomeCategory[] = [
  "donations",
  "archanai",
  "abhishegam",
  "others"
];
