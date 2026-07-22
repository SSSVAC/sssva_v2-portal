import { redirect } from "next/navigation";
import { Topbar } from "@/components/topbar";
import { ReportsTabs } from "@/components/reports-tabs";
import type { MemberRow } from "@/components/fund-status-table";
import type { DonationMonth, DonorDonationRow } from "@/components/monthly-donations-report";
import type { DonorContactRow } from "@/components/donor-contact-report";
import type { MonthlyIncomeCategory, MonthlyIncomeRow, MonthlyExpenseRow, MonthlyBillRow } from "@/components/monthly-report";
import type { SilaiContributionRow, SilaiExpenseRow, SilaiBillRow } from "@/components/silai-fund-report";
import type { SilaiGroupedRow } from "@/components/silai-grouped-report";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export const dynamic = "force-dynamic";

// Invoice line-item names that mark a contribution to the statue
// installation fund. Matched case-insensitively/contains, since Zoho line
// item text may carry extra whitespace or minor variation, and Zoho has
// recorded these contributions under two different item names.
const FUND_ITEM_NAMES = ["சிலை வைப்பதற்கான நிதி", "Murugar & Iyyapan Statue Funds"];
const FUND_MINIMUM_AMOUNT = 3000;

// Invoice line-item name used for general recurring donations, matched the
// same case-insensitive/contains way as FUND_ITEM_NAMES.
const DONATION_ITEM_NAME = "Donations and/or Sponsorships";
const DONATION_MONTHS_SHOWN = 5;

// Archanai and Abhishegam income are recorded under both an English and a
// Tamil item name in Zoho. Note: "Abishegam" (regular abhishegam) and
// "வருஷாபிஷேகம்" (Varusha Abhishegam, the annual one) are distinct services
// and are intentionally not merged here.
const ARCHANAI_ITEM_NAMES = ["Archanai", "அர்ச்சனை"];
const ABHISHEGAM_ITEM_NAMES = ["Abishegam"];
// Catch-all invoice item name for miscellaneous income (e.g. from the
// "General" customer) that doesn't fit the other named categories.
const OTHERS_ITEM_NAMES = ["Others"];
const MONTHLY_REPORT_MONTHS_SHOWN = 24;

// Zoho expense/bill account name used for statue-fund costs. Excluded from
// the general Monthly Report (tracked separately there) and used as the
// positive match for the dedicated Silai Fund Report below.
const SILAI_EXPENSE_ACCOUNT_NAME = "சிலை வைப்பதற்கான செலவுகல்";

type CustomerRow = Database["public"]["Tables"]["zoho_customers"]["Row"];
type InvoiceRow = Database["public"]["Tables"]["zoho_invoices"]["Row"];
type ExpenseRow = Database["public"]["Tables"]["zoho_expenses"]["Row"];
type BillRow = Database["public"]["Tables"]["zoho_bills"]["Row"];
type Member = Pick<
  CustomerRow,
  "zoho_customer_id" | "display_name" | "phone" | "billing_address" | "customer_group" | "order_number"
>;
type Customer = Pick<CustomerRow, "zoho_customer_id" | "display_name" | "billing_address">;
type SilaiGroupedCustomer = Pick<
  CustomerRow,
  | "zoho_customer_id"
  | "display_name"
  | "company_name"
  | "phone"
  | "billing_address"
  | "customer_group"
  | "order_number"
  | "is_member"
>;
type Contribution = Pick<InvoiceRow, "customer_id" | "customer_name" | "total">;
type DonationInvoice = Pick<InvoiceRow, "customer_id" | "customer_name" | "total" | "date">;
type MonthlyIncomeInvoice = Pick<InvoiceRow, "date" | "total" | "item_name" | "customer_name">;
type MonthlyExpenseSource = Pick<ExpenseRow, "id" | "description" | "account_name" | "date" | "total">;
type MonthlyBillSource = Pick<BillRow, "id" | "bill_number" | "vendor_name" | "account_name" | "date" | "total">;
type SilaiContributionInvoice = Pick<InvoiceRow, "customer_name" | "date" | "total">;
type SilaiExpenseSource = Pick<ExpenseRow, "id" | "description" | "date" | "total">;
type SilaiBillSource = Pick<BillRow, "id" | "bill_number" | "vendor_name" | "date" | "total">;

export default async function ReportsPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const donationMonths = getLastNMonths(DONATION_MONTHS_SHOWN);
  const donationRangeStart = `${donationMonths[0].key}-01`;

  const monthlyReportMonths = getLastNMonths(MONTHLY_REPORT_MONTHS_SHOWN);
  const monthlyReportRangeStart = `${monthlyReportMonths[0].key}-01`;
  const monthlyIncomeItemNamePatterns = [
    DONATION_ITEM_NAME,
    ...ARCHANAI_ITEM_NAMES,
    ...ABHISHEGAM_ITEM_NAMES,
    ...OTHERS_ITEM_NAMES
  ];

  const [
    { data: members },
    { data: allCustomers },
    { data: contributions },
    { data: donationInvoices },
    { data: monthlyIncomeInvoices },
    { data: monthlyExpenses },
    { data: monthlyBills },
    { data: silaiContributionInvoices },
    { data: silaiExpenses },
    { data: silaiBills },
    { data: silaiGroupedCustomers }
  ] = await Promise.all([
    supabase
      .from("zoho_customers")
      .select("zoho_customer_id, display_name, phone, billing_address, customer_group, order_number")
      .eq("is_member", true)
      .order("display_name", { ascending: true })
      .returns<Member[]>(),
    supabase
      .from("zoho_customers")
      .select("zoho_customer_id, display_name, billing_address")
      .order("display_name", { ascending: true })
      .returns<Customer[]>(),
    supabase
      .from("zoho_invoices")
      .select("customer_id, customer_name, total")
      .or(FUND_ITEM_NAMES.map((name) => `item_name.ilike.%${name}%`).join(","))
      .returns<Contribution[]>(),
    supabase
      .from("zoho_invoices")
      .select("customer_id, customer_name, total, date")
      .ilike("item_name", `%${DONATION_ITEM_NAME}%`)
      .gte("date", donationRangeStart)
      .returns<DonationInvoice[]>(),
    supabase
      .from("zoho_invoices")
      .select("date, total, item_name, customer_name")
      .gte("date", monthlyReportRangeStart)
      .or(monthlyIncomeItemNamePatterns.map((name) => `item_name.ilike.%${name}%`).join(","))
      .returns<MonthlyIncomeInvoice[]>(),
    supabase
      .from("zoho_expenses")
      .select("id, description, account_name, date, total")
      .gte("date", monthlyReportRangeStart)
      .order("date", { ascending: false })
      .returns<MonthlyExpenseSource[]>(),
    supabase
      .from("zoho_bills")
      .select("id, bill_number, vendor_name, account_name, date, total")
      .gte("date", monthlyReportRangeStart)
      .order("date", { ascending: false })
      .returns<MonthlyBillSource[]>(),
    supabase
      .from("zoho_invoices")
      .select("customer_name, date, total")
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
      .returns<SilaiBillSource[]>(),
    supabase
      .from("zoho_customers")
      .select(
        "zoho_customer_id, display_name, company_name, phone, billing_address, customer_group, order_number, is_member"
      )
      .returns<SilaiGroupedCustomer[]>()
  ]);

  const memberRows = buildMemberRows(members ?? [], contributions ?? []);
  const totalCollectedFromMembers = memberRows.reduce((sum, member) => sum + member.paid, 0);
  const totalBalanceDue = memberRows.reduce((sum, member) => sum + member.balanceDue, 0);
  const notPaidCount = memberRows.filter((member) => member.status === "not_paid").length;
  const partiallyPaidCount = memberRows.filter((member) => member.status === "partially_paid").length;
  const fullyPaidCount = memberRows.filter((member) => member.status === "fully_paid").length;

  const donorRows = buildDonorDonationRows(members ?? [], donationInvoices ?? [], donationMonths);
  const donorContactRows = buildDonorContactRows(allCustomers ?? [], donationInvoices ?? [], donationMonths);

  const monthlyReportIncomeRows = buildMonthlyIncomeRows(monthlyIncomeInvoices ?? []);
  const monthlyReportExpenseRows = buildMonthlyExpenseRows(monthlyExpenses ?? []);
  const monthlyReportBillRows = buildMonthlyBillRows(monthlyBills ?? []);

  const silaiFundContributionRows = buildSilaiContributionRows(silaiContributionInvoices ?? []);
  const silaiFundExpenseRows = buildSilaiExpenseRows(silaiExpenses ?? []);
  const silaiFundBillRows = buildSilaiBillRows(silaiBills ?? []);

  const silaiGroupedRows = buildSilaiGroupedRows(silaiGroupedCustomers ?? [], contributions ?? []);

  return (
    <main className="shell">
      <Topbar active="reports" />

      <div className="main">
        <section className="hero-band">
          <div>
            <h1>Reports</h1>
            <p className="muted">Reports for SSSVA Portal staff.</p>
          </div>
        </section>

        <ReportsTabs
          fundMinimumAmount={FUND_MINIMUM_AMOUNT}
          memberRows={memberRows}
          totalCollectedFromMembers={totalCollectedFromMembers}
          totalBalanceDue={totalBalanceDue}
          notPaidCount={notPaidCount}
          partiallyPaidCount={partiallyPaidCount}
          fullyPaidCount={fullyPaidCount}
          donationMonths={donationMonths}
          donationMonthsShown={DONATION_MONTHS_SHOWN}
          donorRows={donorRows}
          donorContactRows={donorContactRows}
          monthlyReportMonths={monthlyReportMonths}
          monthlyReportIncomeRows={monthlyReportIncomeRows}
          monthlyReportExpenseRows={monthlyReportExpenseRows}
          monthlyReportBillRows={monthlyReportBillRows}
          silaiFundContributionRows={silaiFundContributionRows}
          silaiFundExpenseRows={silaiFundExpenseRows}
          silaiFundBillRows={silaiFundBillRows}
          silaiGroupedRows={silaiGroupedRows}
        />
      </div>
    </main>
  );
}

function buildMemberRows(members: Member[], contributions: Contribution[]): MemberRow[] {
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

// Returns the last `count` calendar months (oldest first) ending with the
// current month, as "YYYY-MM" keys with short display labels.
function getLastNMonths(count: number): DonationMonth[] {
  const now = new Date();
  const months: DonationMonth[] = [];

  for (let i = count - 1; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
    const label = new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" }).format(monthDate);
    months.push({ key, label });
  }

  return months;
}

function buildDonorDonationRows(
  members: Member[],
  donationInvoices: DonationInvoice[],
  months: DonationMonth[]
): DonorDonationRow[] {
  const monthKeys = new Set(months.map((month) => month.key));
  const amountsById = new Map<string, Record<string, number>>();
  const amountsByName = new Map<string, Record<string, number>>();

  for (const invoice of donationInvoices) {
    if (!invoice.date) continue;
    const monthKey = invoice.date.slice(0, 7);
    if (!monthKeys.has(monthKey)) continue;

    const amount = Number(invoice.total ?? 0);

    // See buildMemberRows above: name-keyed totals only cover invoices
    // with no customer_id, so a shared display_name never double-counts
    // an amount already attributed to another customer by id.
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

  return members.map((member) => {
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
}

// Same monthly amount aggregation as buildDonorDonationRows, but applied to
// all customers (not just flagged members) and filtered down to only those
// who actually contributed in the window, since this report is for mailing
// donor contact info alongside their recent giving history.
function buildDonorContactRows(
  customers: Customer[],
  donationInvoices: DonationInvoice[],
  months: DonationMonth[]
): DonorContactRow[] {
  const monthKeys = new Set(months.map((month) => month.key));
  const amountsById = new Map<string, Record<string, number>>();
  const amountsByName = new Map<string, Record<string, number>>();

  for (const invoice of donationInvoices) {
    if (!invoice.date) continue;
    const monthKey = invoice.date.slice(0, 7);
    if (!monthKeys.has(monthKey)) continue;

    const amount = Number(invoice.total ?? 0);

    // See buildMemberRows above: name-keyed totals only cover invoices
    // with no customer_id, so a shared display_name never double-counts
    // an amount already attributed to another customer by id.
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

  return customers
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
}

// Archanai is checked before Abhishegam, and both before the general
// donation match, since "Abishegam" and "Archanai" are unambiguous while
// the donation item name is a looser catch-all.
function categorizeMonthlyIncomeItemName(itemName: string | null): MonthlyIncomeCategory | null {
  if (!itemName) return null;
  const normalized = itemName.toLowerCase();

  if (ARCHANAI_ITEM_NAMES.some((name) => normalized.includes(name.toLowerCase()))) {
    return "archanai";
  }

  if (ABHISHEGAM_ITEM_NAMES.some((name) => normalized.includes(name.toLowerCase()))) {
    return "abhishegam";
  }

  if (normalized.includes(DONATION_ITEM_NAME.toLowerCase())) {
    return "donations";
  }

  if (OTHERS_ITEM_NAMES.some((name) => normalized.includes(name.toLowerCase()))) {
    return "others";
  }

  return null;
}

function buildMonthlyIncomeRows(invoices: MonthlyIncomeInvoice[]): MonthlyIncomeRow[] {
  return invoices.reduce<MonthlyIncomeRow[]>((rows, invoice) => {
    const category = categorizeMonthlyIncomeItemName(invoice.item_name);

    if (category && invoice.date) {
      rows.push({ date: invoice.date, total: Number(invoice.total ?? 0), category, customerName: invoice.customer_name });
    }

    return rows;
  }, []);
}

function buildMonthlyExpenseRows(expenses: MonthlyExpenseSource[]): MonthlyExpenseRow[] {
  return expenses
    .filter((expense) => expense.account_name !== SILAI_EXPENSE_ACCOUNT_NAME)
    .map((expense) => ({
      id: expense.id,
      itemName: expense.description,
      accountName: expense.account_name,
      date: expense.date,
      total: Number(expense.total ?? 0)
    }));
}

function buildMonthlyBillRows(bills: MonthlyBillSource[]): MonthlyBillRow[] {
  return bills
    .filter((bill) => bill.account_name !== SILAI_EXPENSE_ACCOUNT_NAME)
    .map((bill) => ({
      id: bill.id,
      number: bill.bill_number,
      vendorName: bill.vendor_name,
      accountName: bill.account_name,
      date: bill.date,
      total: Number(bill.total ?? 0)
    }));
}

function buildSilaiContributionRows(invoices: SilaiContributionInvoice[]): SilaiContributionRow[] {
  return invoices.map((invoice) => ({
    donorName: invoice.customer_name,
    date: invoice.date,
    total: Number(invoice.total ?? 0)
  }));
}

function buildSilaiExpenseRows(expenses: SilaiExpenseSource[]): SilaiExpenseRow[] {
  return expenses.map((expense) => ({
    id: expense.id,
    itemName: expense.description,
    date: expense.date,
    total: Number(expense.total ?? 0)
  }));
}

function buildSilaiBillRows(bills: SilaiBillSource[]): SilaiBillRow[] {
  return bills.map((bill) => ({
    id: bill.id,
    number: bill.bill_number,
    vendorName: bill.vendor_name,
    date: bill.date,
    total: Number(bill.total ?? 0)
  }));
}

// Every customer who contributed to the Silai fund, member or not, grouped
// by their Group field (Group/Order # are display-only local fields, not
// part of the member-vs-fund-minimum tracking the "Silai Contributions" tab
// does).
function buildSilaiGroupedRows(customers: SilaiGroupedCustomer[], contributions: Contribution[]): SilaiGroupedRow[] {
  const totalsById = new Map<string, number>();
  const totalsByName = new Map<string, number>();

  for (const contribution of contributions) {
    const amount = Number(contribution.total ?? 0);

    // See buildMemberRows above: name-keyed totals only cover contributions
    // with no customer_id, so a shared display_name never double-counts
    // an amount already attributed to another customer by id.
    if (contribution.customer_id) {
      totalsById.set(contribution.customer_id, (totalsById.get(contribution.customer_id) ?? 0) + amount);
    } else if (contribution.customer_name) {
      const key = contribution.customer_name.trim().toLowerCase();
      totalsByName.set(key, (totalsByName.get(key) ?? 0) + amount);
    }
  }

  return customers
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
    // Members are listed regardless of whether they've contributed;
    // non-members only show up if they actually gave to the fund.
    .filter((row) => row.isMember || row.total > 0);
}
