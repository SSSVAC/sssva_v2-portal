import { SilaiFundReport } from "@/components/silai-fund-report";
import type { ReportDefinition, ReportLoaderContext } from "@/lib/reports/types";
import { fetchAllTimeFundReportData, type AllTimeFundReportData } from "@/lib/reports/all-time-fund";
import { REGISTRATION_ITEM_NAME, REGISTRATION_EXPENSE_ACCOUNT } from "@/lib/reports/constants";

type Props = AllTimeFundReportData & {
  title: string;
  subtitle: string;
  fileSlug: string;
  printTarget: string;
  initialShowAllMembers?: boolean;
};

// One-time per-member activity (not annual), so this uses the all-time
// fund pattern (like Silai Fund Report) instead of the year-dropdown
// EventFundReport the other financial/event reports use.
async function loadRegistration({ supabase, searchParams }: ReportLoaderContext): Promise<Props> {
  const data = await fetchAllTimeFundReportData(supabase, {
    incomeItemNames: [REGISTRATION_ITEM_NAME],
    expenseAccountNames: [REGISTRATION_EXPENSE_ACCOUNT]
  });

  return {
    title: "Registration Report",
    subtitle: "Association Registration Fund — all time",
    fileSlug: "registration",
    printTarget: "registration",
    ...data,
    initialShowAllMembers: searchParams.all === "1"
  };
}

export const registration: ReportDefinition<Props> = {
  slug: "registration",
  category: "financial",
  title: "Registration Report",
  description: "Association registration fees, expenses & bills — all time",
  summary: "One-time registration fees, all-time",
  loader: loadRegistration,
  Component: SilaiFundReport
};
