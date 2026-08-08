import { EventFundReport, type EventBillRow, type EventContributionRow, type EventExpenseRow } from "@/components/event-fund-report";
import type { ReportDefinition, ReportLoaderContext } from "@/lib/reports/types";
import { fetchEventFundReportData } from "@/lib/event-fund";

type Props = {
  title: string;
  fileSlug: string;
  printTarget: string;
  contributionRows: EventContributionRow[];
  expenseRows: EventExpenseRow[];
  billRows: EventBillRow[];
};

async function loadUgadi({ supabase }: ReportLoaderContext): Promise<Props> {
  const data = await fetchEventFundReportData(supabase, {
    incomeItemNames: ["Ugadi"],
    expenseAccountNames: ["Ugadi"]
  });

  return { title: "Ugadi Report", fileSlug: "ugadi-report", printTarget: "ugadi", ...data };
}

export const ugadi: ReportDefinition<Props> = {
  slug: "ugadi",
  category: "events",
  title: "Ugadi Report",
  description: "Contributions, expenses & bills for Ugadi, by year",
  summary: "Ugadi fund, by year",
  loader: loadUgadi,
  Component: EventFundReport
};
