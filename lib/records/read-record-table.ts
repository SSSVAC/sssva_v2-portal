import type { PostgrestError } from "@supabase/supabase-js";
import type { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export type RecordTableName = "zoho_customers" | "zoho_invoices" | "zoho_expenses" | "zoho_bills";
export type RecordRow = Record<string, unknown>;

export type RecordTableRead = {
  rows: RecordRow[];
  /** Message to show instead of pretending the table is empty. */
  error: string | null;
  /**
   * Rows the table has but is hiding because a Zoho sync archived them.
   * Only counted when nothing else loaded, since that is the one case where
   * "no records" needs explaining.
   */
  archivedCount: number | null;
};

/**
 * PostgREST rejects a select naming a column the database doesn't have, and
 * it rejects the whole request — so one column this deployment hasn't
 * migrated yet turns the entire table blank. The Zoho sync already carries a
 * fallback for exactly this (see getMissingZohoCustomerColumns in
 * lib/zoho/sync.ts), because this project's Supabase schema has run behind
 * the app before.
 */
function isMissingColumnError(error: PostgrestError) {
  if (error.code === "42703" || error.code === "PGRST204") return true;
  return /does not exist|schema cache|failed to parse/i.test(error.message ?? "");
}

/**
 * Reads a Records table in full: every unarchived row, in slices (see
 * fetchAllRows), asking only for the columns the table renders.
 *
 * Two things it deliberately does NOT do is fail silently or fail closed. A
 * column the deployed schema is missing falls back to `select("*")` rather
 * than blanking the table, and anything else that goes wrong comes back as a
 * message the page can show.
 */
export async function readRecordTable(
  supabase: ServerClient,
  table: RecordTableName,
  columns: string,
  orderBy: { column: string; ascending: boolean }
): Promise<RecordTableRead> {
  // `id` is a tiebreaker on every sort: rows sharing a date or a name would
  // otherwise be free to move between two slices, and one could arrive twice
  // or not at all.
  const page = (select: string) => (from: number, to: number) =>
    supabase
      .from(table)
      .select(select)
      .is("archived_at", null)
      .order(orderBy.column, { ascending: orderBy.ascending })
      .order("id", { ascending: true })
      .range(from, to)
      .returns<RecordRow[]>();

  let result = await fetchAllRows<RecordRow>(page(columns));

  if (result.error && isMissingColumnError(result.error)) {
    console.warn(
      `[records] ${table}: the deployed schema is missing a column this page asks for; falling back to select("*"). Apply supabase/schema.sql.`,
      result.error.message
    );
    result = await fetchAllRows<RecordRow>(page("*"));
  }

  if (result.error) {
    console.error(`[records] ${table} read failed`, result.error);
    return { rows: result.rows, error: result.error.message, archivedCount: null };
  }

  return {
    rows: result.rows,
    error: null,
    archivedCount: result.rows.length === 0 ? await countArchived(supabase, table) : null
  };
}

/**
 * An empty Records table is normally a sync that has never run — but it is
 * also what a sync that archived everything looks like, and the two are
 * indistinguishable on screen. Counting the hidden rows lets the page say
 * which one happened instead of leaving someone to guess.
 */
async function countArchived(supabase: ServerClient, table: RecordTableName) {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .not("archived_at", "is", null);

  if (error) return null;
  return count ?? 0;
}
