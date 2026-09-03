import type { createClient } from "@/lib/supabase/server";
import type { ExportCell } from "@/lib/export";
import { formatCurrency, formatDateOnly } from "@/lib/format";

type Client = Awaited<ReturnType<typeof createClient>>;

/** One payment applied to one bill. See supabase/schema.sql for why it's per-bill. */
export type BillPaymentRow = {
  id: string;
  date: string | null;
  amount: number;
  mode: string | null;
  reference: string | null;
  description: string | null;
  paidThrough: string | null;
};

type RawPayment = {
  id: string;
  zoho_bill_id: string;
  date: string | null;
  amount: number | string | null;
  payment_mode: string | null;
  reference_number: string | null;
  description: string | null;
  paid_through_account_name: string | null;
};

/**
 * Payments for the given bills, keyed by Zoho bill id.
 *
 * Reports fetch bills first and then their payments, rather than joining,
 * because a report's bills are already filtered by account name — fetching
 * every payment in the system to throw most away would be the larger query
 * at this app's scale.
 */
export async function fetchBillPayments(
  supabase: Client,
  zohoBillIds: string[]
): Promise<Map<string, BillPaymentRow[]>> {
  const byBill = new Map<string, BillPaymentRow[]>();
  const ids = zohoBillIds.filter(Boolean);
  if (ids.length === 0) return byBill;

  const { data } = await supabase
    .from("zoho_bill_payments")
    .select(
      "id, zoho_bill_id, date, amount, payment_mode, reference_number, description, paid_through_account_name"
    )
    .in("zoho_bill_id", ids)
    .order("date", { ascending: true })
    .returns<RawPayment[]>();

  for (const payment of data ?? []) {
    const list = byBill.get(payment.zoho_bill_id) ?? [];
    list.push({
      id: payment.id,
      date: payment.date,
      amount: Number(payment.amount ?? 0),
      mode: payment.payment_mode,
      reference: payment.reference_number,
      description: payment.description,
      paidThrough: payment.paid_through_account_name
    });
    byBill.set(payment.zoho_bill_id, list);
  }

  return byBill;
}

/** "2 Sept 2026 · Cash · Reimbursement Payable" — the one-line identity of a payment. */
export function describePayment(payment: BillPaymentRow) {
  return [
    payment.date ? formatDateOnly(payment.date) : null,
    payment.mode,
    payment.paidThrough,
    payment.reference
  ]
    .filter((part) => part && String(part).trim())
    .join(" · ");
}

/**
 * Payment lines for a CSV/HTML export, to follow their bill's own row.
 * The description takes the first column and the amount goes in whichever
 * column that report uses for "Paid", so the same helper fits the fund
 * reports (6 columns) and Monthly Report (7, with an extra Account column).
 */
export function paymentExportRows(
  payments: BillPaymentRow[],
  columnCount: number,
  amountColumn: number
): ExportCell[][] {
  return payments.map((payment) => {
    const row: ExportCell[] = Array.from({ length: columnCount }, () => "");
    row[0] = `    ↳ ${describePayment(payment)}`;
    row[amountColumn] = formatCurrency(payment.amount);
    return row;
  });
}
