import type { createClient } from "@/lib/supabase/server";
import type {
  FunctionDetail,
  FunctionRow,
  FunctionSummary,
  ItemRow,
  SectionRow,
  SectionTotals,
  SectionWithItems
} from "@/lib/functions/types";

// One client type for both viewers: the session-scoped client for staff (RLS
// applies) and, for guests, the service-role client normalised to the same
// type in lib/auth/viewer.ts, where the scope rules are documented.
type Client = Awaited<ReturnType<typeof createClient>>;

function toNumber(value: number | string | null): number {
  if (value === null) return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * A line is "covered" if someone has put their name against it, either on
 * the line itself or on the whole section — the Kumbabhishekam sheet uses
 * both, and a section-wide ubhayam means nobody needs to claim its lines
 * individually.
 */
function totalsFor(items: ItemRow[], sectionSponsor: string | null): SectionTotals {
  const sectionCovered = Boolean(sectionSponsor && sectionSponsor.trim());
  let sponsoredCount = 0;
  let expected = 0;
  let actual = 0;

  for (const item of items) {
    if (sectionCovered || (item.sponsor && item.sponsor.trim())) sponsoredCount += 1;
    expected += toNumber(item.expected_amount);
    actual += toNumber(item.actual_amount);
  }

  return {
    itemCount: items.length,
    sponsoredCount,
    openCount: items.length - sponsoredCount,
    expected,
    actual
  };
}

export async function getFunctionSummaries(supabase: Client): Promise<FunctionSummary[]> {
  const { data: functions } = await supabase
    .from("event_functions")
    .select("*")
    .order("order_no", { ascending: true })
    .returns<FunctionRow[]>();

  if (!functions || functions.length === 0) return [];

  // Two flat reads and an in-memory join rather than a nested select: the
  // whole dataset is a few hundred rows, and this keeps the shape identical
  // to getFunctionDetail's so the totals maths lives in one place.
  const [{ data: sections }, { data: items }] = await Promise.all([
    supabase.from("function_sections").select("*").returns<SectionRow[]>(),
    supabase.from("function_items").select("*").returns<ItemRow[]>()
  ]);

  const itemsBySection = new Map<string, ItemRow[]>();
  for (const item of items ?? []) {
    const list = itemsBySection.get(item.section_id) ?? [];
    list.push(item);
    itemsBySection.set(item.section_id, list);
  }

  const sectionsByFunction = new Map<string, SectionRow[]>();
  for (const section of sections ?? []) {
    const list = sectionsByFunction.get(section.function_id) ?? [];
    list.push(section);
    sectionsByFunction.set(section.function_id, list);
  }

  return functions.map((fn) => {
    const ownSections = sectionsByFunction.get(fn.id) ?? [];
    let itemCount = 0;
    let sponsoredCount = 0;
    let expected = 0;
    let actual = 0;

    for (const section of ownSections) {
      const totals = totalsFor(itemsBySection.get(section.id) ?? [], section.sponsor);
      itemCount += totals.itemCount;
      sponsoredCount += totals.sponsoredCount;
      expected += totals.expected;
      actual += totals.actual;
    }

    return {
      ...fn,
      sectionCount: ownSections.length,
      itemCount,
      sponsoredCount,
      expected,
      actual
    };
  });
}

export async function getFunctionDetail(
  supabase: Client,
  slug: string
): Promise<FunctionDetail | null> {
  const { data: fn } = await supabase
    .from("event_functions")
    .select("*")
    .eq("slug", slug)
    .maybeSingle<FunctionRow>();

  if (!fn) return null;

  const { data: sections } = await supabase
    .from("function_sections")
    .select("*")
    .eq("function_id", fn.id)
    .order("order_no", { ascending: true })
    .returns<SectionRow[]>();

  const sectionIds = (sections ?? []).map((section) => section.id);
  const { data: items } = sectionIds.length
    ? await supabase
        .from("function_items")
        .select("*")
        .in("section_id", sectionIds)
        .order("order_no", { ascending: true })
        .returns<ItemRow[]>()
    : { data: [] as ItemRow[] };

  const itemsBySection = new Map<string, ItemRow[]>();
  for (const item of items ?? []) {
    const list = itemsBySection.get(item.section_id) ?? [];
    list.push(item);
    itemsBySection.set(item.section_id, list);
  }

  const withItems: SectionWithItems[] = (sections ?? []).map((section) => {
    const sectionItems = itemsBySection.get(section.id) ?? [];
    return { ...section, items: sectionItems, totals: totalsFor(sectionItems, section.sponsor) };
  });

  const totals = withItems.reduce(
    (acc, section) => ({
      sectionCount: acc.sectionCount + 1,
      itemCount: acc.itemCount + section.totals.itemCount,
      sponsoredCount: acc.sponsoredCount + section.totals.sponsoredCount,
      openCount: acc.openCount + section.totals.openCount,
      expected: acc.expected + section.totals.expected,
      actual: acc.actual + section.totals.actual
    }),
    { sectionCount: 0, itemCount: 0, sponsoredCount: 0, openCount: 0, expected: 0, actual: 0 }
  );

  return { ...fn, sections: withItems, totals };
}
