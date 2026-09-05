import type { SilaiBillRow, SilaiContributionRow, SilaiExpenseRow } from "@/components/silai-fund-report";
import {
  sortContributionEntries,
  type SilaiContributionEntry
} from "@/lib/reports/contribution-entries";
import { groupByStreet } from "@/lib/silai-groups";
import { getAllCustomers, type ReportCustomer } from "@/lib/reports/shared-queries";
import type { ReportLoaderContext } from "@/lib/reports/types";
import { fetchBillPayments, type BillPaymentRow } from "@/lib/reports/bill-payments";

export type AllTimeFundInvoice = {
  zoho_invoice_id: string;
  customer_id: string | null;
  customer_name: string | null;
  date: string | null;
  total: number;
  subject: string | null;
};

export type NonCashDonationRow = {
  donorName: string | null;
  address: string | null;
  detail: string;
};

export type AllTimeFundExpense = {
  id: string;
  vendor_name: string | null;
  description: string | null;
  date: string | null;
  total: number;
};

export type AllTimeFundBill = {
  id: string;
  zoho_bill_id: string;
  bill_number: string | null;
  vendor_name: string | null;
  date: string | null;
  total: number;
  balance: number;
};

// Shared by any all-time (not year-filtered) fund report — Silai Fund,
// Registration, and any future one-time-activity fund. One row per
// customer (multiple contribution invoices from the same customer are
// summed into a single total, id-then-name matched so a shared
// display_name never double-counts an amount already attributed by id),
// sorted into the same street walking order as Silai by Group / Silai
// Follow-up. Members who haven't contributed at all are included too
// (total: 0, isMember: true) so a "show all members" toggle can reveal
// them — the report component filters them out by default.
export function buildAllTimeContributionRows(
  invoices: AllTimeFundInvoice[],
  customers: ReportCustomer[]
): SilaiContributionRow[] {
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

// The same contributions the street view aggregates, left un-aggregated:
// one row per contribution invoice, carrying the date it came in. The two
// views have to add up to the same figure, so this repeats the id-then-name
// matching buildAllTimeContributionRows uses — an invoice carrying no
// customer_id whose donor name belongs to a customer already credited by id
// is that customer's amount counted a second time, and is skipped here just
// as its name bucket is dropped there.
//
// Zero-total invoices are left out: they aren't cash, they're the non-cash
// donations listed in their own section, and a ledger of ₹0 lines would bury
// the contributions this view exists to show. They contribute 0 either way,
// so both views still total the same.
export function buildAllTimeContributionEntries(
  invoices: AllTimeFundInvoice[],
  customers: ReportCustomer[]
): SilaiContributionEntry[] {
  const customerById = new Map<string, ReportCustomer>();
  const customerByName = new Map<string, ReportCustomer>();

  customers.forEach((customer) => {
    customerById.set(customer.zoho_customer_id, customer);
    customerByName.set(customer.display_name.trim().toLowerCase(), customer);
  });

  const idCreditedCustomerIds = new Set(
    invoices.map((invoice) => invoice.customer_id).filter((id): id is string => Boolean(id))
  );

  const entries: SilaiContributionEntry[] = [];

  invoices.forEach((invoice) => {
    const amount = Number(invoice.total ?? 0);
    if (amount === 0) return;

    const byName = invoice.customer_name
      ? customerByName.get(invoice.customer_name.trim().toLowerCase())
      : undefined;

    if (!invoice.customer_id) {
      if (!invoice.customer_name) return;
      if (byName && idCreditedCustomerIds.has(byName.zoho_customer_id)) return;
    }

    const customer = (invoice.customer_id ? customerById.get(invoice.customer_id) : undefined) ?? byName;

    entries.push({
      id: invoice.zoho_invoice_id,
      date: invoice.date,
      donorName: invoice.customer_name ?? customer?.display_name ?? null,
      group: customer?.customer_group ?? null,
      phone: customer?.phone ?? null,
      address: customer?.billing_address ?? null,
      total: amount
    });
  });

  return sortContributionEntries(entries, "desc");
}

// A direct/non-cash ubhayam: a zero-total invoice whose subject line
// records what was donated instead of an amount (see fetchZohoInvoices in
// lib/zoho/client.ts for how `subject` gets backfilled). Kept separate
// from buildAllTimeContributionRows rather than folded into a customer's
// cash total, since there's nothing to sum — the donation is the note
// itself.
export function buildNonCashDonationRows(
  invoices: AllTimeFundInvoice[],
  customers: ReportCustomer[]
): NonCashDonationRow[] {
  const customerById = new Map<string, ReportCustomer>();
  const customerByName = new Map<string, ReportCustomer>();

  customers.forEach((customer) => {
    customerById.set(customer.zoho_customer_id, customer);
    customerByName.set(customer.display_name.trim().toLowerCase(), customer);
  });

  return invoices
    .filter((invoice) => Number(invoice.total ?? 0) === 0 && invoice.subject && invoice.subject.trim() !== "")
    .map((invoice) => {
      const customer =
        (invoice.customer_id ? customerById.get(invoice.customer_id) : undefined) ??
        (invoice.customer_name ? customerByName.get(invoice.customer_name.trim().toLowerCase()) : undefined);

      return {
        donorName: invoice.customer_name,
        address: customer?.billing_address ?? null,
        detail: (invoice.subject as string).trim()
      };
    });
}

export function buildAllTimeExpenseRows(expenses: AllTimeFundExpense[]): SilaiExpenseRow[] {
  return expenses.map((expense) => ({
    id: expense.id,
    vendorName: expense.vendor_name,
    itemName: expense.description,
    date: expense.date,
    total: Number(expense.total ?? 0)
  }));
}

export function buildAllTimeBillRows(
  bills: AllTimeFundBill[],
  paymentsByBill: Map<string, BillPaymentRow[]> = new Map()
): SilaiBillRow[] {
  return bills.map((bill) => ({
    id: bill.id,
    number: bill.bill_number,
    vendorName: bill.vendor_name,
    date: bill.date,
    total: Number(bill.total ?? 0),
    balance: Number(bill.balance ?? 0),
    payments: paymentsByBill.get(bill.zoho_bill_id) ?? []
  }));
}

export type AllTimeFundReportData = {
  contributionRows: SilaiContributionRow[];
  contributionEntries: SilaiContributionEntry[];
  nonCashDonationRows: NonCashDonationRow[];
  expenseRows: SilaiExpenseRow[];
  billRows: SilaiBillRow[];
};

export async function fetchAllTimeFundReportData(
  supabase: ReportLoaderContext["supabase"],
  config: { incomeItemNames: string[]; expenseAccountNames: string[] }
): Promise<AllTimeFundReportData> {
  const [customers, { data: invoices }, { data: expenses }, { data: bills }] = await Promise.all([
    getAllCustomers(supabase),
    supabase
      .from("zoho_invoices")
      .select("zoho_invoice_id, customer_id, customer_name, date, total, subject")
      .is("archived_at", null)
      .or(config.incomeItemNames.map((name) => `item_name.ilike.%${name}%`).join(","))
      .order("date", { ascending: false })
      .returns<AllTimeFundInvoice[]>(),
    supabase
      .from("zoho_expenses")
      .select("id, vendor_name, description, date, total")
      .is("archived_at", null)
      .in("account_name", config.expenseAccountNames)
      .order("date", { ascending: false })
      .returns<AllTimeFundExpense[]>(),
    supabase
      .from("zoho_bills")
      .select("id, zoho_bill_id, bill_number, vendor_name, date, total, balance")
      .is("archived_at", null)
      .in("account_name", config.expenseAccountNames)
      .order("date", { ascending: false })
      .returns<AllTimeFundBill[]>()
  ]);

  const paymentsByBill = await fetchBillPayments(
    supabase,
    (bills ?? []).map((bill) => bill.zoho_bill_id)
  );

  return {
    contributionRows: buildAllTimeContributionRows(invoices ?? [], customers),
    contributionEntries: buildAllTimeContributionEntries(invoices ?? [], customers),
    nonCashDonationRows: buildNonCashDonationRows(invoices ?? [], customers),
    expenseRows: buildAllTimeExpenseRows(expenses ?? []),
    billRows: buildAllTimeBillRows(bills ?? [], paymentsByBill)
  };
}
