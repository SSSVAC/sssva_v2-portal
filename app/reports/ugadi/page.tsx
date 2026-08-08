import Link from "next/link";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/topbar";
import { EventFundReport } from "@/components/event-fund-report";
import { createClient } from "@/lib/supabase/server";
import { fetchEventFundReportData } from "@/lib/event-fund";

export const dynamic = "force-dynamic";

const INCOME_ITEM_NAMES = ["Ugadi"];
const EXPENSE_ACCOUNT_NAMES = ["Ugadi"];

export default async function UgadiReportPage() {
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
            <h1>Ugadi Report</h1>
            <p className="muted">Contributions, expenses &amp; bills for Ugadi, by year</p>
          </div>
          <div className="hero-actions">
            <Link href="/reports" className="button secondary">
              All Reports
            </Link>
            <Link href="/reports/varushabishegam" className="button secondary">
              Varushabishegam
            </Link>
            <Link href="/reports/marghazhi-poojai" className="button secondary">
              Marghazhi Poojai
            </Link>
          </div>
        </section>

        <section className="report-card" aria-labelledby="ugadi-report-heading" data-print-id="ugadi">
          <div className="report-card-head">
            <h2 id="ugadi-report-heading">Ugadi Report</h2>
            <span className="muted">Contributions, expenses &amp; bills for Ugadi</span>
          </div>

          <EventFundReport
            title="Ugadi Report"
            fileSlug="ugadi-report"
            printTarget="ugadi"
            contributionRows={contributionRows}
            expenseRows={expenseRows}
            billRows={billRows}
          />
        </section>
      </div>
    </main>
  );
}
