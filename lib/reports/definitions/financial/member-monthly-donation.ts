import { MonthlyDonationsReport, type DonationMonth, type DonorDonationRow } from "@/components/monthly-donations-report";
import type { ReportDefinition, ReportLoaderContext } from "@/lib/reports/types";
import { getAllCustomers, getLastNMonths } from "@/lib/reports/shared-queries";
import { DONATION_ITEM_NAME, DONATION_MONTHS_SHOWN } from "@/lib/reports/constants";
import type { Database } from "@/types/database";

type InvoiceRow = Database["public"]["Tables"]["zoho_invoices"]["Row"];
type DonationInvoice = Pick<InvoiceRow, "customer_id" | "customer_name" | "total" | "date">;

type Props = {
  months: DonationMonth[];
  donors: DonorDonationRow[];
};

async function loadMemberMonthlyDonation({ supabase }: ReportLoaderContext): Promise<Props> {
  const months = getLastNMonths(DONATION_MONTHS_SHOWN);
  const rangeStart = `${months[0].key}-01`;

  const [customers, { data: donationInvoices }] = await Promise.all([
    getAllCustomers(supabase),
    supabase
      .from("zoho_invoices")
      .select("customer_id, customer_name, total, date")
      .is("archived_at", null)
      .ilike("item_name", `%${DONATION_ITEM_NAME}%`)
      .gte("date", rangeStart)
      .returns<DonationInvoice[]>()
  ]);

  const members = customers.filter((customer) => customer.is_member);
  const monthKeys = new Set(months.map((month) => month.key));
  const amountsById = new Map<string, Record<string, number>>();
  const amountsByName = new Map<string, Record<string, number>>();

  for (const invoice of donationInvoices ?? []) {
    if (!invoice.date) continue;
    const monthKey = invoice.date.slice(0, 7);
    if (!monthKeys.has(monthKey)) continue;

    const amount = Number(invoice.total ?? 0);

    // Name-keyed totals are a fallback for invoices with no customer_id;
    // skipping id-matched ones here prevents a second customer record
    // sharing the same display_name from picking up the same amount again
    // through the name fallback below.
    if (invoice.customer_id) {
      const amounts = amountsById.get(invoice.customer_id) ?? {};
      amounts[monthKey] = (amounts[monthKey] ?? 0) + amount;
      amountsById.set(invoice.customer_id, amounts);
    } else if (invoice.customer_name) {
      const key = invoice.customer_name.trim().toLowerCase();
      const amounts = amountsByName.get(key) ?? {};
      amounts[monthKey] = (amounts[monthKey] ?? 0) + amount;
      amountsByName.set(key, amounts);
    }
  }

  const donors: DonorDonationRow[] = members.map((member) => {
    const amounts =
      amountsById.get(member.zoho_customer_id) ?? amountsByName.get(member.display_name.trim().toLowerCase()) ?? {};
    const total = months.reduce((sum, month) => sum + (amounts[month.key] ?? 0), 0);

    return {
      id: member.zoho_customer_id,
      donorName: member.display_name,
      amounts,
      total
    };
  });

  return { months, donors };
}

export const memberMonthlyDonation: ReportDefinition<Props> = {
  slug: "member-monthly-donation",
  category: "financial",
  title: "Member Monthly Donation",
  description: `Donations and/or Sponsorships — last ${DONATION_MONTHS_SHOWN} months`,
  summary: `Member donation totals by month, last ${DONATION_MONTHS_SHOWN} months`,
  loader: loadMemberMonthlyDonation,
  Component: MonthlyDonationsReport
};
