import { createAdminClient } from "@/lib/supabase/admin";
import { CATEGORY_META, getReport } from "@/lib/reports/registry";
import type { ReportCategory } from "@/lib/reports/types";
import type { SharePreview } from "@/lib/share/link-preview";

// Deliberately separate from lib/share/link-preview.ts. This half reaches
// into the report registry, which imports the report components — pulling
// that into the pure preview helpers would drag .tsx files into any test
// that imports them, which vitest can't parse under `jsx: preserve`.

/**
 * A human-readable name for the page a share link opens.
 *
 * Only the title and description are exposed — never any figure from the
 * report. Anyone seeing the preview already holds the link, so this reveals
 * nothing they couldn't get by following it, but a preview card is copied
 * into group chats far more widely than the link is deliberately shared.
 */
export async function describeSharePath(path: string): Promise<SharePreview | null> {
  if (path === "/functions") {
    return {
      title: "Function arrangements",
      description: "What each function needs, who has committed to it, and what it has cost so far."
    };
  }

  if (path === "/reports") {
    return { title: "Reports", description: "Temple reports, view only." };
  }

  const functionMatch = /^\/functions\/([a-z0-9-]+)$/.exec(path);
  if (functionMatch) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("event_functions")
      .select("title, subtitle, description")
      .eq("slug", functionMatch[1])
      .maybeSingle();

    if (!data) return null;
    return {
      title: data.title,
      description: data.subtitle ?? data.description ?? "Function arrangements, view only."
    };
  }

  const reportMatch = /^\/reports\/([a-z]+)\/([a-z0-9-]+)$/.exec(path);
  if (reportMatch) {
    const definition = getReport(reportMatch[1], reportMatch[2]);
    if (!definition) return null;
    return { title: definition.title, description: definition.description };
  }

  const categoryMatch = /^\/reports\/([a-z]+)$/.exec(path);
  if (categoryMatch) {
    const meta = CATEGORY_META[categoryMatch[1] as ReportCategory];
    if (!meta) return null;
    return { title: meta.label, description: meta.description };
  }

  return null;
}

