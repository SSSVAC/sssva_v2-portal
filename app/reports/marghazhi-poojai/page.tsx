import Link from "next/link";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/topbar";
import { EventFundReport } from "@/components/event-fund-report";
import { createClient } from "@/lib/supabase/server";
import { fetchEventFundReportData } from "@/lib/event-fund";

export const dynamic = "force-dynamic";

const INCOME_ITEM_NAMES = ["மார்கழி பூஜை"];
// No Marghazhi Poojai expenses/bills exist in Zoho yet, so there's no real
// account name to confirm against — "Marghazhi Poojai" is a guess matching
// the naming convention Ugadi/Varushabishekam already use. If/when an
// expense or bill is recorded under a different account name in Zoho,
// update this to match so it shows up here.
const EXPENSE_ACCOUNT_NAMES = ["Marghazhi Poojai"];

export default async function MarghazhiPoojaiReportPage() {
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
            <h1>Marghazhi Poojai Report</h1>
            <p className="muted">Contributions, expenses &amp; bills for Marghazhi Poojai, by year</p>
          </div>
          <div className="hero-actions">
            <Link href="/reports" className="button secondary">
              All Reports
            </Link>
            <Link href="/reports/ugadi" className="button secondary">
              Ugadi
            </Link>
            <Link href="/reports/varushabishegam" className="button secondary">
              Varushabishegam
            </Link>
          </div>
        </section>

        <section className="report-card" aria-labelledby="marghazhi-poojai-report-heading" data-print-id="marghazhi-poojai">
          <div className="report-card-head">
            <h2 id="marghazhi-poojai-report-heading">Marghazhi Poojai Report</h2>
            <span className="muted">மார்கழி பூஜை — Contributions, expenses &amp; bills</span>
          </div>

          <EventFundReport
            title="Marghazhi Poojai Report"
            subtitle="மார்கழி பூஜை"
            fileSlug="marghazhi-poojai-report"
            printTarget="marghazhi-poojai"
            contributionRows={contributionRows}
            expenseRows={expenseRows}
            billRows={billRows}
          />
        </section>
      </div>
    </main>
  );
}
