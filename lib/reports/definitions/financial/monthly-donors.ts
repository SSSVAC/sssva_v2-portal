import { DonorContactReport, type DonorContactRow } from "@/components/donor-contact-report";
import type { DonationMonth } from "@/components/monthly-donations-report";
import type { ReportDefinition, ReportLoaderContext } from "@/lib/reports/types";
import { getAllCustomers, getLastNMonths } from "@/lib/reports/shared-queries";
import { DONATION_ITEM_NAME, DONATION_MONTHS_SHOWN } from "@/lib/reports/constants";
import type { Database } from "@/types/database";

type InvoiceRow = Database["public"]["Tables"]["zoho_invoices"]["Row"];
type DonationInvoice = Pick<InvoiceRow, "customer_id" | "customer_name" | "total" | "date">;

type Props = {
  months: DonationMonth[];
  donors: DonorContactRow[];
};

// Same monthly amount aggregation as Member Monthly Donation, but applied to
// all customers (not just flagged members) and filtered down to only those
// who actually contributed in the window, since this report is for mailing
// donor contact info alongside their recent giving history.
async function loadMonthlyDonors({ supabase }: ReportLoaderContext): Promise<Props> {
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

  const monthKeys = new Set(months.map((month) => month.key));
  const amountsById = new Map<string, Record<string, number>>();
  const amountsByName = new Map<string, Record<string, number>>();

  for (const invoice of donationInvoices ?? []) {
    if (!invoice.date) continue;
    const monthKey = invoice.date.slice(0, 7);
    if (!monthKeys.has(monthKey)) continue;

    const amount = Number(invoice.total ?? 0);

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

  const donors: DonorContactRow[] = customers
    .map((customer) => {
      const amounts =
        amountsById.get(customer.zoho_customer_id) ??
        amountsByName.get(customer.display_name.trim().toLowerCase()) ??
        {};
      const total = months.reduce((sum, month) => sum + (amounts[month.key] ?? 0), 0);

      return {
        id: customer.zoho_customer_id,
        donorName: customer.display_name,
        address: customer.billing_address,
        amounts,
        total
      };
    })
    .filter((row) => row.total > 0);

  return { months, donors };
}

export const monthlyDonors: ReportDefinition<Props> = {
  slug: "monthly-donors",
  category: "financial",
  title: "Monthly Donors",
  description: `All customers who contributed to Donations and/or Sponsorships in the last ${DONATION_MONTHS_SHOWN} months`,
  summary: `Donor contact list, last ${DONATION_MONTHS_SHOWN} months`,
  loader: loadMonthlyDonors,
  Component: DonorContactReport
};
