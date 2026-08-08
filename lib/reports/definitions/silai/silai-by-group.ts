import { SilaiGroupedReport, type SilaiGroupedRow } from "@/components/silai-grouped-report";
import type { ReportDefinition, ReportLoaderContext } from "@/lib/reports/types";
import { getAllCustomers } from "@/lib/reports/shared-queries";
import { FUND_ITEM_NAMES } from "@/lib/reports/constants";
import type { Database } from "@/types/database";

type InvoiceRow = Database["public"]["Tables"]["zoho_invoices"]["Row"];
type Contribution = Pick<InvoiceRow, "customer_id" | "customer_name" | "total">;

type Props = {
  rows: SilaiGroupedRow[];
};

async function loadSilaiByGroup({ supabase }: ReportLoaderContext): Promise<Props> {
  const [customers, { data: contributions }] = await Promise.all([
    getAllCustomers(supabase),
    supabase
      .from("zoho_invoices")
      .select("customer_id, customer_name, total")
      .or(FUND_ITEM_NAMES.map((name) => `item_name.ilike.%${name}%`).join(","))
      .returns<Contribution[]>()
  ]);

  const totalsById = new Map<string, number>();
  const totalsByName = new Map<string, number>();

  for (const contribution of contributions ?? []) {
    const amount = Number(contribution.total ?? 0);

    // Name-keyed totals only cover contributions with no customer_id, so a
    // shared display_name never double-counts an amount already
    // attributed to another customer by id.
    if (contribution.customer_id) {
      totalsById.set(contribution.customer_id, (totalsById.get(contribution.customer_id) ?? 0) + amount);
    } else if (contribution.customer_name) {
      const key = contribution.customer_name.trim().toLowerCase();
      totalsByName.set(key, (totalsByName.get(key) ?? 0) + amount);
    }
  }

  // Every customer who contributed to the Silai fund, member or not.
  // Members are listed regardless of whether they've contributed;
  // non-members only show up if they actually gave to the fund.
  const rows: SilaiGroupedRow[] = customers
    .map((customer) => {
      const total =
        totalsById.get(customer.zoho_customer_id) ?? totalsByName.get(customer.display_name.trim().toLowerCase()) ?? 0;

      return {
        id: customer.zoho_customer_id,
        name: customer.display_name,
        company: customer.company_name,
        phone: customer.phone,
        address: customer.billing_address,
        group: customer.customer_group,
        orderNumber: customer.order_number,
        total,
        isMember: customer.is_member
      };
    })
    .filter((row) => row.isMember || row.total > 0);

  return { rows };
}

export const silaiByGroup: ReportDefinition<Props> = {
  slug: "silai-by-group",
  category: "silai",
  title: "Silai by Group",
  description: "All Silai contributors (members and non-members), grouped by Group and ordered by Order #",
  summary: "Contributors grouped by street",
  loader: loadSilaiByGroup,
  Component: SilaiGroupedReport
};
