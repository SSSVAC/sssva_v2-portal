import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Supabase serves a PostgREST request under two limits that a plain
 * `select()` silently runs into:
 *
 *  - `db-max-rows` (1000 by default) truncates the response, so a table with
 *    more rows than that simply loses the rest — no error, no indication.
 *  - the `authenticated` role's statement timeout aborts a query that takes
 *    too long, which a wide select over thousands of rows (especially one
 *    pulling a `raw` jsonb column) reaches easily. That comes back as an
 *    error with `data: null`, and the usual `data ?? []` at the call site
 *    turns it into "this table is empty".
 *
 * Reading in fixed-size slices stays under both: every request is small and
 * bounded. The error, if one still comes, is returned rather than swallowed,
 * so the page can say the load failed instead of showing an empty table.
 */
export const SUPABASE_PAGE_SIZE = 500;

// Guard against looping forever if a backend keeps returning full pages.
// Well past any real table here; reaching it means something is wrong.
const MAX_PAGES = 400;

type PageResult<Row> = { data: Row[] | null; error: PostgrestError | null };

export type FetchAllResult<Row> = {
  rows: Row[];
  /** Null on a complete read. Set if a slice failed — `rows` is then partial. */
  error: PostgrestError | null;
};

/**
 * Reads every row a query matches, one slice at a time.
 *
 * `buildPage` is called once per slice rather than a query being reused: a
 * PostgREST query builder is a one-shot thenable, so each range needs its own.
 * Give the query a deterministic order (add `id` as a tiebreaker on any
 * non-unique sort key) or rows can repeat or go missing across slice
 * boundaries.
 */
export async function fetchAllRows<Row>(
  buildPage: (from: number, to: number) => PromiseLike<PageResult<Row>>,
  pageSize: number = SUPABASE_PAGE_SIZE
): Promise<FetchAllResult<Row>> {
  const rows: Row[] = [];

  for (let pageIndex = 0; pageIndex < MAX_PAGES; pageIndex++) {
    const from = pageIndex * pageSize;
    const { data, error } = await buildPage(from, from + pageSize - 1);

    if (error) {
      // Whatever arrived before the failure is still real; the caller decides
      // whether to show it alongside the error.
      return { rows, error };
    }

    const page = data ?? [];
    rows.push(...page);

    if (page.length < pageSize) break;
  }

  return { rows, error: null };
}
