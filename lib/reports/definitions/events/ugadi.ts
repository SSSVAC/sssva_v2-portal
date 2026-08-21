import { EventFundReport, type EventBillRow, type EventContributionRow, type EventExpenseRow } from "@/components/event-fund-report";
import type { ReportDefinition, ReportLoaderContext } from "@/lib/reports/types";
import { fetchEventFundReportData, pickInitialEventYear } from "@/lib/event-fund";

type Props = {
  title: string;
  fileSlug: string;
  printTarget: string;
  contributionRows: EventContributionRow[];
  expenseRows: EventExpenseRow[];
  billRows: EventBillRow[];
  initialYear?: string;
  initialShowAllMembers?: boolean;
};

async function loadUgadi({ supabase, searchParams }: ReportLoaderContext): Promise<Props> {
  const data = await fetchEventFundReportData(supabase, {
    incomeItemNames: ["Ugadi"],
    expenseAccountNames: ["Ugadi"]
  });

  return {
    title: "Ugadi Report",
    fileSlug: "ugadi-report",
    printTarget: "ugadi",
    ...data,
    initialYear: pickInitialEventYear(data, searchParams.year),
    initialShowAllMembers: searchParams.all === "1"
  };
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
