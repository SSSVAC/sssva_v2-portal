import type { Database, Json } from "@/types/database";

type CustomerInsert = Database["public"]["Tables"]["zoho_customers"]["Insert"];
type InvoiceInsert = Database["public"]["Tables"]["zoho_invoices"]["Insert"];
type ExpenseInsert = Database["public"]["Tables"]["zoho_expenses"]["Insert"];
type BillInsert = Database["public"]["Tables"]["zoho_bills"]["Insert"];

export function mapZohoCustomer(raw: Record<string, unknown>): CustomerInsert {

  // console.log("[zoho][mapCustomer]", {
  //   raw
  // });

  const contactId = requiredString(raw, "contact_id");
  const contactName = optionalString(raw, "contact_name") ?? "Unnamed customer";
  const billingAddressResult = getBillingAddress(raw);
  const isActive = getCustomerIsActive(raw);


  return {
    zoho_customer_id: contactId,
    display_name: contactName,
    company_name: optionalString(raw, "company_name"),
    email: optionalString(raw, "email") ?? optionalString(raw, "contact_email"),
    phone: optionalString(raw, "phone") ?? optionalString(raw, "contact_phone"),
    billing_address: billingAddressResult.value,
    is_active: isActive,
    raw: raw as Json,
    synced_at: new Date().toISOString()
  };
}

export function mapZohoInvoice(raw: Record<string, unknown>): InvoiceInsert {
  const invoiceId = requiredString(raw, "invoice_id");

  return {
    zoho_invoice_id: invoiceId,
    customer_id: optionalString(raw, "customer_id"),
    customer_name: optionalString(raw, "customer_name"),
    invoice_number: optionalString(raw, "invoice_number"),
    status: optionalString(raw, "status") ?? "unknown",
    date: optionalString(raw, "date"),
    due_date: optionalString(raw, "due_date"),
    total: optionalNumber(raw, "total") ?? 0,
    balance: optionalNumber(raw, "balance") ?? 0,
    currency_code: optionalString(raw, "currency_code"),
    item_name: getItemName(raw),
    raw: raw as Json,
    synced_at: new Date().toISOString()
  };
}

export function mapZohoExpense(raw: Record<string, unknown>): ExpenseInsert {
  const expenseId = requiredString(raw, "expense_id");

  return {
    zoho_expense_id: expenseId,
    vendor_name: optionalString(raw, "vendor_name") ?? optionalString(raw, "contact_name"),
    expense_number: optionalString(raw, "expense_number") ?? optionalString(raw, "reference_number"),
    status: optionalString(raw, "status") ?? "unknown",
    date: optionalString(raw, "date"),
    due_date: optionalString(raw, "due_date"),
    total: optionalNumber(raw, "total") ?? 0,
    balance: optionalNumber(raw, "balance") ?? 0,
    currency_code: optionalString(raw, "currency_code"),
    account_name: optionalString(raw, "account_name"),
    paid_through_account_name: optionalString(raw, "paid_through_account_name"),
    description: optionalString(raw, "description"),
    raw: raw as Json,
    synced_at: new Date().toISOString()
  };
}

export function mapZohoBill(raw: Record<string, unknown>): BillInsert {
  const billId = requiredString(raw, "bill_id");

  return {
    zoho_bill_id: billId,
    vendor_name: optionalString(raw, "vendor_name") ?? optionalString(raw, "contact_name"),
    bill_number: optionalString(raw, "bill_number") ?? optionalString(raw, "reference_number"),
    status: optionalString(raw, "status") ?? "unknown",
    date: optionalString(raw, "date"),
    due_date: optionalString(raw, "due_date"),
    total: optionalNumber(raw, "total") ?? 0,
    balance: optionalNumber(raw, "balance") ?? 0,
    currency_code: optionalString(raw, "currency_code"),
    account_name: optionalString(raw, "account_name"),
    item_name: getItemName(raw),
    raw: raw as Json,
    synced_at: new Date().toISOString()
  };
}

function requiredString(raw: Record<string, unknown>, key: string) {
  const value = optionalString(raw, key);

  if (!value) {
    throw new Error(`Zoho payload missing ${key}`);
  }

  return value;
}

function optionalString(raw: Record<string, unknown>, key: string) {
  const value = raw[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function optionalNumber(raw: Record<string, unknown>, key: string) {
  const value = raw[key];

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function optionalBoolean(raw: Record<string, unknown>, key: string) {
  const value = raw[key];

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }

  return null;
}

function getCustomerIsActive(raw: Record<string, unknown>) {
  const status = optionalString(raw, "status");

  if (status) {
    return status.trim().toLowerCase() === "active";
  }

  return optionalBoolean(raw, "is_active") ?? true;
}

function getItemName(raw: Record<string, unknown>) {
  const directItemName = optionalString(raw, "item_name") ?? optionalString(raw, "itemName");
  if (directItemName) {
    return directItemName;
  }

  const lineItems = raw.line_items;
  if (!Array.isArray(lineItems)) {
    return null;
  }

  const firstLineItem = lineItems.find((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
  return firstLineItem ? optionalString(firstLineItem, "name") : null;
}

function buildAddressParts(address: Record<string, unknown>) {
  return [
    optionalString(address, "address"),
    optionalString(address, "street"),
    optionalString(address, "street2"),
    optionalString(address, "city"),
    optionalString(address, "state"),
    optionalString(address, "zip"),
    optionalString(address, "postal_code"),
    optionalString(address, "country")
  ].filter((value): value is string => Boolean(value));
}

function getBillingAddress(raw: Record<string, unknown>) {
  const directCandidates = [
    ["billing_address", optionalString(raw, "billing_address")],
    ["address", optionalString(raw, "address")],
    ["billingAddress", optionalString(raw, "billingAddress")],
    ["billing_address_line", optionalString(raw, "billing_address_line")],
    ["address_line1", optionalString(raw, "address_line1")]
  ];

  for (const [source, value] of directCandidates) {
    if (value) {
      return { value, source };
    }
  }

  const nestedObjects = [
    ["address", raw.address],
    ["billing_address", raw.billing_address],
    ["contact.address", (raw.contact as Record<string, unknown> | undefined)?.address],
    ["contact.billing_address", (raw.contact as Record<string, unknown> | undefined)?.billing_address],
    ["contact.billingAddress", (raw.contact as Record<string, unknown> | undefined)?.billingAddress]
  ] as const;

  for (const [source, nestedObject] of nestedObjects) {
    if (nestedObject && typeof nestedObject === "object") {
      const candidate = nestedObject as Record<string, unknown>;
      const explicitAddress = optionalString(candidate, "address");
      if (explicitAddress) {
        return { value: explicitAddress, source: `${source}.address` };
      }

      const parts = buildAddressParts(candidate);
      if (parts.length > 0) {
        return { value: parts.join(", "), source };
      }
    }
  }

  return { value: null, source: "none" };
}
