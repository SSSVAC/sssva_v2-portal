import { EventFundReport, type EventBillRow, type EventContributionRow, type EventExpenseRow } from "@/components/event-fund-report";
import type { ReportDefinition, ReportLoaderContext } from "@/lib/reports/types";
import { fetchEventFundReportData } from "@/lib/event-fund";
import { MARGHAZHI_POOJAI_EXPENSE_ACCOUNT } from "@/lib/reports/constants";

type Props = {
  title: string;
  subtitle: string;
  fileSlug: string;
  printTarget: string;
  contributionRows: EventContributionRow[];
  expenseRows: EventExpenseRow[];
  billRows: EventBillRow[];
};

async function loadMarghazhiPoojai({ supabase }: ReportLoaderContext): Promise<Props> {
  const data = await fetchEventFundReportData(supabase, {
    incomeItemNames: ["மார்கழி பூஜை"],
    expenseAccountNames: [MARGHAZHI_POOJAI_EXPENSE_ACCOUNT]
  });

  return {
    title: "Marghazhi Poojai Report",
    subtitle: "மார்கழி பூஜை",
    fileSlug: "marghazhi-poojai-report",
    printTarget: "marghazhi-poojai",
    ...data
  };
}

export const marghazhiPoojai: ReportDefinition<Props> = {
  slug: "marghazhi-poojai",
  category: "events",
  title: "Marghazhi Poojai Report",
  description: "மார்கழி பூஜை — Contributions, expenses & bills, by year",
  summary: "Marghazhi Poojai fund, by year",
  loader: loadMarghazhiPoojai,
  Component: EventFundReport
};
