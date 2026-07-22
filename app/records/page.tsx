import { redirect } from "next/navigation";
import { Topbar } from "@/components/topbar";
import { RecordsTabs } from "@/components/records-tabs";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const RECORD_TABS = ["customers", "invoices", "expenses", "bills"] as const;
type RecordTab = (typeof RECORD_TABS)[number];

type RecordsPageProps = {
  searchParams: Promise<{ tab?: string; customerId?: string; customerName?: string }>;
};

export default async function RecordsPage({ searchParams }: RecordsPageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const isAdmin = user.app_metadata?.is_admin === true;

  const initialTab: RecordTab | undefined = RECORD_TABS.includes(params.tab as RecordTab)
    ? (params.tab as RecordTab)
    : undefined;
  const initialCustomerFilter =
    params.customerId && params.customerName
      ? { id: params.customerId, name: params.customerName }
      : null;

  const [{ data: customers }, { data: invoices }, { data: expenses }, { data: bills }] =
    await Promise.all([
      supabase.from("zoho_customers").select("*").order("display_name", { ascending: true }),
      supabase.from("zoho_invoices").select("*").order("date", { ascending: false }),
      supabase.from("zoho_expenses").select("*").order("date", { ascending: false }),
      supabase.from("zoho_bills").select("*").order("date", { ascending: false })
    ]);

  return (
    <main className="shell">
      <Topbar active="records" />

      <div className="main">
        <section className="hero-band">
          <div>
            <h1>Records</h1>
            <p className="muted">
              Every synced record across Customers, Invoices, Expenses, and Bills. Click a cell to
              edit, or use the filter row to search.
            </p>
          </div>
        </section>

        <RecordsTabs
          customers={customers ?? []}
          invoices={invoices ?? []}
          expenses={expenses ?? []}
          bills={bills ?? []}
          initialTab={initialTab}
          initialCustomerFilter={initialCustomerFilter}
          isAdmin={isAdmin}
        />
      </div>
    </main>
  );
}
