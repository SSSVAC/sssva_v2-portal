import { SilaiFundReport, type SilaiContributionRow, type SilaiExpenseRow, type SilaiBillRow } from "@/components/silai-fund-report";
import type { ReportDefinition, ReportLoaderContext } from "@/lib/reports/types";
import { getAllCustomers, type ReportCustomer } from "@/lib/reports/shared-queries";
import { groupByStreet } from "@/lib/silai-groups";
import { FUND_ITEM_NAMES, SILAI_EXPENSE_ACCOUNT_NAME } from "@/lib/reports/constants";
import type { Database } from "@/types/database";

type InvoiceRow = Database["public"]["Tables"]["zoho_invoices"]["Row"];
type ExpenseRow = Database["public"]["Tables"]["zoho_expenses"]["Row"];
type BillRow = Database["public"]["Tables"]["zoho_bills"]["Row"];
type SilaiContributionInvoice = Pick<InvoiceRow, "customer_id" | "customer_name" | "date" | "total">;
type SilaiExpenseSource = Pick<ExpenseRow, "id" | "description" | "date" | "total">;
type SilaiBillSource = Pick<BillRow, "id" | "bill_number" | "vendor_name" | "date" | "total">;

type Props = {
  contributionRows: SilaiContributionRow[];
  expenseRows: SilaiExpenseRow[];
  billRows: SilaiBillRow[];
};

// One row per customer (multiple contribution invoices from the same
// customer are summed into a single total, id-then-name matched so a
// shared display_name never double-counts an amount already attributed by
// id), sorted (not grouped/sub-tabled here) into the same street walking
// order as Silai by Group / Silai Follow-up. Members who haven't
// contributed at all are included too (total: 0, isMember: true) so the
// "Show all members" toggle in SilaiFundReport can reveal them.
function buildContributionRows(invoices: SilaiContributionInvoice[], customers: ReportCustomer[]): SilaiContributionRow[] {
  const customerById = new Map<string, ReportCustomer>();
  const customerByName = new Map<string, ReportCustomer>();

  customers.forEach((customer) => {
    customerById.set(customer.zoho_customer_id, customer);
    customerByName.set(customer.display_name.trim().toLowerCase(), customer);
  });

  const totalsById = new Map<string, number>();
  const nameById = new Map<string, string>();
  const totalsByName = new Map<string, number>();

  invoices.forEach((invoice) => {
    const amount = Number(invoice.total ?? 0);

    if (invoice.customer_id) {
      totalsById.set(invoice.customer_id, (totalsById.get(invoice.customer_id) ?? 0) + amount);
      if (invoice.customer_name && !nameById.has(invoice.customer_id)) {
        nameById.set(invoice.customer_id, invoice.customer_name);
      }
    } else if (invoice.customer_name) {
      const key = invoice.customer_name.trim().toLowerCase();
      totalsByName.set(key, (totalsByName.get(key) ?? 0) + amount);
    }
  });

  const rowsWithGroup: {
    name: string;
    phone: string | null;
    address: string | null;
    group: string | null;
    orderNumber: number | null;
    isMember: boolean;
    total: number;
  }[] = [];
  const seenCustomerIds = new Set<string>();

  totalsById.forEach((total, customerId) => {
    const customer = customerById.get(customerId);
    seenCustomerIds.add(customerId);
    rowsWithGroup.push({
      name: nameById.get(customerId) ?? customer?.display_name ?? "",
      phone: customer?.phone ?? null,
      address: customer?.billing_address ?? null,
      group: customer?.customer_group ?? null,
      orderNumber: customer?.order_number ?? null,
      isMember: customer?.is_member ?? false,
      total
    });
  });

  totalsByName.forEach((total, nameKey) => {
    const customer = customerByName.get(nameKey);
    if (customer && seenCustomerIds.has(customer.zoho_customer_id)) return;
    if (customer) seenCustomerIds.add(customer.zoho_customer_id);
    rowsWithGroup.push({
      name: customer?.display_name ?? nameKey,
      phone: customer?.phone ?? null,
      address: customer?.billing_address ?? null,
      group: customer?.customer_group ?? null,
      orderNumber: customer?.order_number ?? null,
      isMember: customer?.is_member ?? false,
      total
    });
  });

  customers.forEach((customer) => {
    if (customer.is_member && !seenCustomerIds.has(customer.zoho_customer_id)) {
      rowsWithGroup.push({
        name: customer.display_name,
        phone: customer.phone,
        address: customer.billing_address,
        group: customer.customer_group,
        orderNumber: customer.order_number,
        isMember: true,
        total: 0
      });
    }
  });

  return groupByStreet(rowsWithGroup)
    .flatMap((group) => group.rows)
    .map((row) => ({
      donorName: row.name || null,
      group: row.group,
      phone: row.phone,
      address: row.address,
      isMember: row.isMember,
      total: row.total
    }));
}

async function loadSilaiFund({ supabase }: ReportLoaderContext): Promise<Props> {
  const [customers, { data: contributionInvoices }, { data: expenses }, { data: bills }] = await Promise.all([
    getAllCustomers(supabase),
    supabase
      .from("zoho_invoices")
      .select("customer_id, customer_name, date, total")
      .or(FUND_ITEM_NAMES.map((name) => `item_name.ilike.%${name}%`).join(","))
      .order("date", { ascending: false })
      .returns<SilaiContributionInvoice[]>(),
    supabase
      .from("zoho_expenses")
      .select("id, description, date, total")
      .eq("account_name", SILAI_EXPENSE_ACCOUNT_NAME)
      .order("date", { ascending: false })
      .returns<SilaiExpenseSource[]>(),
    supabase
      .from("zoho_bills")
      .select("id, bill_number, vendor_name, date, total")
      .eq("account_name", SILAI_EXPENSE_ACCOUNT_NAME)
      .order("date", { ascending: false })
      .returns<SilaiBillSource[]>()
  ]);

  return {
    contributionRows: buildContributionRows(contributionInvoices ?? [], customers),
    expenseRows: (expenses ?? []).map((expense) => ({
      id: expense.id,
      itemName: expense.description,
      date: expense.date,
      total: Number(expense.total ?? 0)
    })),
    billRows: (bills ?? []).map((bill) => ({
      id: bill.id,
      number: bill.bill_number,
      vendorName: bill.vendor_name,
      date: bill.date,
      total: Number(bill.total ?? 0)
    }))
  };
}

export const silaiFund: ReportDefinition<Props> = {
  slug: "silai-fund",
  category: "silai",
  title: "Silai Fund Report",
  description: "All-time contributions, expenses & bills for the statue installation fund",
  summary: "All-time contributions, grouped by street",
  loader: loadSilaiFund,
  Component: SilaiFundReport
};
