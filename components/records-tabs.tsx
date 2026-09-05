"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { EditableDataTable, type RecordColumn } from "@/components/editable-data-table";
import { useUrlParamSetter } from "@/lib/reports/use-url-param";
import { RECORD_TABLES, type RecordTableId } from "@/lib/nav";

type Row = Record<string, unknown>;

type CustomerFilter = {
  id: string;
  name: string;
};

/**
 * Per-table message when the server read failed, keyed by tab. Null means
 * the table loaded — an empty table is then genuinely empty, rather than a
 * query that errored and got rendered as "no records".
 */
export type RecordsLoadErrors = Partial<Record<RecordTableId, string | null>>;

type RecordsTabsProps = {
  customers: Row[];
  invoices: Row[];
  expenses: Row[];
  bills: Row[];
  loadErrors?: RecordsLoadErrors;
  initialTab?: RecordTableId;
  initialCustomerFilter?: CustomerFilter | null;
  isAdmin: boolean;
};

// Column order is what staff actually scan for day to day: the
// human-readable identifier leads (and doubles as the mobile card title),
// then the fields people look up or edit most, with the internal Zoho id
// trailing at the end for the rare cross-reference — not hidden, just out
// of the way. The raw Supabase `id` (a UUID) isn't listed at all:
// EditableDataTable keys/edits/deletes rows off row.id regardless of
// whether it's a visible column, so showing it bought nothing but the
// first column of every table. currency_code is dropped outright rather
// than reordered — every row across all invoices is "INR", so it's not a
// column, it's a constant.
const CUSTOMER_COLUMNS: RecordColumn[] = [
  { key: "display_name", label: "Name", type: "text", editable: true, cardTitle: true },
  { key: "company_name", label: "Company", type: "text", editable: true },
  { key: "phone", label: "Phone", type: "text", editable: true },
  { key: "email", label: "Email", type: "text", editable: true },
  { key: "billing_address", label: "Billing Address", type: "text", editable: true },
  { key: "is_active", label: "Active", type: "boolean", editable: true },
  { key: "is_member", label: "Member", type: "boolean", editable: true },
  { key: "collected_by", label: "Collected By", type: "text", editable: true },
  { key: "ownership", label: "Ownership", type: "select", editable: true, options: ["Tenant", "Owner", "Company"] },
  { key: "customer_group", label: "Group", type: "select", editable: true, emptyLabel: "Others" },
  { key: "order_number", label: "Order #", type: "number", editable: true },
  { key: "zoho_customer_id", label: "Zoho ID", type: "text", editable: false }
];

const INVOICE_COLUMNS: RecordColumn[] = [
  { key: "invoice_number", label: "Invoice #", type: "text", editable: true, cardTitle: true },
  { key: "customer_name", label: "Customer", type: "text", editable: true },
  { key: "status", label: "Status", type: "text", editable: true },
  { key: "date", label: "Date", type: "date", editable: true },
  { key: "due_date", label: "Due Date", type: "date", editable: true },
  { key: "total", label: "Total", type: "number", editable: true },
  { key: "balance", label: "Balance", type: "number", editable: true },
  { key: "item_name", label: "Item", type: "text", editable: true },
  { key: "subject", label: "Subject", type: "text", editable: true },
  { key: "zoho_invoice_id", label: "Zoho ID", type: "text", editable: false }
];

const EXPENSE_COLUMNS: RecordColumn[] = [
  { key: "expense_number", label: "Expense #", type: "text", editable: true, cardTitle: true },
  { key: "vendor_name", label: "Vendor", type: "text", editable: true },
  { key: "description", label: "Description", type: "text", editable: true },
  { key: "status", label: "Status", type: "text", editable: true },
  { key: "date", label: "Date", type: "date", editable: true },
  { key: "due_date", label: "Due Date", type: "date", editable: true },
  { key: "total", label: "Total", type: "number", editable: true },
  { key: "balance", label: "Balance", type: "number", editable: true },
  { key: "account_name", label: "Account", type: "text", editable: true },
  { key: "paid_through_account_name", label: "Paid Through", type: "text", editable: true },
  { key: "zoho_expense_id", label: "Zoho ID", type: "text", editable: false }
];

const BILL_COLUMNS: RecordColumn[] = [
  { key: "bill_number", label: "Bill #", type: "text", editable: true, cardTitle: true },
  { key: "vendor_name", label: "Vendor", type: "text", editable: true },
  { key: "status", label: "Status", type: "text", editable: true },
  { key: "date", label: "Date", type: "date", editable: true },
  { key: "due_date", label: "Due Date", type: "date", editable: true },
  { key: "total", label: "Total", type: "number", editable: true },
  { key: "balance", label: "Balance", type: "number", editable: true },
  { key: "item_name", label: "Item", type: "text", editable: true },
  { key: "account_name", label: "Account", type: "text", editable: true },
  { key: "zoho_bill_id", label: "Zoho ID", type: "text", editable: false }
];

type TabId = RecordTableId;

export function RecordsTabs({
  customers,
  invoices,
  expenses,
  bills,
  loadErrors,
  initialTab,
  initialCustomerFilter,
  isAdmin
}: RecordsTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab ?? "customers");
  const [customerFilter, setCustomerFilter] = useState<CustomerFilter | null>(
    initialCustomerFilter ?? null
  );
  const setUrlParams = useUrlParamSetter();

  const rowsByTab: Record<TabId, Row[]> = { customers, invoices, expenses, bills };

  // Keeps ?tab= in sync so the sidebar highlights the table you're looking
  // at and the view stays shareable, without a server round-trip — all four
  // tables are already on the client.
  function selectTab(tab: TabId) {
    setActiveTab(tab);
    setUrlParams({ tab: tab === "customers" ? null : tab });
  }

  function viewCustomerInvoices(customer: Row) {
    const id = String(customer.zoho_customer_id ?? "");
    const name = String(customer.display_name ?? "");
    const url = new URL("/records", window.location.origin);
    url.searchParams.set("tab", "invoices");
    if (id) url.searchParams.set("customerId", id);
    if (name) url.searchParams.set("customerName", name);
    window.open(url.toString(), "_blank", "noopener,noreferrer");
  }

  return (
    <div>
      {/* A segmented control carrying each table's row count, so you can see
          how much data is behind a tab before opening it. The old underlined
          tab strip gave no such signal and read like the report category
          tabs elsewhere in the app, which navigate rather than switch. */}
      <div className="records-toolbar">
        <div className="segmented" role="tablist" aria-label="Record tables">
          {RECORD_TABLES.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={activeTab === tab.id}
              className={`segment${activeTab === tab.id ? " segment-active" : ""}`}
              onClick={() => selectTab(tab.id)}
            >
              {tab.label}
              {/* A count of 0 on a table whose read failed would read as
                  "nothing here"; it isn't known, so it isn't shown. */}
              <span className="segment-count" title={loadErrors?.[tab.id] ?? undefined}>
                {loadErrors?.[tab.id] ? "!" : rowsByTab[tab.id].length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {activeTab === "customers" && (
        <EditableDataTable
          key="customers"
          table="zoho_customers"
          title="Customers"
          columns={CUSTOMER_COLUMNS}
          rows={customers}
          loadError={loadErrors?.customers}
          isAdmin={isAdmin}
          actionColumn={{
            label: "Invoices",
            render: (row) => (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => viewCustomerInvoices(row)}
              >
                <ExternalLink size={13} />
                Invoices
              </button>
            )
          }}
        />
      )}

      {activeTab === "invoices" && (
        <EditableDataTable
          key="invoices"
          table="zoho_invoices"
          title="Invoices"
          columns={INVOICE_COLUMNS}
          rows={invoices}
          loadError={loadErrors?.invoices}
          isAdmin={isAdmin}
          presetFilter={customerFilter ? (row) => row.customer_id === customerFilter.id : undefined}
          banner={
            customerFilter && (
              <>
                <span>
                  Filtered to <strong>{customerFilter.name}</strong>
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setCustomerFilter(null)}
                >
                  Clear
                </button>
              </>
            )
          }
        />
      )}

      {activeTab === "expenses" && (
        <EditableDataTable
          key="expenses"
          table="zoho_expenses"
          title="Expenses"
          columns={EXPENSE_COLUMNS}
          rows={expenses}
          loadError={loadErrors?.expenses}
          isAdmin={isAdmin}
        />
      )}

      {activeTab === "bills" && (
        <EditableDataTable
          key="bills"
          table="zoho_bills"
          title="Bills"
          columns={BILL_COLUMNS}
          rows={bills}
          loadError={loadErrors?.bills}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}
