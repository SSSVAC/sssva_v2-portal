import { SilaiFundReport } from "@/components/silai-fund-report";
import type { ReportDefinition, ReportLoaderContext } from "@/lib/reports/types";
import { fetchAllTimeFundReportData, type AllTimeFundReportData } from "@/lib/reports/all-time-fund";
import { FUND_ITEM_NAMES, SILAI_EXPENSE_ACCOUNT_NAME } from "@/lib/reports/constants";

async function loadSilaiFund({ supabase }: ReportLoaderContext): Promise<AllTimeFundReportData> {
  return fetchAllTimeFundReportData(supabase, {
    incomeItemNames: FUND_ITEM_NAMES,
    expenseAccountNames: [SILAI_EXPENSE_ACCOUNT_NAME]
  });
}

export const silaiFund: ReportDefinition<AllTimeFundReportData> = {
  slug: "silai-fund",
  category: "silai",
  title: "Silai Fund Report",
  description: "All-time contributions, expenses & bills for the statue installation fund",
  summary: "All-time contributions, grouped by street",
  loader: loadSilaiFund,
  Component: SilaiFundReport
};
