import {
  MonthlyReport,
  type MonthlyIncomeCategory,
  type MonthlyIncomeRow,
  type MonthlyExpenseRow,
  type MonthlyBillRow
} from "@/components/monthly-report";
import type { DonationMonth } from "@/components/monthly-donations-report";
import type { ReportDefinition, ReportLoaderContext } from "@/lib/reports/types";
import { getLastNMonths } from "@/lib/reports/shared-queries";
import {
  DONATION_ITEM_NAME,
  ARCHANAI_ITEM_NAMES,
  ABHISHEGAM_ITEM_NAMES,
  OTHERS_ITEM_NAMES,
  MONTHLY_REPORT_MONTHS_SHOWN,
  MONTHLY_REPORT_EXCLUDED_ACCOUNTS
} from "@/lib/reports/constants";
import type { Database } from "@/types/database";

type InvoiceRow = Database["public"]["Tables"]["zoho_invoices"]["Row"];
type ExpenseRow = Database["public"]["Tables"]["zoho_expenses"]["Row"];
type BillRow = Database["public"]["Tables"]["zoho_bills"]["Row"];
type MonthlyIncomeInvoice = Pick<InvoiceRow, "date" | "total" | "item_name" | "customer_name">;
type MonthlyExpenseSource = Pick<ExpenseRow, "id" | "description" | "account_name" | "date" | "total">;
type MonthlyBillSource = Pick<BillRow, "id" | "bill_number" | "vendor_name" | "account_name" | "date" | "total" | "balance">;

type Props = {
  months: DonationMonth[];
  incomeRows: MonthlyIncomeRow[];
  expenseRows: MonthlyExpenseRow[];
  billRows: MonthlyBillRow[];
  initialMonth?: string;
};

// Archanai is checked before Abhishegam, and both before the general
// donation match, since "Abishegam" and "Archanai" are unambiguous while
// the donation item name is a looser catch-all.
function categorizeIncomeItemName(itemName: string | null): MonthlyIncomeCategory | null {
  if (!itemName) return null;
  const normalized = itemName.toLowerCase();

  if (ARCHANAI_ITEM_NAMES.some((name) => normalized.includes(name.toLowerCase()))) return "archanai";
  if (ABHISHEGAM_ITEM_NAMES.some((name) => normalized.includes(name.toLowerCase()))) return "abhishegam";
  if (normalized.includes(DONATION_ITEM_NAME.toLowerCase())) return "donations";
  if (OTHERS_ITEM_NAMES.some((name) => normalized.includes(name.toLowerCase()))) return "others";

  return null;
}

async function loadMonthlyReport({ supabase, searchParams }: ReportLoaderContext): Promise<Props> {
  const months = getLastNMonths(MONTHLY_REPORT_MONTHS_SHOWN);
  const initialMonth = months.some((month) => month.key === searchParams.month) ? searchParams.month : undefined;
  const rangeStart = `${months[0].key}-01`;
  const incomeItemNamePatterns = [DONATION_ITEM_NAME, ...ARCHANAI_ITEM_NAMES, ...ABHISHEGAM_ITEM_NAMES, ...OTHERS_ITEM_NAMES];

  const [{ data: incomeInvoices }, { data: expenses }, { data: bills }] = await Promise.all([
    supabase
      .from("zoho_invoices")
      .select("date, total, item_name, customer_name")
      .gte("date", rangeStart)
      .or(incomeItemNamePatterns.map((name) => `item_name.ilike.%${name}%`).join(","))
      .returns<MonthlyIncomeInvoice[]>(),
    supabase
      .from("zoho_expenses")
      .select("id, description, account_name, date, total")
      .gte("date", rangeStart)
      .order("date", { ascending: false })
      .returns<MonthlyExpenseSource[]>(),
    supabase
      .from("zoho_bills")
      .select("id, bill_number, vendor_name, account_name, date, total, balance")
      .gte("date", rangeStart)
      .order("date", { ascending: false })
      .returns<MonthlyBillSource[]>()
  ]);

  const incomeRows = (incomeInvoices ?? []).reduce<MonthlyIncomeRow[]>((rows, invoice) => {
    const category = categorizeIncomeItemName(invoice.item_name);
    if (category && invoice.date) {
      rows.push({ date: invoice.date, total: Number(invoice.total ?? 0), category, customerName: invoice.customer_name });
    }
    return rows;
  }, []);

  const expenseRows: MonthlyExpenseRow[] = (expenses ?? [])
    .filter((expense) => !MONTHLY_REPORT_EXCLUDED_ACCOUNTS.includes(expense.account_name ?? ""))
    .map((expense) => ({
      id: expense.id,
      itemName: expense.description,
      accountName: expense.account_name,
      date: expense.date,
      total: Number(expense.total ?? 0)
    }));

  const billRows: MonthlyBillRow[] = (bills ?? [])
    .filter((bill) => !MONTHLY_REPORT_EXCLUDED_ACCOUNTS.includes(bill.account_name ?? ""))
    .map((bill) => ({
      id: bill.id,
      number: bill.bill_number,
      vendorName: bill.vendor_name,
      accountName: bill.account_name,
      date: bill.date,
      total: Number(bill.total ?? 0),
      balance: Number(bill.balance ?? 0)
    }));

  return { months, incomeRows, expenseRows, billRows, initialMonth };
}

export const monthlyReport: ReportDefinition<Props> = {
  slug: "monthly-report",
  category: "financial",
  title: "Monthly Report",
  description: "Income (Donations, Archanai, Abhishegam), Expenses & Bills for a selected month",
  summary: "Income, expenses & bills by month",
  loader: loadMonthlyReport,
  Component: MonthlyReport
};
