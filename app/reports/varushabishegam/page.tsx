import Link from "next/link";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/topbar";
import { EventFundReport } from "@/components/event-fund-report";
import { createClient } from "@/lib/supabase/server";
import { fetchEventFundReportData } from "@/lib/event-fund";

export const dynamic = "force-dynamic";

// "வருஷாபிஷேகம்" (Varusha Abhishegam, the annual one) is distinct from the
// regular "Abishegam" item — see app/reports/page.tsx.
const INCOME_ITEM_NAMES = ["வருஷாபிஷேகம்"];
const EXPENSE_ACCOUNT_NAMES = ["Varushabishekam Expenses"];

export default async function VarushabishegamReportPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { contributionRows, expenseRows, billRows } = await fetchEventFundReportData(supabase, {
    incomeItemNames: INCOME_ITEM_NAMES,
    expenseAccountNames: EXPENSE_ACCOUNT_NAMES
  });

  return (
    <main className="shell">
      <Topbar active="reports" />

      <div className="main">
        <section className="hero-band">
          <div>
            <h1>Varushabishegam Report</h1>
            <p className="muted">Contributions, expenses &amp; bills for Varushabishegam, by year</p>
          </div>
          <div className="hero-actions">
            <Link href="/reports" className="button secondary">
              All Reports
            </Link>
            <Link href="/reports/ugadi" className="button secondary">
              Ugadi
            </Link>
            <Link href="/reports/marghazhi-poojai" className="button secondary">
              Marghazhi Poojai
            </Link>
          </div>
        </section>

        <section className="report-card" aria-labelledby="varushabishegam-report-heading" data-print-id="varushabishegam">
          <div className="report-card-head">
            <h2 id="varushabishegam-report-heading">Varushabishegam Report</h2>
            <span className="muted">வருஷாபிஷேகம் — Contributions, expenses &amp; bills</span>
          </div>

          <EventFundReport
            title="Varushabishegam Report"
            subtitle="வருஷாபிஷேகம்"
            fileSlug="varushabishegam-report"
            printTarget="varushabishegam"
            contributionRows={contributionRows}
            expenseRows={expenseRows}
            billRows={billRows}
          />
        </section>
      </div>
    </main>
  );
}
