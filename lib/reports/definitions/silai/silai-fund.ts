import { SilaiFundReport } from "@/components/silai-fund-report";
import type { ReportDefinition, ReportLoaderContext } from "@/lib/reports/types";
import { fetchAllTimeFundReportData, type AllTimeFundReportData } from "@/lib/reports/all-time-fund";
import { FUND_ITEM_NAMES, SILAI_EXPENSE_ACCOUNT_NAME } from "@/lib/reports/constants";
import { readContributionViewParams } from "@/lib/reports/contribution-entries";
import type { ContributionView } from "@/components/silai-fund-report";

type Props = AllTimeFundReportData & {
  initialShowAllMembers?: boolean;
  initialContributionView?: ContributionView;
  initialDateOrder?: "asc" | "desc";
};

async function loadSilaiFund({ supabase, searchParams }: ReportLoaderContext): Promise<Props> {
  const data = await fetchAllTimeFundReportData(supabase, {
    incomeItemNames: FUND_ITEM_NAMES,
    expenseAccountNames: [SILAI_EXPENSE_ACCOUNT_NAME]
  });

  return {
    ...data,
    initialShowAllMembers: searchParams.all === "1",
    ...readContributionViewParams(searchParams)
  };
}

export const silaiFund: ReportDefinition<Props> = {
  slug: "silai-fund",
  category: "silai",
  title: "Silai Fund Report",
  description: "All-time contributions, expenses & bills for the statue installation fund",
  summary: "All-time contributions, by street or by date",
  loader: loadSilaiFund,
  Component: SilaiFundReport
};
