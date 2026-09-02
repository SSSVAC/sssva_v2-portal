import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { RecordsTabs } from "@/components/records-tabs";
import { requireStaffViewer, viewerChrome } from "@/lib/auth/viewer";
import { RECORD_TABLES, type RecordTableId } from "@/lib/nav";

export const dynamic = "force-dynamic";

type RecordsPageProps = {
  searchParams: Promise<{ tab?: string; customerId?: string; customerName?: string }>;
};

export default async function RecordsPage({ searchParams }: RecordsPageProps) {
  const params = await searchParams;
  const viewer = await requireStaffViewer();
  const { supabase, isAdmin } = viewer;

  const validTab = RECORD_TABLES.some((table) => table.id === params.tab);
  const initialTab = validTab ? (params.tab as RecordTableId) : undefined;
  const initialCustomerFilter =
    params.customerId && params.customerName
      ? { id: params.customerId, name: params.customerName }
      : null;

  const [{ data: customers }, { data: invoices }, { data: expenses }, { data: bills }] =
    await Promise.all([
      supabase
        .from("zoho_customers")
        .select("*")
        .is("archived_at", null)
        .order("display_name", { ascending: true }),
      supabase.from("zoho_invoices").select("*").is("archived_at", null).order("date", { ascending: false }),
      supabase.from("zoho_expenses").select("*").is("archived_at", null).order("date", { ascending: false }),
      supabase.from("zoho_bills").select("*").is("archived_at", null).order("date", { ascending: false })
    ]);

  return (
    <AppShell viewer={viewerChrome(viewer)} crumbs={[{ label: "Records" }]}>
      <PageHeader
        title="Records"
        description="Everything synced from Zoho Books. Click any cell to edit it inline; changes save immediately and are written to the audit log."
      />

      <RecordsTabs
        customers={customers ?? []}
        invoices={invoices ?? []}
        expenses={expenses ?? []}
        bills={bills ?? []}
        initialTab={initialTab}
        initialCustomerFilter={initialCustomerFilter}
        isAdmin={isAdmin}
      />
    </AppShell>
  );
}
