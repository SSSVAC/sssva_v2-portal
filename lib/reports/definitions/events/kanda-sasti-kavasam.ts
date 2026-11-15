import { EventFundReport, type EventBillRow, type EventContributionRow, type EventExpenseRow } from "@/components/event-fund-report";
import type { ReportDefinition, ReportLoaderContext } from "@/lib/reports/types";
import { fetchEventFundReportData, pickInitialEventYear } from "@/lib/event-fund";
import { KANDA_SASTI_KAVASAM_EXPENSE_ACCOUNT } from "@/lib/reports/constants";

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
};

async function loadKandaSastiKavasam({ supabase, searchParams }: ReportLoaderContext): Promise<Props> {
  const data = await fetchEventFundReportData(supabase, {
    incomeItemNames: ["Kanda Sasti Kavasam", "கந்த சஷ்டி கவசம்"],
    expenseAccountNames: [KANDA_SASTI_KAVASAM_EXPENSE_ACCOUNT]
  });

  return {
    title: "Kanda Sasti Kavasam Report",
    subtitle: "கந்த சஷ்டி கவசம்",
    fileSlug: "kanda-sasti-kavasam-report",
    printTarget: "kanda-sasti-kavasam",
    ...data,
    initialYear: pickInitialEventYear(data, searchParams.year),
    initialShowAllMembers: searchParams.all === "1"
  };
}

export const kandaSastiKavasam: ReportDefinition<Props> = {
  slug: "kanda-sasti-kavasam",
  category: "events",
  title: "Kanda Sasti Kavasam Report",
  description: "கந்த சஷ்டி கவசம் — Contributions, expenses & bills, by year",
  summary: "Kanda Sasti Kavasam fund, by year",
  loader: loadKandaSastiKavasam,
  Component: EventFundReport
};
