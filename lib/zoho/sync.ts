import { createAdminClient } from "@/lib/supabase/admin";
import {
  getZohoAccessToken,
  fetchZohoCustomers,
  fetchZohoInvoices,
  fetchZohoExpenses,
  fetchZohoBills,
  fetchZohoCustomerDetail,
  fetchZohoInvoiceDetail,
  fetchZohoExpenseDetail,
  fetchZohoBillDetail,
  type BillDetail,
  type CustomerFieldOverride
} from "@/lib/zoho/client";
import { mapZohoBill, mapZohoCustomer, mapZohoExpense, mapZohoInvoice } from "@/lib/zoho/mappers";

export const ZOHO_SYNC_RESOURCES = ["customers", "invoices", "expenses", "bills"] as const;
export type ZohoSyncResource = (typeof ZOHO_SYNC_RESOURCES)[number];
export type ZohoSyncOptions = Record<ZohoSyncResource, boolean>;

const DEFAULT_SYNC_OPTIONS: ZohoSyncOptions = {
  customers: true,
  invoices: true,
  expenses: true,
  bills: true
};

export function normalizeSyncOptions(input?: unknown): ZohoSyncOptions {
  const tokens = extractSyncTokens(input);

  if (tokens === null || tokens.includes("all")) {
    return { ...DEFAULT_SYNC_OPTIONS };
  }

  return {
    customers: tokens.includes("customers"),
    invoices: tokens.includes("invoices"),
    expenses: tokens.includes("expenses"),
    bills: tokens.includes("bills")
  };
}

function extractSyncTokens(input?: unknown): string[] | null {
  if (Array.isArray(input)) {
    return input
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim().toLowerCase());
  }

  if (typeof input === "string") {
    return input
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value !== "");
  }

  return null;
}

export async function runZohoBooksSync(options: ZohoSyncOptions = DEFAULT_SYNC_OPTIONS) {
  const supabase = createAdminClient();
  const startedAt = new Date().toISOString();
  const resolvedOptions = { ...DEFAULT_SYNC_OPTIONS, ...options };
  const selectedResources = ZOHO_SYNC_RESOURCES.filter((resource) => resolvedOptions[resource]);
  const { data: run, error: runError } = await supabase
    .from("sync_runs")
    .insert({
      provider: "zoho_books",
      status: "running",
      started_at: startedAt
    })
    .select("id")
    .single();

  if (runError) {
    throw runError;
  }

  try {
    const accessToken = await getZohoAccessToken();

    // Records already synced to Supabase skip the per-record Zoho detail
    // call (billing address / phone / line item name) to stay within API
    // rate limits. Only brand-new customers/invoices/bills pay for a detail
    // lookup; bills still missing account_name or item_name from a prior
    // sync keep getting retried until Zoho's line items backfill them.
    const [existingCustomerFields, existingItemNames, existingBillDetails] = await Promise.all([
      resolvedOptions.customers ? loadExistingCustomerFields(supabase) : Promise.resolve(new Map<string, CustomerFieldOverride>()),
      resolvedOptions.invoices ? loadExistingInvoiceItemNames(supabase) : Promise.resolve(new Map<string, string | null>()),
      resolvedOptions.bills ? loadExistingBillDetails(supabase) : Promise.resolve(new Map<string, BillDetail>())
    ]);

    const [customers, invoices, expenses, bills] = await Promise.all([
      resolvedOptions.customers
        ? fetchZohoCustomers(accessToken, undefined, existingCustomerFields)
        : Promise.resolve([]),
      resolvedOptions.invoices ? fetchZohoInvoices(accessToken, existingItemNames) : Promise.resolve([]),
      resolvedOptions.expenses ? fetchZohoExpenses(accessToken) : Promise.resolve([]),
      resolvedOptions.bills ? fetchZohoBills(accessToken, existingBillDetails) : Promise.resolve([])
    ]);

    // customers.forEach((customer, index) => {
    //   console.log(`Zoho customer payload #${index + 1}`, JSON.stringify(customer, null, 2));
    // });

    const mappedCustomers = customers.reduce<Array<ReturnType<typeof mapZohoCustomer>>>((acc, customer) => {
      try {
        acc.push(mapZohoCustomer(customer));
      } catch (error) {
        console.warn("Skipping invalid Zoho customer record", error, customer);
      }
      return acc;
    }, []);
    const mappedInvoices = invoices.reduce<Array<ReturnType<typeof mapZohoInvoice>>>((acc, invoice) => {
      try {
        acc.push(mapZohoInvoice(invoice));
      } catch (error) {
        console.warn("Skipping invalid Zoho invoice record", error, invoice);
      }
      return acc;
    }, []);
    const mappedExpenses = expenses.reduce<Array<ReturnType<typeof mapZohoExpense>>>((acc, expense) => {
      try {
        acc.push(mapZohoExpense(expense));
      } catch (error) {
        console.warn("Skipping invalid Zoho expense record", error, expense);
      }
      return acc;
    }, []);
    const mappedBills = bills.reduce<Array<ReturnType<typeof mapZohoBill>>>((acc, bill) => {
      try {
        acc.push(mapZohoBill(bill));
      } catch (error) {
        console.warn("Skipping invalid Zoho bill record", error, bill);
      }
      return acc;
    }, []);

    if (mappedCustomers.length > 0) {
      console.log("[zoho][upsertCustomers]", {
        count: mappedCustomers.length,
        withBillingAddress: mappedCustomers.filter((customer) => Boolean(customer.billing_address)).length,
        withoutBillingAddress: mappedCustomers.filter((customer) => !customer.billing_address).length,
        missingBillingAddressCustomerIds: mappedCustomers
          .filter((customer) => !customer.billing_address)
          .slice(0, 10)
          .map((customer) => customer.zoho_customer_id),
        sample: mappedCustomers[0]
      });

      const { error } = await supabase
        .from("zoho_customers")
        .upsert(mappedCustomers, { onConflict: "zoho_customer_id" });

      if (error) {
        const missingColumns = getMissingZohoCustomerColumns(error);
        if (missingColumns.length > 0) {
          console.warn("[zoho][upsertCustomers] Supabase schema is missing columns; retrying without them", {
            missingColumns,
            originalError: getErrorMessage(error)
          });

          const fallbackCustomers = mappedCustomers.map((customer) => {
            const rest = { ...customer };
            for (const column of missingColumns) {
              delete (rest as Record<string, unknown>)[column];
            }
            return rest;
          });
          const { error: fallbackError } = await supabase
            .from("zoho_customers")
            .upsert(fallbackCustomers, { onConflict: "zoho_customer_id" });

          if (fallbackError) throw fallbackError;
        } else {
          throw error;
        }
      }
    }

    if (mappedInvoices.length > 0) {
      const { error } = await supabase
        .from("zoho_invoices")
        .upsert(mappedInvoices, { onConflict: "zoho_invoice_id" });

      if (error) throw error;
    }

    if (mappedExpenses.length > 0) {
      const { error } = await supabase
        .from("zoho_expenses")
        .upsert(mappedExpenses, { onConflict: "zoho_expense_id" });

      if (error) throw error;
    }

    if (mappedBills.length > 0) {
      const { error } = await supabase
        .from("zoho_bills")
        .upsert(mappedBills, { onConflict: "zoho_bill_id" });

      if (error) throw error;
    }

    const recordsUpserted = mappedCustomers.length + mappedInvoices.length + mappedExpenses.length + mappedBills.length;

    await supabase
      .from("sync_runs")
      .update({
        status: "succeeded",
        finished_at: new Date().toISOString(),
        records_upserted: recordsUpserted
      })
      .eq("id", run.id);

    return {
      ok: true,
      resources: selectedResources,
      recordsUpserted,
      customers: mappedCustomers.length,
      invoices: mappedInvoices.length,
      expenses: mappedExpenses.length,
      bills: mappedBills.length
    };
  } catch (error) {
    const message = getErrorMessage(error);
    console.error("Zoho sync failed", error);

    await supabase
      .from("sync_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error: message
      })
      .eq("id", run.id);

    throw new Error(message);
  }
}

export const RESYNC_TABLES = ["zoho_customers", "zoho_invoices", "zoho_expenses", "zoho_bills"] as const;
export type ResyncTableName = (typeof RESYNC_TABLES)[number];

const RESYNC_ZOHO_ID_COLUMN: Record<ResyncTableName, string> = {
  zoho_customers: "zoho_customer_id",
  zoho_invoices: "zoho_invoice_id",
  zoho_expenses: "zoho_expense_id",
  zoho_bills: "zoho_bill_id"
};

// Re-fetches just the selected rows from Zoho and upserts them, instead of
// the full list sync in runZohoBooksSync above. Used by the Records UI's
// "Resync Selected" action, where a user has spotted a handful of stale or
// wrong records rather than wanting to wait on a full sync.
export async function resyncZohoRecords(table: ResyncTableName, ids: string[]) {
  const supabase = createAdminClient();
  const zohoIdColumn = RESYNC_ZOHO_ID_COLUMN[table];

  const { data: existingRows, error: lookupError } = await supabase
    .from(table)
    .select(`id, ${zohoIdColumn}`)
    .in("id", ids)
    .returns<Record<string, unknown>[]>();

  if (lookupError) {
    throw lookupError;
  }

  const zohoIds = (existingRows ?? [])
    .map((row) => row[zohoIdColumn])
    .filter((value): value is string => typeof value === "string" && value.length > 0);

  if (zohoIds.length === 0) {
    return { resynced: 0, failed: 0 };
  }

  const accessToken = await getZohoAccessToken();

  if (table === "zoho_customers") {
    const details = await Promise.all(zohoIds.map((zohoId) => fetchZohoCustomerDetail(accessToken, zohoId)));
    return upsertResyncedRecords(supabase, "zoho_customers", "zoho_customer_id", details, mapZohoCustomer);
  }

  if (table === "zoho_invoices") {
    const details = await Promise.all(zohoIds.map((zohoId) => fetchZohoInvoiceDetail(accessToken, zohoId)));
    return upsertResyncedRecords(supabase, "zoho_invoices", "zoho_invoice_id", details, mapZohoInvoice);
  }

  if (table === "zoho_expenses") {
    const details = await Promise.all(zohoIds.map((zohoId) => fetchZohoExpenseDetail(accessToken, zohoId)));
    return upsertResyncedRecords(supabase, "zoho_expenses", "zoho_expense_id", details, mapZohoExpense);
  }

  const details = await Promise.all(zohoIds.map((zohoId) => fetchZohoBillDetail(accessToken, zohoId)));
  return upsertResyncedRecords(supabase, "zoho_bills", "zoho_bill_id", details, mapZohoBill);
}

async function upsertResyncedRecords<T extends { [key: string]: unknown }>(
  supabase: ReturnType<typeof createAdminClient>,
  table: ResyncTableName,
  conflictColumn: string,
  details: Array<Record<string, unknown> | null>,
  mapRecord: (raw: Record<string, unknown>) => T
) {
  let failed = 0;

  const mapped = details.reduce<T[]>((acc, detail) => {
    if (!detail) {
      failed += 1;
      return acc;
    }

    try {
      acc.push(mapRecord(detail));
    } catch (error) {
      console.warn(`Skipping invalid Zoho record while resyncing ${table}`, error, detail);
      failed += 1;
    }

    return acc;
  }, []);

  if (mapped.length > 0) {
    const { error } = await supabase.from(table).upsert(mapped as never, { onConflict: conflictColumn });
    if (error) {
      throw error;
    }
  }

  return { resynced: mapped.length, failed };
}

async function loadExistingCustomerFields(supabase: ReturnType<typeof createAdminClient>) {
  const map = new Map<string, CustomerFieldOverride>();
  const { data, error } = await supabase.from("zoho_customers").select("zoho_customer_id, billing_address, phone");

  if (error || !data) {
    return map;
  }

  for (const row of data) {
    map.set(row.zoho_customer_id, { billingAddress: row.billing_address, phone: row.phone });
  }

  return map;
}

async function loadExistingInvoiceItemNames(supabase: ReturnType<typeof createAdminClient>) {
  const map = new Map<string, string | null>();
  const { data, error } = await supabase.from("zoho_invoices").select("zoho_invoice_id, item_name");

  if (error || !data) {
    return map;
  }

  for (const row of data) {
    map.set(row.zoho_invoice_id, row.item_name);
  }

  return map;
}

// Only bills that already have both fields populated are cached; anything
// still missing either one is retried on the next sync so it eventually
// gets backfilled once Zoho returns line items for it.
async function loadExistingBillDetails(supabase: ReturnType<typeof createAdminClient>) {
  const map = new Map<string, BillDetail>();
  const { data, error } = await supabase.from("zoho_bills").select("zoho_bill_id, account_name, item_name");

  if (error || !data) {
    return map;
  }

  for (const row of data) {
    if (row.account_name && row.item_name) {
      map.set(row.zoho_bill_id, { accountName: row.account_name, itemName: row.item_name });
    }
  }

  return map;
}

function getMissingZohoCustomerColumns(error: unknown) {
  const message = getErrorMessage(error);
  const optionalColumns = ["billing_address", "is_active"] as const;

  return optionalColumns.filter((column) => {
    const escapedColumn = column.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escapedColumn}\\b`, "i").test(message) && /does not exist|schema cache/i.test(message);
  });
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (typeof error === "object" && error && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }

  return "Unknown sync failure";
}
