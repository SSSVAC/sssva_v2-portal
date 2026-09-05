import { describe, expect, it } from "vitest";
import {
  buildAllTimeContributionEntries,
  buildAllTimeContributionRows,
  type AllTimeFundInvoice
} from "./all-time-fund";
import { groupContributionsByDate, sortContributionEntries } from "./contribution-entries";
import type { ReportCustomer } from "./shared-queries";

function customer(overrides: Partial<ReportCustomer> & { zoho_customer_id: string; display_name: string }): ReportCustomer {
  return {
    company_name: null,
    phone: null,
    billing_address: null,
    customer_group: null,
    order_number: null,
    is_member: false,
    ...overrides
  };
}

function invoice(overrides: Partial<AllTimeFundInvoice> & { zoho_invoice_id: string }): AllTimeFundInvoice {
  return {
    customer_id: null,
    customer_name: null,
    date: null,
    total: 0,
    subject: null,
    ...overrides
  };
}

const CUSTOMERS: ReportCustomer[] = [
  customer({
    zoho_customer_id: "c1",
    display_name: "Anand",
    phone: "900",
    billing_address: "12 Kalluri Salai",
    customer_group: "Kalluri Salai",
    is_member: true
  }),
  customer({
    zoho_customer_id: "c2",
    display_name: "Bhuvana",
    customer_group: "Ramaiya Nagar",
    is_member: true
  }),
  // A member who has given nothing: street view can reveal them, the date
  // view has nothing to file them under.
  customer({ zoho_customer_id: "c3", display_name: "Chandra", is_member: true })
];

const INVOICES: AllTimeFundInvoice[] = [
  invoice({ zoho_invoice_id: "i1", customer_id: "c1", customer_name: "Anand", date: "2025-01-10", total: 2000 }),
  invoice({ zoho_invoice_id: "i2", customer_id: "c1", customer_name: "Anand", date: "2025-03-04", total: 1500 }),
  invoice({ zoho_invoice_id: "i3", customer_id: "c2", customer_name: "Bhuvana", date: "2025-01-10", total: 500 }),
  // Same day as i1/i3, no customer_id, no matching customer record.
  invoice({ zoho_invoice_id: "i4", customer_name: "Walk-in donor", date: "2025-01-10", total: 250 }),
  // A non-cash ubhayam: zero total, the donation is the subject line.
  invoice({ zoho_invoice_id: "i5", customer_id: "c2", customer_name: "Bhuvana", date: "2025-02-01", total: 0, subject: "Silk saree" })
];

describe("buildAllTimeContributionEntries", () => {
  it("keeps one row per contribution, so a donor who gave twice shows twice", () => {
    const entries = buildAllTimeContributionEntries(INVOICES, CUSTOMERS);
    const anand = entries.filter((entry) => entry.donorName === "Anand");

    expect(anand.map((entry) => [entry.date, entry.total])).toEqual([
      ["2025-03-04", 1500],
      ["2025-01-10", 2000]
    ]);
  });

  it("carries the donor's street details across for the date view", () => {
    const entries = buildAllTimeContributionEntries(INVOICES, CUSTOMERS);
    const anandJan = entries.find((entry) => entry.id === "i1");

    expect(anandJan).toMatchObject({
      donorName: "Anand",
      phone: "900",
      address: "12 Kalluri Salai",
      group: "Kalluri Salai"
    });
  });

  it("leaves out zero-total non-cash donations, which have their own section", () => {
    const entries = buildAllTimeContributionEntries(INVOICES, CUSTOMERS);

    expect(entries.map((entry) => entry.id)).not.toContain("i5");
  });

  // The two views are the same money cut two ways; if they disagree, one of
  // them is lying about the fund's total.
  it("totals the same as the street view", () => {
    const entriesTotal = buildAllTimeContributionEntries(INVOICES, CUSTOMERS).reduce(
      (sum, entry) => sum + entry.total,
      0
    );
    const streetTotal = buildAllTimeContributionRows(INVOICES, CUSTOMERS).reduce(
      (sum, row) => sum + row.total,
      0
    );

    expect(entriesTotal).toBe(streetTotal);
    expect(entriesTotal).toBe(4250);
  });

  it("does not count an id-credited donor a second time under a bare name", () => {
    const withDuplicate = [
      ...INVOICES,
      // Same donor as i1/i2 but with no customer_id: the street view folds
      // this into the name bucket it drops, so the date view must skip it too.
      invoice({ zoho_invoice_id: "i6", customer_name: "anand", date: "2025-04-01", total: 999 })
    ];

    const entriesTotal = buildAllTimeContributionEntries(withDuplicate, CUSTOMERS).reduce(
      (sum, entry) => sum + entry.total,
      0
    );
    const streetTotal = buildAllTimeContributionRows(withDuplicate, CUSTOMERS).reduce(
      (sum, row) => sum + row.total,
      0
    );

    expect(entriesTotal).toBe(streetTotal);
    expect(entriesTotal).toBe(4250);
  });
});

describe("sortContributionEntries", () => {
  it("orders newest first, or oldest first, with undated contributions last either way", () => {
    const entries = buildAllTimeContributionEntries(
      [...INVOICES, invoice({ zoho_invoice_id: "i7", customer_name: "No date", total: 100 })],
      CUSTOMERS
    );

    expect(sortContributionEntries(entries, "desc").map((entry) => entry.date)).toEqual([
      "2025-03-04",
      "2025-01-10",
      "2025-01-10",
      "2025-01-10",
      null
    ]);
    expect(sortContributionEntries(entries, "asc").map((entry) => entry.date)).toEqual([
      "2025-01-10",
      "2025-01-10",
      "2025-01-10",
      "2025-03-04",
      null
    ]);
  });
});

describe("groupContributionsByDate", () => {
  it("buckets a day's contributions together with their subtotal", () => {
    const groups = groupContributionsByDate(buildAllTimeContributionEntries(INVOICES, CUSTOMERS), "desc");

    expect(groups.map((group) => [group.dateKey, group.rows.length, group.subtotal])).toEqual([
      ["2025-03-04", 1, 1500],
      ["2025-01-10", 3, 2750]
    ]);
  });

  it("labels a day the way the rest of the report writes dates", () => {
    const [group] = groupContributionsByDate(buildAllTimeContributionEntries(INVOICES, CUSTOMERS), "desc");

    expect(group.label).toBe("4 Mar 2025");
  });

  it("keeps the donors within a day in the same order the sort put them", () => {
    const [, january] = groupContributionsByDate(buildAllTimeContributionEntries(INVOICES, CUSTOMERS), "desc");

    expect(january.rows.map((row) => row.donorName)).toEqual(["Anand", "Bhuvana", "Walk-in donor"]);
  });

  it("returns nothing for a fund with no contributions", () => {
    expect(groupContributionsByDate([], "desc")).toEqual([]);
  });
});
