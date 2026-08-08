import { EventFundReport, type EventBillRow, type EventContributionRow, type EventExpenseRow } from "@/components/event-fund-report";
import type { ReportDefinition, ReportLoaderContext } from "@/lib/reports/types";
import { fetchEventFundReportData } from "@/lib/event-fund";
import { REGISTRATION_ITEM_NAME, REGISTRATION_EXPENSE_ACCOUNT } from "@/lib/reports/constants";

type Props = {
  title: string;
  fileSlug: string;
  printTarget: string;
  contributionRows: EventContributionRow[];
  expenseRows: EventExpenseRow[];
  billRows: EventBillRow[];
};

async function loadRegistration({ supabase }: ReportLoaderContext): Promise<Props> {
  const data = await fetchEventFundReportData(supabase, {
    incomeItemNames: [REGISTRATION_ITEM_NAME],
    expenseAccountNames: [REGISTRATION_EXPENSE_ACCOUNT]
  });

  return { title: "Registration Report", fileSlug: "registration-report", printTarget: "registration", ...data };
}

export const registration: ReportDefinition<Props> = {
  slug: "registration",
  category: "financial",
  title: "Registration Report",
  description: "Association registration fees, expenses & bills, by year",
  summary: "Registration fees, by year",
  loader: loadRegistration,
  Component: EventFundReport
};
