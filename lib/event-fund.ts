import type { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { EventBillRow, EventContributionRow, EventExpenseRow } from "@/components/event-fund-report";

type CustomerRow = Database["public"]["Tables"]["zoho_customers"]["Row"];

export type EventFundCustomer = Pick<
  CustomerRow,
  "zoho_customer_id" | "display_name" | "phone" | "billing_address" | "customer_group" | "order_number" | "is_member"
>;

export type EventFundInvoice = {
  customer_id: string | null;
  customer_name: string | null;
  date: string | null;
  total: number;
};

export type EventFundExpense = {
  id: string;
  description: string | null;
  date: string | null;
  total: number;
};

export type EventFundBill = {
  id: string;
  bill_number: string | null;
  vendor_name: string | null;
  date: string | null;
  total: number;
};

function yearOf(date: string | null) {
  return date ? date.slice(0, 4) : "Unknown";
}

// One row per (customer, year) — multiple contribution invoices from the
// same customer in the same year are summed (id-then-name matched, same
// pattern as app/reports/page.tsx's buildMemberRows, to avoid a shared
// display_name double-counting an amount already attributed by id).
// Members with no contribution in a given year still get a row
// (total: 0) for every year that has any data at all, so the "show all
// members" toggle in EventFundReport can reveal who hasn't paid that year.
export function buildEventContributionRows(
  invoices: EventFundInvoice[],
  customers: EventFundCustomer[]
): EventContributionRow[] {
  const customerById = new Map<string, EventFundCustomer>();
  const customerByName = new Map<string, EventFundCustomer>();

  customers.forEach((customer) => {
    customerById.set(customer.zoho_customer_id, customer);
    customerByName.set(customer.display_name.trim().toLowerCase(), customer);
  });

  const years = new Set<string>();
  invoices.forEach((invoice) => years.add(yearOf(invoice.date)));

  const rows: EventContributionRow[] = [];

  years.forEach((year) => {
    const yearInvoices = invoices.filter((invoice) => yearOf(invoice.date) === year);

    const totalsById = new Map<string, number>();
    const nameById = new Map<string, string>();
    const totalsByName = new Map<string, number>();

    yearInvoices.forEach((invoice) => {
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

    const seenCustomerIds = new Set<string>();

    totalsById.forEach((total, customerId) => {
      const customer = customerById.get(customerId);
      seenCustomerIds.add(customerId);
      rows.push({
        year,
        donorName: nameById.get(customerId) ?? customer?.display_name ?? null,
        phone: customer?.phone ?? null,
        address: customer?.billing_address ?? null,
        group: customer?.customer_group ?? null,
        isMember: customer?.is_member ?? false,
        total
      });
    });

    totalsByName.forEach((total, nameKey) => {
      const customer = customerByName.get(nameKey);
      if (customer && seenCustomerIds.has(customer.zoho_customer_id)) return;
      if (customer) seenCustomerIds.add(customer.zoho_customer_id);
      rows.push({
        year,
        donorName: customer?.display_name ?? nameKey,
        phone: customer?.phone ?? null,
        address: customer?.billing_address ?? null,
        group: customer?.customer_group ?? null,
        isMember: customer?.is_member ?? false,
        total
      });
    });

    customers.forEach((customer) => {
      if (customer.is_member && !seenCustomerIds.has(customer.zoho_customer_id)) {
        rows.push({
          year,
          donorName: customer.display_name,
          phone: customer.phone,
          address: customer.billing_address,
          group: customer.customer_group,
          isMember: true,
          total: 0
        });
      }
    });
  });

  return rows;
}

export function buildEventExpenseRows(expenses: EventFundExpense[]): EventExpenseRow[] {
  return expenses.map((expense) => ({
    id: expense.id,
    itemName: expense.description,
    date: expense.date,
    year: yearOf(expense.date),
    total: Number(expense.total ?? 0)
  }));
}

export function buildEventBillRows(bills: EventFundBill[]): EventBillRow[] {
  return bills.map((bill) => ({
    id: bill.id,
    number: bill.bill_number,
    vendorName: bill.vendor_name,
    date: bill.date,
    year: yearOf(bill.date),
    total: Number(bill.total ?? 0)
  }));
}

export type EventFundReportData = {
  contributionRows: EventContributionRow[];
  expenseRows: EventExpenseRow[];
  billRows: EventBillRow[];
};

// Shared fetch+build for the year-filterable event reports (Ugadi,
// Varushabishegam, Marghazhi Poojai, ...): income is matched by invoice
// item_name (contains, case-insensitive — mirrors FUND_ITEM_NAMES in
// app/reports/page.tsx), expenses/bills by exact account_name.
export async function fetchEventFundReportData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  config: { incomeItemNames: string[]; expenseAccountNames: string[] }
): Promise<EventFundReportData> {
  const [{ data: invoices }, { data: expenses }, { data: bills }, { data: customers }] = await Promise.all([
    supabase
      .from("zoho_invoices")
      .select("customer_id, customer_name, date, total")
      .or(config.incomeItemNames.map((name) => `item_name.ilike.%${name}%`).join(","))
      .returns<EventFundInvoice[]>(),
    supabase
      .from("zoho_expenses")
      .select("id, description, date, total")
      .in("account_name", config.expenseAccountNames)
      .order("date", { ascending: false })
      .returns<EventFundExpense[]>(),
    supabase
      .from("zoho_bills")
      .select("id, bill_number, vendor_name, date, total")
      .in("account_name", config.expenseAccountNames)
      .order("date", { ascending: false })
      .returns<EventFundBill[]>(),
    supabase
      .from("zoho_customers")
      .select("zoho_customer_id, display_name, phone, billing_address, customer_group, order_number, is_member")
      .returns<EventFundCustomer[]>()
  ]);

  return {
    contributionRows: buildEventContributionRows(invoices ?? [], customers ?? []),
    expenseRows: buildEventExpenseRows(expenses ?? []),
    billRows: buildEventBillRows(bills ?? [])
  };
}
