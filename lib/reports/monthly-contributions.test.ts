import { describe, expect, it } from "vitest";
import {
  buildMonthlyContributionRows,
  contributionStatus,
  contributionYearMonths,
  currentDayOfMonth,
  currentMonthKey,
  isFutureMonth,
  summariseMonth,
  type ContributionInvoice
} from "./monthly-contributions";
import type { ReportCustomer } from "./shared-queries";

function member(
  overrides: Partial<ReportCustomer> & { zoho_customer_id: string; display_name: string }
): ReportCustomer {
  return {
    company_name: null,
    phone: null,
    billing_address: null,
    customer_group: null,
    order_number: null,
    is_member: true,
    ...overrides
  };
}

const CUSTOMERS: ReportCustomer[] = [
  member({ zoho_customer_id: "c1", display_name: "Anand", phone: "98765 43210", customer_group: "Kalluri Salai" }),
  member({ zoho_customer_id: "c2", display_name: "Bhuvana", customer_group: "Bazaar Street" }),
  member({ zoho_customer_id: "c3", display_name: "Chandra", customer_group: "Kalluri Salai" }),
  // Not a member: a temple visitor who donates is not on the dues sheet.
  member({ zoho_customer_id: "c4", display_name: "Visitor", is_member: false })
];

const INVOICES: ContributionInvoice[] = [
  { customer_id: "c1", customer_name: "Anand", date: "2026-01-09", total: 200 },
  { customer_id: "c1", customer_name: "Anand", date: "2026-02-11", total: 100 },
  // Two part payments in one month add up to a settled month.
  { customer_id: "c1", customer_name: "Anand", date: "2026-03-02", total: 100 },
  { customer_id: "c1", customer_name: "Anand", date: "2026-03-20", total: 100 },
  { customer_id: "c2", customer_name: "Bhuvana", date: "2026-01-15", total: 500 },
  // Outside the year on the sheet.
  { customer_id: "c2", customer_name: "Bhuvana", date: "2025-12-31", total: 200 },
  { customer_id: "c4", customer_name: "Visitor", date: "2026-01-20", total: 1000 }
];

const MONTHS = contributionYearMonths(2026);
const MINIMUM = 200;
// Mid-September, so Oct-Dec 2026 are still ahead.
const NOW = new Date("2026-09-22T06:00:00Z");

function rows(overrides: Parameters<typeof buildMonthlyContributionRows>[0] | null = null) {
  return buildMonthlyContributionRows(
    overrides ?? { customers: CUSTOMERS, invoices: INVOICES, months: MONTHS, minimum: MINIMUM, now: NOW }
  );
}

describe("contributionYearMonths", () => {
  it("covers January to December of the year asked for", () => {
    expect(MONTHS).toHaveLength(12);
    expect(MONTHS[0]).toMatchObject({ key: "2026-01", short: "Jan", label: "Jan 2026" });
    expect(MONTHS[11]).toMatchObject({ key: "2026-12", short: "Dec", label: "Dec 2026" });
  });
});

describe("contributionStatus", () => {
  it("is settled at the minimum, short above zero, unpaid at zero", () => {
    expect(contributionStatus(200, MINIMUM, false)).toBe("full");
    expect(contributionStatus(500, MINIMUM, false)).toBe("full");
    expect(contributionStatus(100, MINIMUM, false)).toBe("partial");
    expect(contributionStatus(0, MINIMUM, false)).toBe("none");
  });

  it("never marks a month that hasn't happened as unpaid", () => {
    expect(contributionStatus(0, MINIMUM, true)).toBe("future");
  });
});

describe("month arithmetic", () => {
  it("reads the current month and day in IST, not the server's zone", () => {
    // 23:30 UTC on the 21st is already 05:00 on the 22nd in India — the
    // report must not be a day and, at a month boundary, a month behind.
    const lateUtc = new Date("2026-09-21T23:30:00Z");
    expect(currentMonthKey(lateUtc)).toBe("2026-09");
    expect(currentDayOfMonth(lateUtc)).toBe(22);
  });

  it("counts a month as future only after the one in progress", () => {
    expect(isFutureMonth("2026-10", NOW)).toBe(true);
    expect(isFutureMonth("2026-09", NOW)).toBe(false);
    expect(isFutureMonth("2026-08", NOW)).toBe(false);
  });
});

describe("buildMonthlyContributionRows", () => {
  it("has a row for every member, including one who has never paid", () => {
    expect(rows().map((row) => row.memberName)).toEqual(["Bhuvana", "Anand", "Chandra"]);
  });

  it("leaves out customers who aren't members", () => {
    expect(rows().some((row) => row.memberName === "Visitor")).toBe(false);
  });

  it("orders by area, then name, the way a collection is walked", () => {
    expect(rows().map((row) => [row.area, row.memberName])).toEqual([
      ["Bazaar Street", "Bhuvana"],
      ["Kalluri Salai", "Anand"],
      ["Kalluri Salai", "Chandra"]
    ]);
  });

  it("adds up part payments within a month", () => {
    const anand = rows().find((row) => row.memberName === "Anand");

    expect(anand?.amounts["2026-03"]).toBe(200);
    expect(anand?.amounts["2026-02"]).toBe(100);
    expect(anand?.total).toBe(500);
  });

  it("ignores invoices from outside the year on the sheet", () => {
    const bhuvana = rows().find((row) => row.memberName === "Bhuvana");

    expect(bhuvana?.amounts["2025-12"]).toBeUndefined();
    expect(bhuvana?.total).toBe(500);
  });

  it("counts months paid against the months that have happened", () => {
    // Anand settled January and March; February was short.
    expect(rows().find((row) => row.memberName === "Anand")?.monthsPaid).toBe(2);
    expect(rows().find((row) => row.memberName === "Chandra")?.monthsPaid).toBe(0);
  });

  it("withholds phone and area when the viewer isn't allowed them", () => {
    const shared = buildMonthlyContributionRows({
      customers: CUSTOMERS,
      invoices: INVOICES,
      months: MONTHS,
      minimum: MINIMUM,
      includeContact: false,
      now: NOW
    });

    expect(shared.every((row) => row.area === null && row.phone === null)).toBe(true);
    expect(shared.map((row) => row.memberName)).toContain("Anand");
  });

  it("credits an invoice with no customer id by name", () => {
    const byName = buildMonthlyContributionRows({
      customers: CUSTOMERS,
      invoices: [{ customer_id: null, customer_name: "chandra", date: "2026-04-02", total: 200 }],
      months: MONTHS,
      minimum: MINIMUM,
      now: NOW
    });

    expect(byName.find((row) => row.memberName === "Chandra")?.amounts["2026-04"]).toBe(200);
  });

  it("does not credit a name that the same invoice already credited by id", () => {
    const both = buildMonthlyContributionRows({
      customers: CUSTOMERS,
      invoices: [
        { customer_id: "c1", customer_name: "Anand", date: "2026-05-01", total: 200 },
        { customer_id: null, customer_name: "Anand", date: "2026-05-02", total: 200 }
      ],
      months: MONTHS,
      minimum: MINIMUM,
      now: NOW
    });

    expect(both.find((row) => row.memberName === "Anand")?.amounts["2026-05"]).toBe(200);
  });
});

describe("summariseMonth", () => {
  it("splits a month into settled, short and unpaid", () => {
    const january = summariseMonth(rows(), "2026-01", MINIMUM);

    expect(january.full.map((row) => row.memberName)).toEqual(["Bhuvana", "Anand"]);
    expect(january.partial).toEqual([]);
    expect(january.none.map((row) => row.memberName)).toEqual(["Chandra"]);
    expect(january.collected).toBe(700);
  });

  it("calls a short month short, not paid", () => {
    const february = summariseMonth(rows(), "2026-02", MINIMUM);

    expect(february.partial.map((row) => row.memberName)).toEqual(["Anand"]);
    expect(february.collected).toBe(100);
  });
});
