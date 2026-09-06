import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { RecordsTabs, type RecordsLoadErrors, type RecordsEmptyHints } from "@/components/records-tabs";
import { requireStaffViewer, viewerChrome } from "@/lib/auth/viewer";
import { readRecordTable, type RecordTableRead } from "@/lib/records/read-record-table";
import { RECORD_TABLES, type RecordTableId } from "@/lib/nav";

export const dynamic = "force-dynamic";

type RecordsPageProps = {
  searchParams: Promise<{ tab?: string; customerId?: string; customerName?: string }>;
};

// Explicit column lists rather than `*`. Every table here carries a `raw`
// jsonb column holding the record's entire Zoho payload, and `*` pulled it
// for every row — then serialized all of it into the RSC payload, since
// <RecordsTabs> is a client component. On a few thousand invoices that is
// tens of megabytes fetched, parsed and shipped to the browser to render
// columns that never show it, which is slow enough to trip the statement
// timeout and leave the page with nothing at all. These are exactly the
// columns the tables render, plus what they key and filter off:
//   - `id`: the row key, and the id every edit/delete/resync posts back.
//   - `customer_id` on invoices: not a column, but what the "Invoices"
//     drill-down from a customer filters on.
const CUSTOMER_FIELDS =
  "id, zoho_customer_id, display_name, company_name, email, phone, billing_address, is_active, is_member, collected_by, ownership, customer_group, order_number";
const INVOICE_FIELDS =
  "id, zoho_invoice_id, customer_id, customer_name, invoice_number, status, date, due_date, total, balance, item_name, subject";
const EXPENSE_FIELDS =
  "id, zoho_expense_id, expense_number, vendor_name, description, status, date, due_date, total, balance, account_name, paid_through_account_name";
const BILL_FIELDS =
  "id, zoho_bill_id, bill_number, vendor_name, status, date, due_date, total, balance, item_name, account_name";

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

  // Read in slices, narrow columns, errors surfaced, and a fallback if the
  // deployed schema is missing one of these columns — see readRecordTable.
  const [customers, invoices, expenses, bills] = await Promise.all([
    readRecordTable(supabase, "zoho_customers", CUSTOMER_FIELDS, {
      column: "display_name",
      ascending: true
    }),
    readRecordTable(supabase, "zoho_invoices", INVOICE_FIELDS, { column: "date", ascending: false }),
    readRecordTable(supabase, "zoho_expenses", EXPENSE_FIELDS, { column: "date", ascending: false }),
    readRecordTable(supabase, "zoho_bills", BILL_FIELDS, { column: "date", ascending: false })
  ]);

  // A failed read used to be indistinguishable from an empty table: the
  // error was destructured away and `data ?? []` rendered "No records in
  // this table yet." Carry it to the table instead, so a broken load says so.
  const loadErrors: RecordsLoadErrors = {
    customers: customers.error,
    invoices: invoices.error,
    expenses: expenses.error,
    bills: bills.error
  };

  // And an empty table that has archived rows behind it says that too, rather
  // than reading as "the sync has never run".
  const emptyHints: RecordsEmptyHints = {
    customers: archivedHint(customers),
    invoices: archivedHint(invoices),
    expenses: archivedHint(expenses),
    bills: archivedHint(bills)
  };

  return (
    <AppShell viewer={viewerChrome(viewer)} crumbs={[{ label: "Records" }]}>
      <PageHeader
        title="Records"
        description="Everything synced from Zoho Books. Click any cell to edit it inline; changes save immediately and are written to the audit log."
      />

      <RecordsTabs
        customers={customers.rows}
        invoices={invoices.rows}
        expenses={expenses.rows}
        bills={bills.rows}
        loadErrors={loadErrors}
        emptyHints={emptyHints}
        initialTab={initialTab}
        initialCustomerFilter={initialCustomerFilter}
        isAdmin={isAdmin}
      />
    </AppShell>
  );
}

function archivedHint({ archivedCount }: RecordTableRead) {
  if (!archivedCount) return null;
  return `${archivedCount} row${archivedCount === 1 ? " is" : "s are"} archived and hidden here. A Zoho sync archives a record when it stops appearing in Zoho — re-run a full sync to bring back anything that still exists there.`;
}
