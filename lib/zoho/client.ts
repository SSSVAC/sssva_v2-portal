import { z } from "zod";

const TokenResponse = z.object({
  access_token: z.string(),
  expires_in: z.number().optional(),
  token_type: z.string().optional()
});

const CustomerResponse = z.object({
  contacts: z.array(z.record(z.unknown())).default([])
});

const CustomerDetailResponse = z.object({
  contact: z.record(z.unknown()).optional()
});

const InvoiceResponse = z.object({
  invoices: z.array(z.record(z.unknown())).default([])
});

const InvoiceDetailResponse = z.object({
  invoice: z.record(z.unknown()).optional()
});

const ExpenseResponse = z.object({
  expenses: z.array(z.record(z.unknown())).default([])
});

const ExpenseDetailResponse = z.object({
  expense: z.record(z.unknown()).optional()
});

const BillResponse = z.object({
  bills: z.array(z.record(z.unknown())).default([])
});

const BillDetailResponse = z.object({
  bill: z.record(z.unknown()).optional()
});

const PageContext = z.object({
  has_more_page: z.boolean().optional()
});

type ZohoListResource = "contacts" | "invoices" | "expenses" | "bills";
const DEFAULT_CUSTOMER_DETAIL_CONCURRENCY = 2;
const CUSTOMER_DETAIL_MAX_ATTEMPTS = 3;
const DEFAULT_INVOICE_DETAIL_CONCURRENCY = 2;
const INVOICE_DETAIL_MAX_ATTEMPTS = 3;
const DEFAULT_BILL_DETAIL_CONCURRENCY = 2;
const BILL_DETAIL_MAX_ATTEMPTS = 3;
const EXPENSE_DETAIL_MAX_ATTEMPTS = 3;
const DEFAULT_LIST_MAX_PAGES = 100;

export async function getZohoAccessToken() {
  const accountsBaseUrl = getEnv("ZOHO_ACCOUNTS_BASE_URL", "https://accounts.zoho.com");
  const params = new URLSearchParams({
    refresh_token: getEnv("ZOHO_REFRESH_TOKEN"),
    client_id: getEnv("ZOHO_CLIENT_ID"),
    client_secret: getEnv("ZOHO_CLIENT_SECRET"),
    grant_type: "refresh_token"
  });

  const response = await fetch(`${accountsBaseUrl}/oauth/v2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params.toString(),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Zoho token refresh failed with ${response.status}`);
  }

  return TokenResponse.parse(await response.json()).access_token;
}

export async function fetchZohoCustomers(
  accessToken: string,
  limit?: number,
  existingBillingAddresses = new Map<string, string | null>()
) {
  const payload = await fetchZohoList(accessToken, "contacts", limit);
  const customers = CustomerResponse.parse(payload).contacts;

  if (customers.length === 0) {
    return [];
  }

  const customerIds = customers
    .map((customer) => getCustomerId(customer))
    .filter((value): value is string => Boolean(value))
    .slice(0, limit);

  if (customerIds.length === 0) {
    return customers;
  }

  const customersById = new Map<string, Record<string, unknown>>();
  customers.forEach((customer) => {
    const customerId = getCustomerId(customer);
    if (customerId) {
      customersById.set(customerId, customer);
    }
  });

  const detailedCustomers = await mapWithConcurrency(
    customerIds,
    getCustomerDetailConcurrency(),
    async (customerId) => {
      // Already-synced customers skip the detail call entirely to conserve
      // Zoho's daily API limit; whatever billing address we have stays as-is.
      if (existingBillingAddresses.has(customerId)) {
        return {
          ...customersById.get(customerId),
          billing_address: existingBillingAddresses.get(customerId) ?? null
        };
      }

      const detailedCustomer = await fetchZohoCustomerDetail(accessToken, customerId);
      return detailedCustomer ?? customersById.get(customerId) ?? null;
    }
  );

  return detailedCustomers.filter((customer): customer is Record<string, unknown> => Boolean(customer));
}

export async function fetchZohoInvoices(accessToken: string, existingItemNames = new Map<string, string | null>()) {
  const payload = await fetchZohoList(accessToken, "invoices");
  const invoices = InvoiceResponse.parse(payload).invoices;

  if (invoices.length === 0) {
    return [];
  }

  const invoicesById = new Map<string, Record<string, unknown>>();
  const invoiceIdsForDetail: string[] = [];

  invoices.forEach((invoice) => {
    const invoiceId = getInvoiceId(invoice);
    if (!invoiceId) {
      return;
    }

    invoicesById.set(invoiceId, invoice);

    // Already-synced invoices skip the detail call entirely to conserve
    // Zoho's daily API limit, even if their item name isn't captured yet.
    if (!hasInvoiceItemName(invoice) && !existingItemNames.has(invoiceId)) {
      invoiceIdsForDetail.push(invoiceId);
    }
  });

  if (invoiceIdsForDetail.length === 0) {
    return invoices.map((invoice) => {
      const invoiceId = getInvoiceId(invoice);
      const existingItemName = invoiceId ? existingItemNames.get(invoiceId) : null;
      return existingItemName ? { ...invoice, item_name: existingItemName } : invoice;
    });
  }

  const detailedInvoices = await mapWithConcurrency(
    invoiceIdsForDetail,
    getInvoiceDetailConcurrency(),
    async (invoiceId) => {
      const detailedInvoice = await fetchZohoInvoiceDetail(accessToken, invoiceId);
      return detailedInvoice ?? invoicesById.get(invoiceId) ?? null;
    }
  );

  const detailedInvoicesById = new Map<string, Record<string, unknown>>();
  detailedInvoices.forEach((invoice) => {
    const invoiceId = invoice ? getInvoiceId(invoice) : null;
    if (invoiceId && invoice) {
      detailedInvoicesById.set(invoiceId, invoice);
    }
  });

  return invoices.map((invoice) => {
    const invoiceId = getInvoiceId(invoice);
    if (!invoiceId) {
      return invoice;
    }

    const existingItemName = existingItemNames.get(invoiceId);
    if (existingItemName) {
      return { ...invoice, item_name: existingItemName };
    }

    return detailedInvoicesById.get(invoiceId) ?? invoice;
  });
}

export async function fetchZohoExpenses(accessToken: string) {
  const payload = await fetchZohoList(accessToken, "expenses");
  return ExpenseResponse.parse(payload).expenses;
}

export type BillDetail = { accountName: string | null; itemName: string | null };

export async function fetchZohoBills(accessToken: string, existingBillDetails = new Map<string, BillDetail>()) {
  const payload = await fetchZohoList(accessToken, "bills");
  const bills = BillResponse.parse(payload).bills;

  if (bills.length === 0) {
    return [];
  }

  const billsById = new Map<string, Record<string, unknown>>();
  const billIdsForDetail: string[] = [];

  bills.forEach((bill) => {
    const billId = getBillId(bill);
    if (!billId) {
      return;
    }

    billsById.set(billId, bill);

    // Already-synced bills with both an account and item name skip the
    // detail call entirely to conserve Zoho's daily API limit; bills that
    // are still missing either value (e.g. from before this backfill) keep
    // getting retried until Zoho returns line items for them.
    if (!existingBillDetails.has(billId)) {
      billIdsForDetail.push(billId);
    }
  });

  if (billIdsForDetail.length === 0) {
    return bills.map((bill) => mergeBillDetail(bill, existingBillDetails));
  }

  const detailedBills = await mapWithConcurrency(
    billIdsForDetail,
    getBillDetailConcurrency(),
    async (billId) => {
      const detailedBill = await fetchZohoBillDetail(accessToken, billId);
      return detailedBill ?? billsById.get(billId) ?? null;
    }
  );

  const detailedBillsById = new Map<string, Record<string, unknown>>();
  detailedBills.forEach((bill) => {
    const billId = bill ? getBillId(bill) : null;
    if (billId && bill) {
      detailedBillsById.set(billId, bill);
    }
  });

  return bills.map((bill) => {
    const billId = getBillId(bill);
    if (!billId) {
      return bill;
    }

    if (existingBillDetails.has(billId)) {
      return mergeBillDetail(bill, existingBillDetails);
    }

    return detailedBillsById.get(billId) ?? bill;
  });
}

function mergeBillDetail(bill: Record<string, unknown>, existingBillDetails: Map<string, BillDetail>) {
  const billId = getBillId(bill);
  const existing = billId ? existingBillDetails.get(billId) : undefined;
  return existing ? { ...bill, account_name: existing.accountName, item_name: existing.itemName } : bill;
}

export async function fetchZohoCustomerDetail(accessToken: string, customerId: string) {
  const booksBaseUrl = getEnv("ZOHO_BOOKS_BASE_URL", "https://www.zohoapis.com/books/v3");
  const organizationId = getEnv("ZOHO_ORGANIZATION_ID");
  const url = new URL(`${booksBaseUrl}/contacts/${customerId}`);
  url.searchParams.set("organization_id", organizationId);

  for (let attempt = 1; attempt <= CUSTOMER_DETAIL_MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`
      },
      cache: "no-store"
    });

    if (response.ok) {
      const payload = await response.json();
      const detail = CustomerDetailResponse.parse(payload).contact;
      // console.log("[zoho][customerDetail]", {
      //   customerId,
      //   hasBillingAddress: Boolean(detail?.billing_address),
      //   billingAddress: detail?.billing_address
      // });
      return detail ?? null;
    }

    if (response.status === 429 && attempt < CUSTOMER_DETAIL_MAX_ATTEMPTS) {
      const delayMs = getRetryDelayMs(response, attempt);
      console.warn(
        `Zoho contact detail fetch rate limited for ${customerId} with 429; retrying attempt ${attempt + 1}/${CUSTOMER_DETAIL_MAX_ATTEMPTS} after ${delayMs}ms`
      );
      await delay(delayMs);
      continue;
    }

    console.warn(`Zoho contact detail fetch failed for ${customerId} with ${response.status}`);
    return null;
  }

  return null;
}

export async function fetchZohoInvoiceDetail(accessToken: string, invoiceId: string) {
  const booksBaseUrl = getEnv("ZOHO_BOOKS_BASE_URL", "https://www.zohoapis.com/books/v3");
  const organizationId = getEnv("ZOHO_ORGANIZATION_ID");
  const url = new URL(`${booksBaseUrl}/invoices/${invoiceId}`);
  url.searchParams.set("organization_id", organizationId);

  for (let attempt = 1; attempt <= INVOICE_DETAIL_MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`
      },
      cache: "no-store"
    });

    if (response.ok) {
      const payload = (await response.json()) as Record<string, unknown>;
      return InvoiceDetailResponse.parse(payload).invoice ?? payload;
    }

    if (response.status === 429 && attempt < INVOICE_DETAIL_MAX_ATTEMPTS) {
      const delayMs = getRetryDelayMs(response, attempt);
      console.warn(
        `Zoho invoice detail fetch rate limited for ${invoiceId} with 429; retrying attempt ${attempt + 1}/${INVOICE_DETAIL_MAX_ATTEMPTS} after ${delayMs}ms`
      );
      await delay(delayMs);
      continue;
    }

    console.warn(`Zoho invoice detail fetch failed for ${invoiceId} with ${response.status}`);
    return null;
  }

  return null;
}

export async function fetchZohoBillDetail(accessToken: string, billId: string) {
  const booksBaseUrl = getEnv("ZOHO_BOOKS_BASE_URL", "https://www.zohoapis.com/books/v3");
  const organizationId = getEnv("ZOHO_ORGANIZATION_ID");
  const url = new URL(`${booksBaseUrl}/bills/${billId}`);
  url.searchParams.set("organization_id", organizationId);

  for (let attempt = 1; attempt <= BILL_DETAIL_MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`
      },
      cache: "no-store"
    });

    if (response.ok) {
      const payload = (await response.json()) as Record<string, unknown>;
      const bill = BillDetailResponse.parse(payload).bill ?? payload;
      return enrichBillWithLineItemDetails(bill);
    }

    if (response.status === 429 && attempt < BILL_DETAIL_MAX_ATTEMPTS) {
      const delayMs = getRetryDelayMs(response, attempt);
      console.warn(
        `Zoho bill detail fetch rate limited for ${billId} with 429; retrying attempt ${attempt + 1}/${BILL_DETAIL_MAX_ATTEMPTS} after ${delayMs}ms`
      );
      await delay(delayMs);
      continue;
    }

    console.warn(`Zoho bill detail fetch failed for ${billId} with ${response.status}`);
    return null;
  }

  return null;
}

// Only used for on-demand single-record resync (see resyncZohoRecords in
// lib/zoho/sync.ts); the bulk fetchZohoExpenses list call already returns
// everything mapExpense needs, so this isn't part of the regular sync path.
export async function fetchZohoExpenseDetail(accessToken: string, expenseId: string) {
  const booksBaseUrl = getEnv("ZOHO_BOOKS_BASE_URL", "https://www.zohoapis.com/books/v3");
  const organizationId = getEnv("ZOHO_ORGANIZATION_ID");
  const url = new URL(`${booksBaseUrl}/expenses/${expenseId}`);
  url.searchParams.set("organization_id", organizationId);

  for (let attempt = 1; attempt <= EXPENSE_DETAIL_MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`
      },
      cache: "no-store"
    });

    if (response.ok) {
      const payload = (await response.json()) as Record<string, unknown>;
      return ExpenseDetailResponse.parse(payload).expense ?? payload;
    }

    if (response.status === 429 && attempt < EXPENSE_DETAIL_MAX_ATTEMPTS) {
      const delayMs = getRetryDelayMs(response, attempt);
      console.warn(
        `Zoho expense detail fetch rate limited for ${expenseId} with 429; retrying attempt ${attempt + 1}/${EXPENSE_DETAIL_MAX_ATTEMPTS} after ${delayMs}ms`
      );
      await delay(delayMs);
      continue;
    }

    console.warn(`Zoho expense detail fetch failed for ${expenseId} with ${response.status}`);
    return null;
  }

  return null;
}

async function fetchZohoList(
  accessToken: string,
  resource: ZohoListResource,
  limit?: number
) {
  const booksBaseUrl = getEnv(
    "ZOHO_BOOKS_BASE_URL",
    "https://www.zohoapis.com/books/v3"
  );
  const organizationId = getEnv("ZOHO_ORGANIZATION_ID");

  const perPage = 200; // Zoho max allowed
  const allItems: Record<string, unknown>[] = [];
  let page = 1;

  const maxPages = getZohoListMaxPages();

  while (page <= maxPages) {
    const url = new URL(`${booksBaseUrl}/${resource}`);
    url.searchParams.set("organization_id", organizationId);
    url.searchParams.set("per_page", String(perPage));
    url.searchParams.set("page", String(page));

    const response = await fetch(url, {
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Zoho ${resource} fetch failed with ${response.status}`);
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const pageContext = PageContext.safeParse(payload.page_context).success
      ? PageContext.parse(payload.page_context)
      : null;

    const pageItems =
      (payload[resource] as unknown[] | undefined) ?? [];

    const normalizedItems = pageItems.filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === "object"
    );

    // If a limit is specified, don't exceed it.
    if (limit !== undefined) {
      allItems.push(
        ...normalizedItems.slice(0, limit - allItems.length)
      );
    } else {
      allItems.push(...normalizedItems);
    }

    // Stop when we've reached the requested limit.
    if (limit !== undefined && allItems.length >= limit) {
      break;
    }

    if (pageContext?.has_more_page === false) {
      break;
    }

    if (!pageContext && normalizedItems.length < perPage) {
      break;
    }

    if (normalizedItems.length === 0) {
      break;
    }

    page++;
  }

  if (page > maxPages) {
    console.warn(`Zoho ${resource} fetch stopped after ${maxPages} pages; increase ZOHO_LIST_MAX_PAGES if more records exist`);
  }

  return { [resource]: allItems } as Record<string, unknown>;
}

function getCustomerId(customer: Record<string, unknown>) {
  const candidate = customer.contact_id ?? customer.contactId ?? customer.id;
  return typeof candidate === "string" && candidate.trim() !== "" ? candidate : null;
}

function getInvoiceId(invoice: Record<string, unknown>) {
  const candidate = invoice.invoice_id ?? invoice.invoiceId ?? invoice.id;
  return typeof candidate === "string" && candidate.trim() !== "" ? candidate : null;
}

function getBillId(bill: Record<string, unknown>) {
  const candidate = bill.bill_id ?? bill.billId ?? bill.id;
  return typeof candidate === "string" && candidate.trim() !== "" ? candidate : null;
}

function getFirstRecordFromArray(value: unknown): Record<string, unknown> | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.find((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
}

// Zoho's bill list endpoint never includes account_name/item_name (they
// live on line items and are only returned by the detail endpoint), so
// every bill needs this enrichment to surface those two fields.
function enrichBillWithLineItemDetails(bill: Record<string, unknown>) {
  const firstLineItem = getFirstRecordFromArray(bill.line_items);

  const accountName =
    typeof bill.account_name === "string" && bill.account_name.trim() !== ""
      ? bill.account_name
      : typeof firstLineItem?.account_name === "string" && firstLineItem.account_name.trim() !== ""
        ? firstLineItem.account_name
        : null;

  const itemName =
    typeof bill.item_name === "string" && bill.item_name.trim() !== ""
      ? bill.item_name
      : typeof firstLineItem?.name === "string" && firstLineItem.name.trim() !== ""
        ? firstLineItem.name
        : null;

  return { ...bill, account_name: accountName, item_name: itemName };
}

function hasInvoiceItemName(invoice: Record<string, unknown>) {
  if (typeof invoice.item_name === "string" && invoice.item_name.trim() !== "") {
    return true;
  }

  if (!Array.isArray(invoice.line_items)) {
    return false;
  }

  return invoice.line_items.some((item) => {
    if (!item || typeof item !== "object") {
      return false;
    }

    const name = (item as Record<string, unknown>).name;
    return typeof name === "string" && name.trim() !== "";
  });
}

async function mapWithConcurrency<TInput, TOutput>(
  items: TInput[],
  concurrency: number,
  mapper: (item: TInput) => Promise<TOutput>
) {
  const results = new Array<TOutput>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  const workerCount = Math.min(Math.max(1, concurrency), items.length);
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}

function getCustomerDetailConcurrency() {
  const parsed = Number(process.env.ZOHO_CUSTOMER_DETAIL_CONCURRENCY);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_CUSTOMER_DETAIL_CONCURRENCY;
}

function getInvoiceDetailConcurrency() {
  const parsed = Number(process.env.ZOHO_INVOICE_DETAIL_CONCURRENCY);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_INVOICE_DETAIL_CONCURRENCY;
}

function getBillDetailConcurrency() {
  const parsed = Number(process.env.ZOHO_BILL_DETAIL_CONCURRENCY);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_BILL_DETAIL_CONCURRENCY;
}

function getZohoListMaxPages() {
  const parsed = Number(process.env.ZOHO_LIST_MAX_PAGES);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_LIST_MAX_PAGES;
}

function getRetryDelayMs(response: Response, attempt: number) {
  const retryAfter = response.headers.get("retry-after");

  if (retryAfter) {
    const retryAfterSeconds = Number(retryAfter);
    if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
      return retryAfterSeconds * 1000;
    }

    const retryAt = Date.parse(retryAfter);
    if (Number.isFinite(retryAt)) {
      return Math.max(0, retryAt - Date.now());
    }
  }

  return Math.min(10000, 1000 * 2 ** (attempt - 1));
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getEnv(name: string, fallback?: string) {
  const value = process.env[name] ?? fallback;

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}
