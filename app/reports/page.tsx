import Link from "next/link";
import { ReportsTabs } from "@/components/reports-tabs";
import type { MemberRow } from "@/components/fund-status-table";
import type { DonationMonth, DonorDonationRow } from "@/components/monthly-donations-report";
import type { DonorContactRow } from "@/components/donor-contact-report";
import type { MonthlyIncomeCategory, MonthlyIncomeRow, MonthlyExpenseRow, MonthlyBillRow } from "@/components/monthly-report";
import type { SilaiContributionRow, SilaiExpenseRow, SilaiBillRow } from "@/components/silai-fund-report";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

export const dynamic = "force-dynamic";

// Invoice line-item name that marks a contribution to the statue
// installation fund. Matched case-insensitively/contains, since Zoho line
// item text may carry extra whitespace or minor variation.
const FUND_ITEM_NAME = "சிலை வைப்பதற்கான நிதி";
const FUND_MINIMUM_AMOUNT = 3000;

// Invoice line-item name used for general recurring donations, matched the
// same case-insensitive/contains way as FUND_ITEM_NAME.
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
type Member = Pick<CustomerRow, "zoho_customer_id" | "display_name" | "phone" | "billing_address">;
type Customer = Pick<CustomerRow, "zoho_customer_id" | "display_name" | "billing_address">;
type Contribution = Pick<InvoiceRow, "customer_id" | "customer_name" | "total">;
type DonationInvoice = Pick<InvoiceRow, "customer_id" | "customer_name" | "total" | "date">;
type MonthlyIncomeInvoice = Pick<InvoiceRow, "date" | "total" | "item_name" | "customer_name">;
type MonthlyExpenseSource = Pick<ExpenseRow, "id" | "description" | "account_name" | "date" | "total">;
type MonthlyBillSource = Pick<BillRow, "id" | "bill_number" | "vendor_name" | "account_name" | "date" | "total">;
type SilaiContributionInvoice = Pick<InvoiceRow, "customer_name" | "date" | "total">;
type SilaiExpenseSource = Pick<ExpenseRow, "id" | "description" | "date" | "total">;
type SilaiBillSource = Pick<BillRow, "id" | "bill_number" | "vendor_name" | "date" | "total">;

// This page is intentionally public (no auth redirect): it's a read-only
// report meant to be viewable without login. Row Level Security still
// restricts the zoho_* tables to the "authenticated" role, so data is
// fetched with the admin (service role) client, which bypasses RLS.
// Direct anon access to the database remains locked down either way.
export default async function ReportsPage() {
  const sessionClient = await createClient();
  const {
    data: { user }
  } = await sessionClient.auth.getUser();

  const admin = createAdminClient();

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
    { data: silaiBills }
  ] = await Promise.all([
    admin
      .from("zoho_customers")
      .select("zoho_customer_id, display_name, phone, billing_address")
      .eq("is_member", true)
      .order("display_name", { ascending: true })
      .returns<Member[]>(),
    admin
      .from("zoho_customers")
      .select("zoho_customer_id, display_name, billing_address")
      .order("display_name", { ascending: true })
      .returns<Customer[]>(),
    admin
      .from("zoho_invoices")
      .select("customer_id, customer_name, total")
      .ilike("item_name", `%${FUND_ITEM_NAME}%`)
      .returns<Contribution[]>(),
    admin
      .from("zoho_invoices")
      .select("customer_id, customer_name, total, date")
      .ilike("item_name", `%${DONATION_ITEM_NAME}%`)
      .gte("date", donationRangeStart)
      .returns<DonationInvoice[]>(),
    admin
      .from("zoho_invoices")
      .select("date, total, item_name, customer_name")
      .gte("date", monthlyReportRangeStart)
      .or(monthlyIncomeItemNamePatterns.map((name) => `item_name.ilike.%${name}%`).join(","))
      .returns<MonthlyIncomeInvoice[]>(),
    admin
      .from("zoho_expenses")
      .select("id, description, account_name, date, total")
      .gte("date", monthlyReportRangeStart)
      .order("date", { ascending: false })
      .returns<MonthlyExpenseSource[]>(),
    admin
      .from("zoho_bills")
      .select("id, bill_number, vendor_name, account_name, date, total")
      .gte("date", monthlyReportRangeStart)
      .order("date", { ascending: false })
      .returns<MonthlyBillSource[]>(),
    admin
      .from("zoho_invoices")
      .select("customer_name, date, total")
      .ilike("item_name", `%${FUND_ITEM_NAME}%`)
      .order("date", { ascending: false })
      .returns<SilaiContributionInvoice[]>(),
    admin
      .from("zoho_expenses")
      .select("id, description, date, total")
      .eq("account_name", SILAI_EXPENSE_ACCOUNT_NAME)
      .order("date", { ascending: false })
      .returns<SilaiExpenseSource[]>(),
    admin
      .from("zoho_bills")
      .select("id, bill_number, vendor_name, date, total")
      .eq("account_name", SILAI_EXPENSE_ACCOUNT_NAME)
      .order("date", { ascending: false })
      .returns<SilaiBillSource[]>()
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

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">S</span>
          <span>SSSVA Portal</span>
        </div>

        <nav style={{ display: "flex", gap: 16, alignItems: "center" }}>
          {user ? (
            <>
              <Link href="/dashboard" className="muted">
                Dashboard
              </Link>
              <Link href="/records" className="muted">
                Records
              </Link>
              <form action="/logout" method="post">
                <button className="button secondary" type="submit">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className="button secondary">
              Staff Sign In
            </Link>
          )}
        </nav>
      </header>

      <div className="main">
        <section className="hero-band">
          <div>
            <h1>Reports</h1>
            <p className="muted">Public reports for SSSVA Portal.</p>
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

    if (contribution.customer_id) {
      totalsById.set(contribution.customer_id, (totalsById.get(contribution.customer_id) ?? 0) + amount);
    }

    if (contribution.customer_name) {
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

    if (invoice.customer_id) {
      const amounts = amountsById.get(invoice.customer_id) ?? {};
      amounts[monthKey] = (amounts[monthKey] ?? 0) + amount;
      amountsById.set(invoice.customer_id, amounts);
    }

    if (invoice.customer_name) {
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

    if (invoice.customer_id) {
      const amounts = amountsById.get(invoice.customer_id) ?? {};
      amounts[monthKey] = (amounts[monthKey] ?? 0) + amount;
      amountsById.set(invoice.customer_id, amounts);
    }

    if (invoice.customer_name) {
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
