import { describe, expect, it } from "vitest";
import type { PostgrestError } from "@supabase/supabase-js";
import { fetchAllRows } from "./fetch-all";

type Row = { n: number };

/** A fake table of `total` rows that honours the requested range, the way
 *  PostgREST does — but never returns more than `cap` rows in one response,
 *  which is what Supabase's db-max-rows does to an unpaged select. */
function fakeTable(total: number, cap = Number.POSITIVE_INFINITY) {
  const calls: [number, number][] = [];

  const buildPage = async (from: number, to: number) => {
    calls.push([from, to]);
    const end = Math.min(to + 1, from + cap, total);
    const data: Row[] = [];
    for (let n = from; n < end; n++) data.push({ n });
    return { data, error: null as PostgrestError | null };
  };

  return { buildPage, calls };
}

describe("fetchAllRows", () => {
  it("reads past the single-response row cap that truncated the Records tables", async () => {
    // 2,300 rows behind a 1,000-row cap: one unpaged select would have
    // returned 1,000 and silently dropped the other 1,300.
    const table = fakeTable(2300, 1000);
    const { rows, error } = await fetchAllRows<Row>(table.buildPage, 500);

    expect(error).toBeNull();
    expect(rows).toHaveLength(2300);
    expect(rows[0]).toEqual({ n: 0 });
    expect(rows[2299]).toEqual({ n: 2299 });
  });

  it("stops on the first short page rather than requesting one past the end", async () => {
    const table = fakeTable(1000);
    const { rows } = await fetchAllRows<Row>(table.buildPage, 500);

    expect(rows).toHaveLength(1000);
    // 0-499, 500-999, then 1000-1499 comes back empty and ends it.
    expect(table.calls).toEqual([
      [0, 499],
      [500, 999],
      [1000, 1499]
    ]);
  });

  it("makes exactly one request for a table smaller than a page", async () => {
    const table = fakeTable(12);
    const { rows } = await fetchAllRows<Row>(table.buildPage, 500);

    expect(rows).toHaveLength(12);
    expect(table.calls).toEqual([[0, 499]]);
  });

  it("returns the error with whatever loaded, instead of an empty table", async () => {
    const failure = { message: "canceling statement due to statement timeout" } as PostgrestError;
    let call = 0;

    const { rows, error } = await fetchAllRows<Row>(async () => {
      call += 1;
      if (call > 1) return { data: null, error: failure };
      return { data: [{ n: 1 }, { n: 2 }], error: null };
    }, 2);

    expect(error).toBe(failure);
    expect(rows).toEqual([{ n: 1 }, { n: 2 }]);
  });

  it("reports an empty table as empty, not as a failure", async () => {
    const { rows, error } = await fetchAllRows<Row>(async () => ({ data: [], error: null }));

    expect(rows).toEqual([]);
    expect(error).toBeNull();
  });
});
