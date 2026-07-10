import Link from "next/link";
import { FundStatusTable, type MemberRow } from "@/components/fund-status-table";
import { MonthlyDonationsReport, type DonationMonth, type DonorDonationRow } from "@/components/monthly-donations-report";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/format";
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

type CustomerRow = Database["public"]["Tables"]["zoho_customers"]["Row"];
type InvoiceRow = Database["public"]["Tables"]["zoho_invoices"]["Row"];
type Member = Pick<CustomerRow, "zoho_customer_id" | "display_name" | "phone" | "billing_address">;
type Contribution = Pick<InvoiceRow, "customer_id" | "customer_name" | "total">;
type DonationInvoice = Pick<InvoiceRow, "customer_id" | "customer_name" | "total" | "date">;

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

  const [{ data: members }, { data: contributions }, { data: donationInvoices }] = await Promise.all([
    admin
      .from("zoho_customers")
      .select("zoho_customer_id, display_name, phone, billing_address")
      .eq("is_member", true)
      .order("display_name", { ascending: true })
      .returns<Member[]>(),
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
      .returns<DonationInvoice[]>()
  ]);

  const memberRows = buildMemberRows(members ?? [], contributions ?? []);
  const totalCollectedFromMembers = memberRows.reduce((sum, member) => sum + member.paid, 0);
  const totalBalanceDue = memberRows.reduce((sum, member) => sum + member.balanceDue, 0);
  const notPaidCount = memberRows.filter((member) => member.status === "not_paid").length;
  const partiallyPaidCount = memberRows.filter((member) => member.status === "partially_paid").length;
  const fullyPaidCount = memberRows.filter((member) => member.status === "fully_paid").length;

  const donorRows = buildDonorDonationRows(members ?? [], donationInvoices ?? [], donationMonths);

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

        <section className="report-card" aria-labelledby="members-silai-contributions-heading" data-print-id="silai">
          <div className="report-card-head">
            <h2 id="members-silai-contributions-heading">Members Silai Contributions</h2>
            <span className="muted">
              சிலை வைப்பதற்கான நிதி — minimum {formatCurrency(FUND_MINIMUM_AMOUNT)} per member
            </span>
          </div>

          <div className="metric-grid" aria-label="Fund summary">
            <article className="metric-card">
              <div className="metric-head">
                <span>Members</span>
              </div>
              <div className="metric-value">{memberRows.length}</div>
              <div className="metric-sub">Total members tracked</div>
            </article>
            <article className="metric-card">
              <div className="metric-head">
                <span>Not Paid</span>
              </div>
              <div className="metric-value">{notPaidCount}</div>
              <div className="metric-sub">No contribution recorded</div>
            </article>
            <article className="metric-card">
              <div className="metric-head">
                <span>Partially Paid</span>
              </div>
              <div className="metric-value">{partiallyPaidCount}</div>
              <div className="metric-sub">Below {formatCurrency(FUND_MINIMUM_AMOUNT)}</div>
            </article>
            <article className="metric-card">
              <div className="metric-head">
                <span>Fully Paid</span>
              </div>
              <div className="metric-value">{fullyPaidCount}</div>
              <div className="metric-sub">Reached {formatCurrency(FUND_MINIMUM_AMOUNT)}</div>
            </article>
            <article className="metric-card">
              <div className="metric-head">
                <span>Total Paid</span>
              </div>
              <div className="metric-value">{formatCurrency(totalCollectedFromMembers)}</div>
              <div className="metric-sub">Collected from all members</div>
            </article>
            <article className="metric-card">
              <div className="metric-head">
                <span>Balance Due</span>
              </div>
              <div className="metric-value">{formatCurrency(totalBalanceDue)}</div>
              <div className="metric-sub">Outstanding to reach minimum</div>
            </article>
          </div>

          <FundStatusTable members={memberRows} minimumAmount={FUND_MINIMUM_AMOUNT} />
        </section>

        <section className="report-card" aria-labelledby="monthly-donations-heading" data-print-id="donations">
          <div className="report-card-head">
            <h2 id="monthly-donations-heading">Monthly Donations</h2>
            <span className="muted">Donations and/or Sponsorships — last {DONATION_MONTHS_SHOWN} months</span>
          </div>

          <MonthlyDonationsReport months={donationMonths} donors={donorRows} />
        </section>
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
