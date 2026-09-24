import { formatCurrency, formatDateOnly } from "@/lib/format";
import {
  INCOME_CATEGORY_LABELS,
  INCOME_CATEGORY_ORDER,
  type MonthlyIncomeCategory
} from "@/lib/reports/monthly-income";

/**
 * How many expenses or outstanding bills a message lists before it starts
 * counting. A month with eight expenses should show all eight; a month with
 * forty is a report, not a message, and the total still adds up because the
 * rest are summed into one line.
 */
const MAX_LISTED = 12;

export type MessageIncomeRow = { category: MonthlyIncomeCategory; total: number };
export type MessageExpenseRow = {
  itemName: string | null;
  accountName?: string | null;
  date?: string | null;
  total: number;
};
export type MessageBillRow = {
  number: string | null;
  vendorName: string | null;
  total: number;
  balance: number;
};

function sum<T extends { total: number }>(rows: T[]) {
  return rows.reduce((total, row) => total + row.total, 0);
}

function listWithOverflow(
  entries: { label: string; amount: number }[],
  { max = MAX_LISTED, noun }: { max?: number; noun: string }
) {
  const shown = entries.slice(0, max);
  const rest = entries.slice(max);
  const lines = shown.map((entry, index) => `${index + 1}. ${entry.label} — ${formatCurrency(entry.amount)}`);

  if (rest.length > 0) {
    const restTotal = rest.reduce((total, entry) => total + entry.amount, 0);
    lines.push(`…and ${rest.length} more ${noun} — ${formatCurrency(restTotal)}`);
  }

  return lines;
}

/**
 * The month's accounts as a message somebody can read in a group chat:
 * what came in, split the way the report splits it, what went out, and what
 * is left. *bold* is WhatsApp's own markdown, as in the other copy-for-
 * WhatsApp exports.
 *
 * The totals are summed here from the same rows the report is showing, so a
 * message pasted into the group and the page it came from cannot disagree.
 * A category with nothing in it is left out rather than printed as ₹0 —
 * four zero lines say nothing and cost four lines.
 */
export function buildMonthlyReportMessage({
  monthLabel,
  incomeRows,
  expenseRows,
  billRows,
  now = new Date()
}: {
  monthLabel: string;
  incomeRows: MessageIncomeRow[];
  expenseRows: MessageExpenseRow[];
  billRows: MessageBillRow[];
  now?: Date;
}): string {
  const totalReceived = sum(incomeRows);
  const totalExpenses = sum(expenseRows);
  const totalBills = sum(billRows);
  const totalBillsDue = billRows.reduce((total, row) => total + row.balance, 0);
  const totalSpends = totalExpenses + totalBills;
  const balance = totalReceived - totalSpends;

  const lines = [`*Monthly Report — ${monthLabel}*`, ""];

  if (incomeRows.length === 0 && expenseRows.length === 0 && billRows.length === 0) {
    lines.push(`Nothing recorded for ${monthLabel} yet.`, "", "_Sent from the SSSVA portal_");
    return lines.join("\n");
  }

  lines.push(`*Received:* ${formatCurrency(totalReceived)}`);
  INCOME_CATEGORY_ORDER.forEach((category) => {
    const categoryTotal = sum(incomeRows.filter((row) => row.category === category));
    if (categoryTotal > 0) {
      lines.push(`• ${INCOME_CATEGORY_LABELS[category]} — ${formatCurrency(categoryTotal)}`);
    }
  });
  lines.push("");

  lines.push(`*Spends:* ${formatCurrency(totalSpends)}`);
  if (totalExpenses > 0) lines.push(`• Expenses — ${formatCurrency(totalExpenses)}`);
  if (totalBills > 0) lines.push(`• Bills — ${formatCurrency(totalBills)}`);
  lines.push("");

  // The figure the group actually discusses, and the one that can be in a
  // bad state, so they lead the second half of the message.
  lines.push(`*Balance:* ${formatCurrency(balance)}`);
  if (totalBillsDue > 0) {
    lines.push(`*Bills still due:* ${formatCurrency(totalBillsDue)} of ${formatCurrency(totalBills)}`);
  }
  lines.push("");

  if (expenseRows.length > 0) {
    lines.push(`*Expenses (${expenseRows.length})*`);
    lines.push(
      ...listWithOverflow(
        expenseRows.map((row) => ({
          label: row.itemName?.trim() || row.accountName?.trim() || "Expense",
          amount: row.total
        })),
        { noun: "expenses" }
      )
    );
    lines.push("");
  }

  const outstanding = billRows.filter((row) => row.balance > 0);
  if (outstanding.length > 0) {
    lines.push(`*Unpaid bills (${outstanding.length})*`);
    lines.push(
      ...listWithOverflow(
        outstanding.map((row) => ({
          label: row.vendorName?.trim() || row.number?.trim() || "Bill",
          amount: row.balance
        })),
        { noun: "bills" }
      )
    );
    lines.push("");
  }

  lines.push(`_Generated ${formatDateOnly(now.toISOString())} from the SSSVA portal_`);

  return lines.join("\n");
}
