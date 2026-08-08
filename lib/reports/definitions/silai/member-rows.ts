import type { MemberRow } from "@/components/fund-status-table";
import type { ReportCustomer } from "@/lib/reports/shared-queries";
import { FUND_ITEM_NAMES, FUND_MINIMUM_AMOUNT } from "@/lib/reports/constants";
import type { ReportLoaderContext } from "@/lib/reports/types";
import type { Database } from "@/types/database";

type InvoiceRow = Database["public"]["Tables"]["zoho_invoices"]["Row"];
type Contribution = Pick<InvoiceRow, "customer_id" | "customer_name" | "total">;

// Shared by Silai Contributions and Silai Follow-up — both track members
// against the same per-member fund minimum.
export async function fetchContributions(supabase: ReportLoaderContext["supabase"]): Promise<Contribution[]> {
  const { data } = await supabase
    .from("zoho_invoices")
    .select("customer_id, customer_name, total")
    .or(FUND_ITEM_NAMES.map((name) => `item_name.ilike.%${name}%`).join(","))
    .returns<Contribution[]>();

  return data ?? [];
}

export function buildMemberRows(customers: ReportCustomer[], contributions: Contribution[]): MemberRow[] {
  const members = customers.filter((customer) => customer.is_member);

  const totalsById = new Map<string, number>();
  const totalsByName = new Map<string, number>();

  for (const contribution of contributions) {
    const amount = Number(contribution.total ?? 0);

    // Name-keyed totals are a fallback for contributions with no
    // customer_id; skipping id-matched ones here prevents a second
    // customer record sharing the same display_name from picking up the
    // same amount again through the name fallback below.
    if (contribution.customer_id) {
      totalsById.set(contribution.customer_id, (totalsById.get(contribution.customer_id) ?? 0) + amount);
    } else if (contribution.customer_name) {
      const key = contribution.customer_name.trim().toLowerCase();
      totalsByName.set(key, (totalsByName.get(key) ?? 0) + amount);
    }
  }

  return members.map((member) => {
    const paid =
      totalsById.get(member.zoho_customer_id) ?? totalsByName.get(member.display_name.trim().toLowerCase()) ?? 0;
    const status = paid >= FUND_MINIMUM_AMOUNT ? "fully_paid" : paid > 0 ? "partially_paid" : "not_paid";

    return {
      id: member.zoho_customer_id,
      name: member.display_name,
      phone: member.phone,
      address: member.billing_address,
      group: member.customer_group,
      orderNumber: member.order_number,
      paid,
      balanceDue: Math.max(0, FUND_MINIMUM_AMOUNT - paid),
      status
    };
  });
}
