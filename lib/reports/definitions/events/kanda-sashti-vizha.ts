import { EventFundReport, type EventBillRow, type EventContributionRow, type EventExpenseRow } from "@/components/event-fund-report";
import type { ReportDefinition, ReportLoaderContext } from "@/lib/reports/types";
import { fetchEventFundReportData, pickInitialEventYear } from "@/lib/event-fund";
import { KANDA_SASHTI_VIZHA_EXPENSE_ACCOUNT } from "@/lib/reports/constants";

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

async function loadKandaSashtiVizha({ supabase, searchParams }: ReportLoaderContext): Promise<Props> {
  const data = await fetchEventFundReportData(supabase, {
    incomeItemNames: ["Kanda Sashti Vizha", "கந்த சஷ்டி விழா"],
    expenseAccountNames: [KANDA_SASHTI_VIZHA_EXPENSE_ACCOUNT]
  });

  return {
    title: "Kanda Sashti Vizha Report",
    subtitle: "கந்த சஷ்டி கவசம்",
    fileSlug: "kanda-sashti-vizha-report",
    printTarget: "kanda-sashti-vizha",
    ...data,
    minimumAmount: 0,
    initialYear: pickInitialEventYear(data, searchParams.year),
    initialShowAllMembers: searchParams.all === "1"
  };
}

export const kandaSashtiVizha: ReportDefinition<Props> = {
  slug: "kanda-sashti-vizha",
  category: "events",
  title: "Kanda Sashti Vizha Report",
  description: "கந்த சஷ்டி கவசம் — Contributions, expenses & bills, by year",
  summary: "Kanda Sashti Vizha fund, by year",
  loader: loadKandaSashtiVizha,
  Component: EventFundReport
};
