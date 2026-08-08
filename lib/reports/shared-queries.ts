import { cache } from "react";
import type { Database } from "@/types/database";
import type { ReportLoaderContext } from "@/lib/reports/types";

type CustomerRow = Database["public"]["Tables"]["zoho_customers"]["Row"];

// Superset of every customer field any report needs (Member/Customer/
// SilaiGroupedCustomer in the old app/reports/page.tsx were all narrower
// picks of this same shape) — one query, request-deduplicated via
// React.cache(), instead of every report re-fetching its own subset.
export type ReportCustomer = Pick<
  CustomerRow,
  "zoho_customer_id" | "display_name" | "company_name" | "phone" | "billing_address" | "customer_group" | "order_number" | "is_member"
>;

export const getAllCustomers = cache(async (supabase: ReportLoaderContext["supabase"]): Promise<ReportCustomer[]> => {
  const { data } = await supabase
    .from("zoho_customers")
    .select("zoho_customer_id, display_name, company_name, phone, billing_address, customer_group, order_number, is_member")
    .order("display_name", { ascending: true })
    .returns<ReportCustomer[]>();

  return data ?? [];
});

// Returns the last `count` calendar months (oldest first) ending with the
// current month, as "YYYY-MM" keys with short display labels.
export function getLastNMonths(count: number) {
  const now = new Date();
  const months: { key: string; label: string }[] = [];

  for (let i = count - 1; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
    const label = new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" }).format(monthDate);
    months.push({ key, label });
  }

  return months;
}
