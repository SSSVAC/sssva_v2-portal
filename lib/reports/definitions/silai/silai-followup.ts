import { SilaiFollowUpReport } from "@/components/silai-followup-report";
import type { MemberRow } from "@/components/fund-status-table";
import type { ReportDefinition, ReportLoaderContext } from "@/lib/reports/types";
import { getAllCustomers } from "@/lib/reports/shared-queries";
import { buildMemberRows, fetchContributions } from "@/lib/reports/definitions/silai/member-rows";
import { FUND_MINIMUM_AMOUNT } from "@/lib/reports/constants";
import { formatCurrency } from "@/lib/format";

type Props = {
  members: MemberRow[];
};

async function loadSilaiFollowup({ supabase }: ReportLoaderContext): Promise<Props> {
  const [customers, contributions] = await Promise.all([getAllCustomers(supabase), fetchContributions(supabase)]);
  return { members: buildMemberRows(customers, contributions) };
}

export const silaiFollowup: ReportDefinition<Props> = {
  slug: "silai-followup",
  category: "silai",
  title: "Silai Follow-up",
  description: `Members who haven't reached the ${formatCurrency(FUND_MINIMUM_AMOUNT)} minimum, grouped by Group and ordered by Order #`,
  summary: "Not-paid / partially-paid members",
  loader: loadSilaiFollowup,
  Component: SilaiFollowUpReport
};
