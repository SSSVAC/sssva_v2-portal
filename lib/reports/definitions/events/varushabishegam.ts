import { EventFundReport, type EventBillRow, type EventContributionRow, type EventExpenseRow } from "@/components/event-fund-report";
import type { ReportDefinition, ReportLoaderContext } from "@/lib/reports/types";
import { fetchEventFundReportData } from "@/lib/event-fund";

type Props = {
  title: string;
  subtitle: string;
  fileSlug: string;
  printTarget: string;
  contributionRows: EventContributionRow[];
  expenseRows: EventExpenseRow[];
  billRows: EventBillRow[];
};

// "வருஷாபிஷேகம்" (Varusha Abhishegam, the annual one) is distinct from the
// regular "Abishegam" item — see lib/reports/constants.ts.
async function loadVarushabishegam({ supabase }: ReportLoaderContext): Promise<Props> {
  const data = await fetchEventFundReportData(supabase, {
    incomeItemNames: ["வருஷாபிஷேகம்"],
    expenseAccountNames: ["Varushabishekam Expenses"]
  });

  return {
    title: "Varushabishegam Report",
    subtitle: "வருஷாபிஷேகம்",
    fileSlug: "varushabishegam-report",
    printTarget: "varushabishegam",
    ...data
  };
}

export const varushabishegam: ReportDefinition<Props> = {
  slug: "varushabishegam",
  category: "events",
  title: "Varushabishegam Report",
  description: "வருஷாபிஷேகம் — Contributions, expenses & bills, by year",
  summary: "Varushabishegam fund, by year",
  loader: loadVarushabishegam,
  Component: EventFundReport
};
