import type { ReportCustomer } from "@/lib/reports/shared-queries";
import { groupKeyFor } from "@/lib/silai-groups";

/** One month column: the key invoices are bucketed by, and its two labels. */
export type ContributionMonth = {
  /** "YYYY-MM", the first seven characters of an invoice date. */
  key: string;
  /** "Jan 2026" — the column header and what a message names. */
  label: string;
  /** "Jan" — the header on a narrow screen, where twelve columns must fit. */
  short: string;
};

export type ContributionInvoice = {
  customer_id: string | null;
  customer_name: string | null;
  total: number | null;
  date: string | null;
};

export type MonthlyContributionRow = {
  id: string;
  memberName: string;
  /** Null when the viewer isn't allowed the contact details (a share link). */
  area: string | null;
  phone: string | null;
  /** Amount per month key; a month with nothing recorded is simply absent. */
  amounts: Record<string, number>;
  total: number;
  /** Months that reached the minimum, of the months that have happened. */
  monthsPaid: number;
};

/**
 * What one month's cell says about one member.
 *
 * "future" is not a state a member can be in — it's a month that hasn't
 * happened yet. Without it every row in a year still running would be a wall
 * of red for months nobody could have paid for.
 */
export type ContributionStatus = "full" | "partial" | "none" | "future";

export function contributionStatus(amount: number, minimum: number, isFuture: boolean): ContributionStatus {
  if (isFuture) return "future";
  if (amount >= minimum) return "full";
  if (amount > 0) return "partial";
  return "none";
}

/** The class that colours a cell, matching the pills used elsewhere. */
export function contributionStatusClass(status: ContributionStatus) {
  if (status === "full") return "cell-success";
  if (status === "partial") return "cell-warning";
  if (status === "none") return "cell-danger";
  return "";
}

// Dates are pinned to IST like lib/format, so "this month" doesn't change
// with where the server happens to be — a report opened at 2am in India
// must not already be in next month because Vercel runs in UTC.
const MONTH_ZONE = "Asia/Kolkata";

/** Today's month as a "YYYY-MM" key. */
export function currentMonthKey(now: Date = new Date()) {
  // en-CA formats as YYYY-MM-DD, so the key is just its first seven chars.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MONTH_ZONE,
    year: "numeric",
    month: "2-digit"
  })
    .format(now)
    .slice(0, 7);
}

/** Today's day of the month, in the same timezone. */
export function currentDayOfMonth(now: Date = new Date()) {
  return Number(
    new Intl.DateTimeFormat("en-CA", { timeZone: MONTH_ZONE, day: "numeric" }).format(now)
  );
}

/** Month keys are ISO, so a plain string compare orders them. */
export function isFutureMonth(monthKey: string, now: Date = new Date()) {
  return monthKey > currentMonthKey(now);
}

/** January to December of one calendar year, in order. */
export function contributionYearMonths(year: number): ContributionMonth[] {
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(year, index, 1));
    return {
      key: `${year}-${String(index + 1).padStart(2, "0")}`,
      label: new Intl.DateTimeFormat("en-IN", {
        month: "short",
        year: "numeric",
        timeZone: "UTC"
      }).format(date),
      short: new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "UTC" }).format(date)
    };
  });
}

/**
 * Sums contribution invoices per customer per month.
 *
 * Id first, name only as a fallback: an invoice with no customer_id is
 * credited by name, and a name that belongs to a customer already credited
 * by id is dropped rather than counted twice. This is the same rule the
 * all-time fund reports use, and the reason both cuts of the money agree.
 */
export function bucketAmountsByMonth(invoices: ContributionInvoice[], monthKeys: Set<string>) {
  const byId = new Map<string, Record<string, number>>();
  const byName = new Map<string, Record<string, number>>();

  invoices.forEach((invoice) => {
    if (!invoice.date) return;
    const monthKey = invoice.date.slice(0, 7);
    if (!monthKeys.has(monthKey)) return;

    const amount = Number(invoice.total ?? 0);

    if (invoice.customer_id) {
      const amounts = byId.get(invoice.customer_id) ?? {};
      amounts[monthKey] = (amounts[monthKey] ?? 0) + amount;
      byId.set(invoice.customer_id, amounts);
    } else if (invoice.customer_name) {
      const key = invoice.customer_name.trim().toLowerCase();
      const amounts = byName.get(key) ?? {};
      amounts[monthKey] = (amounts[monthKey] ?? 0) + amount;
      byName.set(key, amounts);
    }
  });

  return { byId, byName };
}

/**
 * One row per member, whether or not they have given anything — a tracker's
 * job is to show who hasn't. Members are ordered by area then name, so the
 * sheet reads the way a street collection is walked.
 */
export function buildMonthlyContributionRows({
  customers,
  invoices,
  months,
  minimum,
  includeContact = true,
  now = new Date()
}: {
  customers: ReportCustomer[];
  invoices: ContributionInvoice[];
  months: ContributionMonth[];
  minimum: number;
  /** False for a share link, where phone and area are withheld. */
  includeContact?: boolean;
  now?: Date;
}): MonthlyContributionRow[] {
  const monthKeys = new Set(months.map((month) => month.key));
  const { byId, byName } = bucketAmountsByMonth(invoices, monthKeys);
  const pastMonths = months.filter((month) => !isFutureMonth(month.key, now));

  return customers
    .filter((customer) => customer.is_member)
    .map((customer) => {
      const amounts =
        byId.get(customer.zoho_customer_id) ??
        byName.get(customer.display_name.trim().toLowerCase()) ??
        {};

      return {
        id: customer.zoho_customer_id,
        memberName: customer.display_name,
        area: includeContact ? groupKeyFor(customer.customer_group) : null,
        phone: includeContact ? customer.phone : null,
        amounts,
        total: months.reduce((sum, month) => sum + (amounts[month.key] ?? 0), 0),
        monthsPaid: pastMonths.filter((month) => (amounts[month.key] ?? 0) >= minimum).length
      };
    })
    .sort((a, b) => {
      const area = (a.area ?? "").localeCompare(b.area ?? "");
      if (area !== 0) return area;
      return a.memberName.localeCompare(b.memberName);
    });
}

export type MonthSummary = {
  monthKey: string;
  full: MonthlyContributionRow[];
  partial: MonthlyContributionRow[];
  none: MonthlyContributionRow[];
  collected: number;
};

/** Who has settled a given month, who is short, and who hasn't paid at all. */
export function summariseMonth(
  rows: MonthlyContributionRow[],
  monthKey: string,
  minimum: number
): MonthSummary {
  const summary: MonthSummary = { monthKey, full: [], partial: [], none: [], collected: 0 };

  rows.forEach((row) => {
    const amount = row.amounts[monthKey] ?? 0;
    summary.collected += amount;

    if (amount >= minimum) summary.full.push(row);
    else if (amount > 0) summary.partial.push(row);
    else summary.none.push(row);
  });

  return summary;
}
