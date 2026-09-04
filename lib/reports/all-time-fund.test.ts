import { describe, expect, it } from "vitest";
import { buildContributionEntryRows, type AllTimeFundInvoice } from "@/lib/reports/all-time-fund";
import type { ReportCustomer } from "@/lib/reports/shared-queries";

function customer(overrides: Partial<ReportCustomer> & { zoho_customer_id: string; display_name: string }) {
  return {
    phone: null,
    billing_address: null,
    customer_group: null,
    order_number: null,
    is_member: false,
    ...overrides
  } as ReportCustomer;
}

function invoice(overrides: Partial<AllTimeFundInvoice> & { id: string }): AllTimeFundInvoice {
  return {
    customer_id: null,
    customer_name: null,
    date: null,
    total: 0,
    subject: null,
    ...overrides
  };
}

describe("buildContributionEntryRows", () => {
  it("lists each receipt separately, newest first", () => {
    const rows = buildContributionEntryRows(
      [
        invoice({ id: "a", customer_name: "Ravi", date: "2026-01-10", total: 1000 }),
        invoice({ id: "b", customer_name: "Ravi", date: "2026-03-02", total: 2000 }),
        invoice({ id: "c", customer_name: "Meena", date: "2026-02-14", total: 500 })
      ],
      []
    );

    expect(rows.map((row) => row.id)).toEqual(["b", "c", "a"]);
    // The same donor's two instalments stay two rows, unlike the per-member view.
    expect(rows.filter((row) => row.donorName === "Ravi")).toHaveLength(2);
  });

  it("drops zero-total invoices, which are the non-cash ubhayams", () => {
    const rows = buildContributionEntryRows(
      [
        invoice({ id: "a", customer_name: "Ravi", date: "2026-01-10", total: 1000 }),
        invoice({ id: "b", customer_name: "Meena", date: "2026-01-11", total: 0, subject: "Silver lamp" })
      ],
      []
    );

    expect(rows.map((row) => row.id)).toEqual(["a"]);
  });

  it("sinks undated receipts to the bottom rather than sorting them as an empty date", () => {
    const rows = buildContributionEntryRows(
      [
        invoice({ id: "undated", customer_name: "Ravi", date: null, total: 100 }),
        invoice({ id: "dated", customer_name: "Meena", date: "2020-01-01", total: 100 })
      ],
      []
    );

    expect(rows.map((row) => row.id)).toEqual(["dated", "undated"]);
  });

  it("resolves the street by customer id, never by a name another member shares", () => {
    const rows = buildContributionEntryRows(
      [invoice({ id: "a", customer_id: "c2", customer_name: "R. Kumar", date: "2026-01-10", total: 900 })],
      [
        customer({ zoho_customer_id: "c1", display_name: "R. Kumar", customer_group: "Ramaiah Nagar" }),
        customer({ zoho_customer_id: "c2", display_name: "R. Kumar", customer_group: "Kalaignar Nagar" })
      ]
    );

    expect(rows[0]?.group).toBe("Kalaignar Nagar");
  });

  it("falls back to matching on name only when the invoice carries no id", () => {
    const rows = buildContributionEntryRows(
      [invoice({ id: "a", customer_name: " r. kumar ", date: "2026-01-10", total: 900 })],
      [customer({ zoho_customer_id: "c1", display_name: "R. Kumar", customer_group: "Ramaiah Nagar" })]
    );

    expect(rows[0]?.group).toBe("Ramaiah Nagar");
  });
});
