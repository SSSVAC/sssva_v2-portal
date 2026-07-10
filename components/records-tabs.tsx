"use client";

import { useState } from "react";
import { EditableDataTable, type RecordColumn } from "@/components/editable-data-table";

type Row = Record<string, unknown>;

type CustomerFilter = {
  id: string;
  name: string;
};

type RecordsTabsProps = {
  customers: Row[];
  invoices: Row[];
  expenses: Row[];
  bills: Row[];
  initialTab?: TabId;
  initialCustomerFilter?: CustomerFilter | null;
};

const CUSTOMER_COLUMNS: RecordColumn[] = [
  { key: "id", label: "ID", type: "text", editable: false },
  { key: "zoho_customer_id", label: "Zoho ID", type: "text", editable: false },
  { key: "display_name", label: "Name", type: "text", editable: true },
  { key: "company_name", label: "Company", type: "text", editable: true },
  { key: "email", label: "Email", type: "text", editable: true },
  { key: "phone", label: "Phone", type: "text", editable: true },
  { key: "billing_address", label: "Billing Address", type: "text", editable: true },
  { key: "is_active", label: "Active", type: "boolean", editable: true },
  { key: "is_member", label: "Member", type: "boolean", editable: true },
  { key: "collected_by", label: "Collected By", type: "text", editable: true }
];

const INVOICE_COLUMNS: RecordColumn[] = [
  { key: "id", label: "ID", type: "text", editable: false },
  { key: "zoho_invoice_id", label: "Zoho ID", type: "text", editable: false },
  { key: "invoice_number", label: "Invoice #", type: "text", editable: true },
  { key: "customer_name", label: "Customer", type: "text", editable: true },
  { key: "status", label: "Status", type: "text", editable: true },
  { key: "date", label: "Date", type: "date", editable: true },
  { key: "due_date", label: "Due Date", type: "date", editable: true },
  { key: "total", label: "Total", type: "number", editable: true },
  { key: "balance", label: "Balance", type: "number", editable: true },
  { key: "currency_code", label: "Currency", type: "text", editable: true },
  { key: "item_name", label: "Item", type: "text", editable: true }
];

const EXPENSE_COLUMNS: RecordColumn[] = [
  { key: "id", label: "ID", type: "text", editable: false },
  { key: "zoho_expense_id", label: "Zoho ID", type: "text", editable: false },
  { key: "expense_number", label: "Expense #", type: "text", editable: true },
  { key: "vendor_name", label: "Vendor", type: "text", editable: true },
  { key: "status", label: "Status", type: "text", editable: true },
  { key: "date", label: "Date", type: "date", editable: true },
  { key: "due_date", label: "Due Date", type: "date", editable: true },
  { key: "total", label: "Total", type: "number", editable: true },
  { key: "balance", label: "Balance", type: "number", editable: true },
  { key: "currency_code", label: "Currency", type: "text", editable: true }
];

const BILL_COLUMNS: RecordColumn[] = [
  { key: "id", label: "ID", type: "text", editable: false },
  { key: "zoho_bill_id", label: "Zoho ID", type: "text", editable: false },
  { key: "bill_number", label: "Bill #", type: "text", editable: true },
  { key: "vendor_name", label: "Vendor", type: "text", editable: true },
  { key: "status", label: "Status", type: "text", editable: true },
  { key: "date", label: "Date", type: "date", editable: true },
  { key: "due_date", label: "Due Date", type: "date", editable: true },
  { key: "total", label: "Total", type: "number", editable: true },
  { key: "balance", label: "Balance", type: "number", editable: true },
  { key: "currency_code", label: "Currency", type: "text", editable: true }
];

const TABS = [
  { id: "customers", label: "Customers" },
  { id: "invoices", label: "Invoices" },
  { id: "expenses", label: "Expenses" },
  { id: "bills", label: "Bills" }
] as const;

type TabId = (typeof TABS)[number]["id"];

export function RecordsTabs({
  customers,
  invoices,
  expenses,
  bills,
  initialTab,
  initialCustomerFilter
}: RecordsTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab ?? "customers");
  const [customerFilter, setCustomerFilter] = useState<CustomerFilter | null>(initialCustomerFilter ?? null);

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
    <div className="table-panel" style={{ minWidth: 0 }}>
      <div className="report-tablist" role="tablist" aria-label="Record tables">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={activeTab === tab.id}
            className={`report-tab ${activeTab === tab.id ? "report-tab-active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "customers" && (
        <EditableDataTable
          table="zoho_customers"
          columns={CUSTOMER_COLUMNS}
          rows={customers}
          actionColumn={{
            label: "Invoices",
            render: (row) => (
              <button type="button" className="button secondary" onClick={() => viewCustomerInvoices(row)}>
                View Invoices
              </button>
            )
          }}
        />
      )}
      {activeTab === "invoices" && (
        <>
          {customerFilter && (
            <div className="filter-banner">
              <span>
                Showing invoices for <strong>{customerFilter.name}</strong>
              </span>
              <button type="button" className="button secondary" onClick={() => setCustomerFilter(null)}>
                Clear filter
              </button>
            </div>
          )}
          <EditableDataTable
            table="zoho_invoices"
            columns={INVOICE_COLUMNS}
            rows={invoices}
            presetFilter={customerFilter ? (row) => row.customer_id === customerFilter.id : undefined}
          />
        </>
      )}
      {activeTab === "expenses" && (
        <EditableDataTable table="zoho_expenses" columns={EXPENSE_COLUMNS} rows={expenses} />
      )}
      {activeTab === "bills" && (
        <EditableDataTable table="zoho_bills" columns={BILL_COLUMNS} rows={bills} />
      )}
    </div>
  );
}
