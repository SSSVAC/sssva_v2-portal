import { SilaiContributionsReport } from "@/components/reports/silai-contributions-report";
import type { MemberRow } from "@/components/fund-status-table";
import type { ReportDefinition, ReportLoaderContext } from "@/lib/reports/types";
import { getAllCustomers } from "@/lib/reports/shared-queries";
import { buildMemberRows, fetchContributions } from "@/lib/reports/definitions/silai/member-rows";
import { FUND_MINIMUM_AMOUNT } from "@/lib/reports/constants";
import { formatCurrency } from "@/lib/format";

type Props = {
  memberRows: MemberRow[];
  fundMinimumAmount: number;
};

async function loadSilaiContributions({ supabase }: ReportLoaderContext): Promise<Props> {
  const [customers, contributions] = await Promise.all([getAllCustomers(supabase), fetchContributions(supabase)]);

  return {
    memberRows: buildMemberRows(customers, contributions),
    fundMinimumAmount: FUND_MINIMUM_AMOUNT
  };
}

export const silaiContributions: ReportDefinition<Props> = {
  slug: "silai-contributions",
  category: "silai",
  title: "Members Silai Contributions",
  description: `சிலை வைப்பதற்கான நிதி — minimum ${formatCurrency(FUND_MINIMUM_AMOUNT)} per member`,
  summary: "Member fund-minimum status tracking",
  loader: loadSilaiContributions,
  Component: SilaiContributionsReport
};
