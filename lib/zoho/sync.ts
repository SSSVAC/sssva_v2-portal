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
  type ExistingCustomerSyncState
} from "@/lib/zoho/client";
import {
  mapZohoBill,
  mapZohoBillPayments,
  mapZohoCustomer,
  mapZohoExpense,
  mapZohoInvoice
} from "@/lib/zoho/mappers";
import { notifySyncFailure } from "@/lib/alerts";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { reconcileCustomer, type ExistingCustomerRecord } from "@/lib/zoho/reconcile-customer";

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
    const [existingCustomers, existingItemNames, existingSubjects, existingBillDetails] = await Promise.all([
      resolvedOptions.customers ? loadExistingCustomers(supabase) : Promise.resolve(new Map<string, ExistingCustomerState>()),
      resolvedOptions.invoices ? loadExistingInvoiceItemNames(supabase) : Promise.resolve(new Map<string, string | null>()),
      resolvedOptions.invoices ? loadExistingInvoiceSubjects(supabase) : Promise.resolve(new Map<string, string>()),
      resolvedOptions.bills ? loadExistingBillDetails(supabase) : Promise.resolve(new Map<string, BillDetail>())
    ]);

    const [customers, invoices, expenses, bills] = await Promise.all([
      resolvedOptions.customers
        ? fetchZohoCustomers(accessToken, undefined, toDetailCallState(existingCustomers))
        : Promise.resolve([]),
      resolvedOptions.invoices ? fetchZohoInvoices(accessToken, existingItemNames, existingSubjects) : Promise.resolve([]),
      resolvedOptions.expenses ? fetchZohoExpenses(accessToken) : Promise.resolve([]),
      resolvedOptions.bills ? fetchZohoBills(accessToken, existingBillDetails) : Promise.resolve([])
    ]);

    // customers.forEach((customer, index) => {
    //   console.log(`Zoho customer payload #${index + 1}`, JSON.stringify(customer, null, 2));
    // });

    const mappedCustomers = customers.reduce<Array<ReturnType<typeof mapZohoCustomer>>>((acc, customer) => {
      try {
        const mapped = mapZohoCustomer(customer);
        // Zoho's copy vs the portal's, decided per field: a value Zoho has
        // changed lands, a correction made here survives, and a blank from
        // Zoho never wipes something we hold. See reconcile-customer.ts.
        acc.push(reconcileCustomer(mapped, existingCustomers.get(mapped.zoho_customer_id)?.record));
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

    // Only bills that came back from the detail endpoint carry `payments`.
    // For those the stored set is replaced, so a payment deleted in Zoho
    // disappears here too; bills served from the list endpoint are absent
    // from refreshedBillIds and keep whatever they already had.
    if (resolvedOptions.bills) {
      const refreshedBillIds: string[] = [];
      const mappedPayments = bills.flatMap((bill) => {
        const payments = mapZohoBillPayments(bill);
        if (payments === null) return [];
        const billId = typeof bill.bill_id === "string" ? bill.bill_id : null;
        if (billId) refreshedBillIds.push(billId);
        return payments;
      });

      if (refreshedBillIds.length > 0) {
        const { error: deleteError } = await supabase
          .from("zoho_bill_payments")
          .delete()
          .in("zoho_bill_id", refreshedBillIds);

        if (deleteError) throw deleteError;
      }

      if (mappedPayments.length > 0) {
        const { error: paymentError } = await supabase
          .from("zoho_bill_payments")
          .upsert(mappedPayments, { onConflict: "payment_key" });

        if (paymentError) throw paymentError;
      }
    }

    // A full sync fetches each resource's *complete* current Zoho list
    // (lib/zoho/client.ts's fetchZohoList pages until Zoho reports no
    // more), so anything previously synced but absent from this run's
    // mapped set no longer exists in Zoho — archive it. Gated on
    // resolvedOptions rather than "mapped list is non-empty", since a
    // resource that was excluded from this sync (e.g. "Invoices Only")
    // must be left untouched entirely, and a resource that's genuinely
    // gone to zero in Zoho (mapped list empty, but selected) must still
    // archive everything that used to be there.
    let recordsArchived = 0;
    if (resolvedOptions.customers) {
      recordsArchived += await archiveMissingRecords(
        supabase,
        "zoho_customers",
        "zoho_customer_id",
        new Set(mappedCustomers.map((row) => row.zoho_customer_id))
      );
    }
    if (resolvedOptions.invoices) {
      recordsArchived += await archiveMissingRecords(
        supabase,
        "zoho_invoices",
        "zoho_invoice_id",
        new Set(mappedInvoices.map((row) => row.zoho_invoice_id))
      );
    }
    if (resolvedOptions.expenses) {
      recordsArchived += await archiveMissingRecords(
        supabase,
        "zoho_expenses",
        "zoho_expense_id",
        new Set(mappedExpenses.map((row) => row.zoho_expense_id))
      );
    }
    if (resolvedOptions.bills) {
      recordsArchived += await archiveMissingRecords(
        supabase,
        "zoho_bills",
        "zoho_bill_id",
        new Set(mappedBills.map((row) => row.zoho_bill_id))
      );
    }

    const recordsUpserted = mappedCustomers.length + mappedInvoices.length + mappedExpenses.length + mappedBills.length;

    await supabase
      .from("sync_runs")
      .update({
        status: "succeeded",
        finished_at: new Date().toISOString(),
        records_upserted: recordsUpserted,
        records_archived: recordsArchived
      })
      .eq("id", run.id);

    return {
      ok: true,
      resources: selectedResources,
      recordsUpserted,
      recordsArchived,
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

    await notifySyncFailure(message);

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

// A run may archive at most this share of a table. A fresh Zoho fetch that
// comes back short — a truncated list (ZOHO_LIST_MAX_PAGES), pages that
// half-failed, a resource that returned nothing — is indistinguishable from
// a mass deletion in Zoho, and the two have very different consequences:
// one is a handful of stale rows, the other is a Records page that goes
// blank. Real deletions arrive a few records at a time, so a run asking to
// archive most of a table is reporting a bad fetch and is refused.
const MAX_ARCHIVE_SHARE = 0.2;
// Below this many rows the share is meaningless — deleting 1 of 4 records is
// 25% and perfectly ordinary.
const ARCHIVE_GUARD_MIN_ROWS = 20;

/** Whether this run's archive set is too large to be a real set of deletions. */
export function shouldRefuseArchive(existingCount: number, staleCount: number) {
  if (existingCount < ARCHIVE_GUARD_MIN_ROWS) return false;
  return staleCount / existingCount > MAX_ARCHIVE_SHARE;
}

// Marks every currently-unarchived row whose Zoho id isn't in freshZohoIds
// as archived — called once per resource per full sync, after that
// resource's fresh fetch has been upserted. Never called for a resource
// excluded from the current sync (see the resolvedOptions gate at each call
// site), since an empty freshZohoIds set from a resource that simply wasn't
// fetched would otherwise archive everything.
async function archiveMissingRecords(
  supabase: ReturnType<typeof createAdminClient>,
  table: ResyncTableName,
  zohoIdColumn: string,
  freshZohoIds: Set<string>
) {
  // Paged: an unpaged read stops at Supabase's 1000-row cap, so on a larger
  // table this only ever considered the first thousand rows — and, worse,
  // measured the guard below against that thousand instead of the table.
  const { rows: existing, error } = await fetchAllRows<Record<string, unknown>>((from, to) =>
    supabase
      .from(table)
      .select(`id, ${zohoIdColumn}`)
      .is("archived_at", null)
      .order("id", { ascending: true })
      .range(from, to)
      .returns<Record<string, unknown>[]>()
  );

  if (error) {
    throw error;
  }

  const staleIds = existing
    .filter((row) => {
      const zohoId = row[zohoIdColumn];
      return typeof zohoId === "string" && !freshZohoIds.has(zohoId);
    })
    .map((row) => row.id as string);

  if (staleIds.length === 0) {
    return 0;
  }

  if (shouldRefuseArchive(existing.length, staleIds.length)) {
    console.warn(
      `[zoho][archive] Refusing to archive ${staleIds.length} of ${existing.length} rows in ${table}: Zoho returned only ${freshZohoIds.size} records, which reads as a short fetch rather than a deletion. Nothing was archived.`
    );
    return 0;
  }

  const { error: archiveError } = await supabase
    .from(table)
    .update({ archived_at: new Date().toISOString() })
    .in("id", staleIds);

  if (archiveError) {
    throw archiveError;
  }

  return staleIds.length;
}

type ExistingCustomerRow = {
  zoho_customer_id: string;
  display_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  billing_address: string | null;
  zoho_display_name: string | null;
  zoho_company_name: string | null;
  zoho_email: string | null;
  zoho_phone: string | null;
  zoho_last_modified_time: string | null;
};

type ExistingCustomerState = {
  record: ExistingCustomerRecord;
  lastModifiedTime: string | null;
};

/**
 * Every customer already in Supabase: the columns as they stand, and the
 * same fields as Zoho reported them last time, read straight out of the
 * stored `raw` payload so knowing what Zoho used to say costs no API call.
 *
 * Paged, because an unpaged read stops at Supabase's 1000-row cap — and a
 * customer past that cap would look brand new to every sync, losing whatever
 * had been corrected in the portal.
 */
async function loadExistingCustomers(supabase: ReturnType<typeof createAdminClient>) {
  const map = new Map<string, ExistingCustomerState>();

  const { rows, error } = await fetchAllRows<ExistingCustomerRow>((from, to) =>
    supabase
      .from("zoho_customers")
      .select(
        "zoho_customer_id, display_name, company_name, email, phone, billing_address, zoho_display_name:raw->>contact_name, zoho_company_name:raw->>company_name, zoho_email:raw->>email, zoho_phone:raw->>phone, zoho_last_modified_time:raw->>last_modified_time"
      )
      .order("zoho_customer_id", { ascending: true })
      .range(from, to)
      .returns<ExistingCustomerRow[]>()
  );

  if (error) {
    // Falling through with what loaded would look like "these customers are
    // new" and overwrite their portal edits, so a partial read is no read.
    console.warn("[zoho][loadExistingCustomers] failed; syncing without portal-side reconciliation", error.message);
    return map;
  }

  for (const row of rows) {
    map.set(row.zoho_customer_id, {
      lastModifiedTime: row.zoho_last_modified_time,
      record: {
        stored: {
          display_name: row.display_name,
          company_name: row.company_name,
          email: row.email,
          phone: row.phone,
          billing_address: row.billing_address
        },
        lastSynced: {
          display_name: row.zoho_display_name,
          company_name: row.zoho_company_name,
          email: row.zoho_email,
          phone: row.zoho_phone
        }
      }
    });
  }

  return map;
}

/** The slice of the above that lib/zoho/client.ts needs to skip detail calls. */
function toDetailCallState(existing: Map<string, ExistingCustomerState>) {
  const map = new Map<string, ExistingCustomerSyncState>();

  existing.forEach((state, customerId) => {
    map.set(customerId, {
      hasBillingAddress: Boolean(state.record.stored.billing_address),
      lastModifiedTime: state.lastModifiedTime
    });
  });

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

// Only invoices that already have a subject are cached; a zero-total
// invoice still missing one is retried on every sync until Zoho's detail
// endpoint returns it (same pattern as loadExistingBillDetails below).
async function loadExistingInvoiceSubjects(supabase: ReturnType<typeof createAdminClient>) {
  const map = new Map<string, string>();
  const { data, error } = await supabase.from("zoho_invoices").select("zoho_invoice_id, subject").not("subject", "is", null);

  if (error || !data) {
    return map;
  }

  for (const row of data) {
    if (row.subject) {
      map.set(row.zoho_invoice_id, row.subject);
    }
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

  // Sum what's already recorded per bill, so fetchZohoBills can tell a bill
  // whose payments are fully captured from one that has been paid against
  // since the last sync.
  const paidByBill = new Map<string, number>();
  const { data: payments } = await supabase.from("zoho_bill_payments").select("zoho_bill_id, amount");
  for (const payment of payments ?? []) {
    paidByBill.set(
      payment.zoho_bill_id,
      (paidByBill.get(payment.zoho_bill_id) ?? 0) + Number(payment.amount ?? 0)
    );
  }

  for (const row of data) {
    if (row.account_name && row.item_name) {
      map.set(row.zoho_bill_id, {
        accountName: row.account_name,
        itemName: row.item_name,
        paidRecorded: paidByBill.get(row.zoho_bill_id) ?? 0
      });
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
