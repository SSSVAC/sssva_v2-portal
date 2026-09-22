import {
  MonthlyContributionsReport,
  type ContributionMonth,
  type MonthlyContributionRow
} from "@/components/monthly-contributions-report";
import type { ReportDefinition, ReportLoaderContext } from "@/lib/reports/types";
import { getAllCustomers } from "@/lib/reports/shared-queries";
import {
  CONTRIBUTION_FOLLOW_UP_DAY,
  DONATION_ITEM_NAME,
  MONTHLY_CONTRIBUTION_MINIMUM
} from "@/lib/reports/constants";
import {
  buildMonthlyContributionRows,
  contributionYearMonths,
  currentDayOfMonth,
  currentMonthKey,
  type ContributionInvoice
} from "@/lib/reports/monthly-contributions";

type Props = {
  year: number;
  years: number[];
  months: ContributionMonth[];
  rows: MonthlyContributionRow[];
  minimum: number;
  currentMonthKey: string;
  today: number;
  followUpDay: number;
  showContact: boolean;
};

// How far back the year picker goes. The association's records in Zoho
// don't predate this, and an empty sheet for 2019 is just a wrong turn.
const EARLIEST_YEAR = 2023;

function readYear(searchParams: Record<string, string | undefined>, thisYear: number) {
  const requested = Number(searchParams.year);
  if (!Number.isInteger(requested)) return thisYear;

  return Math.min(Math.max(requested, EARLIEST_YEAR), thisYear);
}

async function loadMonthlyContributions({
  supabase,
  searchParams,
  isGuest
}: ReportLoaderContext): Promise<Props> {
  const now = new Date();
  const thisMonth = currentMonthKey(now);
  const thisYear = Number(thisMonth.slice(0, 4));
  const year = readYear(searchParams, thisYear);
  const months = contributionYearMonths(year);

  const [customers, { data: invoices }] = await Promise.all([
    getAllCustomers(supabase),
    supabase
      .from("zoho_invoices")
      .select("customer_id, customer_name, total, date")
      .is("archived_at", null)
      .ilike("item_name", `%${DONATION_ITEM_NAME}%`)
      .gte("date", `${year}-01-01`)
      .lte("date", `${year}-12-31`)
      .returns<ContributionInvoice[]>()
  ]);

  return {
    year,
    years: Array.from({ length: thisYear - EARLIEST_YEAR + 1 }, (_, index) => thisYear - index),
    months,
    // A share link's copy carries no phone numbers or areas at all — they
    // are dropped here, before the data reaches the page, rather than
    // hidden in the markup where a view-source would still find them.
    rows: buildMonthlyContributionRows({
      customers,
      invoices: invoices ?? [],
      months,
      minimum: MONTHLY_CONTRIBUTION_MINIMUM,
      includeContact: !isGuest,
      now
    }),
    minimum: MONTHLY_CONTRIBUTION_MINIMUM,
    currentMonthKey: thisMonth,
    today: currentDayOfMonth(now),
    followUpDay: CONTRIBUTION_FOLLOW_UP_DAY,
    showContact: !isGuest
  };
}

// Shareable: this is the one financial report a guest may open, because a
// guest's copy has no phone numbers or areas in it. That permission lives in
// GUEST_SHAREABLE_REPORTS in lib/auth/guest-scope.ts, not here — see the note
// there about why a report can't grant it to itself.
export const monthlyContributions: ReportDefinition<Props> = {
  slug: "monthly-contributions",
  category: "financial",
  title: "Monthly Fixed Contributions",
  description: `Each member's ${MONTHLY_CONTRIBUTION_MINIMUM} rupee monthly contribution, month by month`,
  summary: "Member dues tracker — twelve months at a glance",
  loader: loadMonthlyContributions,
  Component: MonthlyContributionsReport
};
