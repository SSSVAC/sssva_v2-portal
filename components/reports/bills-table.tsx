"use client";

import { Fragment } from "react";
import { CornerDownRight } from "lucide-react";
import { formatCurrency, formatDateOnly } from "@/lib/format";
import { describePayment, type BillPaymentRow } from "@/lib/reports/bill-payments";

export type ReportBillRow = {
  id: string;
  number: string | null;
  vendorName: string | null;
  accountName?: string | null;
  date: string | null;
  total: number;
  balance: number;
  payments?: BillPaymentRow[];
};

type BillsTableProps = {
  rows: ReportBillRow[];
  /** Monthly Report shows which account a bill was booked to; the fund reports don't. */
  showAccount?: boolean;
  showPayments: boolean;
  onShowPaymentsChange: (value: boolean) => void;
  totals: { total: number; paid: number; due: number };
};

function dueClass(balance: number) {
  return balance > 0 ? "cell-danger" : "cell-success";
}

/**
 * Bills with an optional per-bill payment breakdown.
 *
 * Zoho settles a bill through any number of separate payments, and the list
 * endpoint only reports the net balance — so "Paid ₹29,500" was previously
 * the whole story, with no way to see that it was eight payments across four
 * months. The breakdown is off by default because most readers want the
 * totals; turning it on inserts each payment beneath its bill.
 */
export function BillsTable({
  rows,
  showAccount = false,
  showPayments,
  onShowPaymentsChange,
  totals
}: BillsTableProps) {
  const paymentCount = rows.reduce((sum, row) => sum + (row.payments?.length ?? 0), 0);
  // Leading columns before the one the payment description sits in, so the
  // sub-row lines up under "Paid".
  const leading = showAccount ? 4 : 3;

  return (
    <>
      <div className="records-toolbar no-print" style={{ padding: "12px 16px 0", marginBottom: 12 }}>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={showPayments}
            disabled={paymentCount === 0}
            onChange={(event) => onShowPaymentsChange(event.target.checked)}
          />
          Show payment details
        </label>
        <span className="muted">
          {paymentCount === 0
            ? "No individual payments recorded yet — run a Zoho sync to pull them in."
            : `${paymentCount} payment${paymentCount === 1 ? "" : "s"} across ${rows.length} bill${
                rows.length === 1 ? "" : "s"
              }`}
        </span>
      </div>

      <div className="table-panel-scroll">
        <table className="data-table data-table-cards">
          <thead>
            <tr>
              <th>Bill #</th>
              <th>Vendor</th>
              {showAccount && <th>Account</th>}
              <th>Date</th>
              <th className="num">Total</th>
              <th className="num">Paid</th>
              <th className="num">Due</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const payments = row.payments ?? [];

              return (
                <Fragment key={row.id}>
                  <tr>
                    <td data-label="Bill #">{row.number ?? "—"}</td>
                    <td data-label="Vendor">{row.vendorName ?? "—"}</td>
                    {showAccount && <td data-label="Account">{row.accountName ?? "—"}</td>}
                    <td data-label="Date">{row.date ? formatDateOnly(row.date) : "—"}</td>
                    <td data-label="Total" className="num">
                      {formatCurrency(row.total)}
                    </td>
                    <td data-label="Paid" className="num">
                      {formatCurrency(row.total - row.balance)}
                      {payments.length > 0 && !showPayments && (
                        <span className="muted payment-count"> ({payments.length})</span>
                      )}
                    </td>
                    <td data-label="Due" className={`num ${dueClass(row.balance)}`}>
                      {formatCurrency(row.balance)}
                    </td>
                  </tr>

                  {showPayments &&
                    payments.map((payment) => (
                      <tr key={payment.id} className="payment-row">
                        <td data-label="Payment" colSpan={leading}>
                          <CornerDownRight size={13} aria-hidden="true" />
                          <span>{describePayment(payment) || "Payment"}</span>
                          {payment.description && (
                            <span className="muted"> — {payment.description}</span>
                          )}
                        </td>
                        <td />
                        <td data-label="Paid" className="num">
                          {formatCurrency(payment.amount)}
                        </td>
                        <td />
                      </tr>
                    ))}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={leading}>Total Bills</td>
              <td data-label="Total" className="num">
                {formatCurrency(totals.total)}
              </td>
              <td data-label="Paid" className="num">
                {formatCurrency(totals.paid)}
              </td>
              <td data-label="Due" className="num">
                {formatCurrency(totals.due)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
