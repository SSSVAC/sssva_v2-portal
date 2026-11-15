import { EventFundReport, type EventBillRow, type EventContributionRow, type EventExpenseRow } from "@/components/event-fund-report";
import type { ReportDefinition, ReportLoaderContext } from "@/lib/reports/types";
import { fetchEventFundReportData, pickInitialEventYear } from "@/lib/event-fund";
import { MANDALA_POOJAI_EXPENSE_ACCOUNTS } from "@/lib/reports/constants";

type Props = {
  title: string;
  subtitle: string;
  fileSlug: string;
  printTarget: string;
  contributionRows: EventContributionRow[];
  expenseRows: EventExpenseRow[];
  billRows: EventBillRow[];
  initialYear?: string;
  initialShowAllMembers?: boolean;
  minimumAmount: number;
};

async function loadMandalaPoojai({ supabase, searchParams }: ReportLoaderContext): Promise<Props> {
  const data = await fetchEventFundReportData(supabase, {
    incomeItemNames: ["Mandala Pooja", "Mandala Poorthi", "மண்டல பூஜை", "மண்டல பூர்த்தி"],
    expenseAccountNames: MANDALA_POOJAI_EXPENSE_ACCOUNTS
  });

  return {
    title: "Mandala Poojai Report",
    subtitle: "மண்டல பூஜை & பூர்த்தி",
    fileSlug: "mandala-poojai-report",
    printTarget: "mandala-poojai",
    ...data,
    minimumAmount: 0,
    initialYear: pickInitialEventYear(data, searchParams.year),
    initialShowAllMembers: searchParams.all === "1"
  };
}

export const mandalaPoojai: ReportDefinition<Props> = {
  slug: "mandala-poojai",
  category: "events",
  title: "Mandala Poojai Report",
  description: "மண்டல பூஜை & பூர்த்தி — Poojai & Poorthi contributions, expenses & bills, by year",
  summary: "Mandala Poojai & Poorthi fund, by year",
  loader: loadMandalaPoojai,
  Component: EventFundReport
};
