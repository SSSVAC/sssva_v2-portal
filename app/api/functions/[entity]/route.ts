import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getViewer } from "@/lib/auth/viewer";
import { checkRateLimit, getClientIp, rateLimitResponseInit } from "@/lib/rate-limit";
import type { Json } from "@/types/database";

// Which columns each entity exposes for editing, and how each value is
// coerced. Anything not listed here can't be written through this route, so
// order_no, ids and timestamps stay out of reach.
const NUMERIC = "numeric" as const;
const TEXT = "text" as const;

const EDITABLE = {
  functions: {
    table: "event_functions",
    columns: {
      title: TEXT,
      subtitle: TEXT,
      description: TEXT,
      status: TEXT,
      starts_on: TEXT,
      ends_on: TEXT
    }
  },
  sections: {
    table: "function_sections",
    columns: {
      title: TEXT,
      subtitle: TEXT,
      code: TEXT,
      kind: TEXT,
      sponsor: TEXT,
      vendor: TEXT,
      notes: TEXT,
      estimate_amount: NUMERIC,
      advance_paid: NUMERIC,
      balance_paid: NUMERIC
    }
  },
  items: {
    table: "function_items",
    columns: {
      name: TEXT,
      qty: TEXT,
      unit: TEXT,
      time_label: TEXT,
      sponsor: TEXT,
      status: TEXT,
      notes: TEXT,
      expected_amount: NUMERIC,
      actual_amount: NUMERIC
    }
  }
} as const;

type EntityName = keyof typeof EDITABLE;

function isEntity(value: string): value is EntityName {
  return value in EDITABLE;
}

/**
 * Empty string means "cleared", not zero — a blank quantity cell and a
 * quantity of 0 are different facts, and the source sheets are full of
 * blanks that must stay blank.
 */
function coerce(kind: typeof TEXT | typeof NUMERIC, value: unknown) {
  if (value === null || value === undefined || value === "") return null;

  if (kind === NUMERIC) {
    const cleaned = String(value).replace(/[,\s₹]/g, "");
    const parsed = Number(cleaned);
    if (!Number.isFinite(parsed)) return undefined;
    return parsed;
  }

  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
    return undefined;
  }
  return String(value);
}

async function logAudit(
  admin: ReturnType<typeof createAdminClient>,
  actorEmail: string | null,
  action: string,
  table: string,
  recordIds: string[],
  detail: Record<string, unknown> = {}
) {
  const { error } = await admin.from("audit_log").insert({
    actor_email: actorEmail,
    action,
    table_name: table,
    record_ids: recordIds,
    detail: detail as Json
  });

  if (error) {
    console.error(`[audit_log] failed to record ${action} on ${table}`, error);
  }
}

/**
 * Every write here is staff-only. A guest holds a read pass and has no
 * Supabase session at all, so this rejects them the same way it rejects an
 * anonymous request — but with a clearer status, since they *are* signed in.
 */
async function requireStaff(request: NextRequest, limit: { max: number; windowMs: number }, key: string) {
  const viewer = await getViewer();

  if (!viewer) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (viewer.kind !== "staff") {
    return { error: NextResponse.json({ error: "Guest access is read-only" }, { status: 403 }) };
  }

  const rateLimit = checkRateLimit(`${key}:${getClientIp(request)}`, limit);
  if (!rateLimit.allowed) {
    return { error: NextResponse.json({ error: "Too many requests" }, rateLimitResponseInit(rateLimit)) };
  }

  return { viewer };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params;
  if (!isEntity(entity)) {
    return NextResponse.json({ error: "Unknown entity" }, { status: 404 });
  }

  const gate = await requireStaff(request, { max: 120, windowMs: 60_000 }, "functions:patch");
  if (gate.error) return gate.error;

  const body = await request.json().catch(() => null);
  const id = body?.id;
  const column = body?.column;

  if (typeof id !== "string" || typeof column !== "string") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const config = EDITABLE[entity];
  const columns: Record<string, string> = config.columns;
  if (!(column in columns)) {
    return NextResponse.json({ error: "Column is not editable" }, { status: 400 });
  }

  const value = coerce(columns[column] as typeof TEXT | typeof NUMERIC, body?.value);
  if (value === undefined) {
    return NextResponse.json({ error: "Invalid value for this field" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from(config.table)
    // Safe: `column` is checked against the entity's allowlist above.
    .update({ [column]: value } as never)
    .eq("id", id);

  if (error) {
    console.error(`[functions/${entity}] PATCH failed`, error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  await logAudit(admin, gate.viewer.email, "update", config.table, [id], { column });

  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params;
  if (entity !== "items" && entity !== "sections") {
    return NextResponse.json({ error: "Unknown entity" }, { status: 404 });
  }

  const gate = await requireStaff(request, { max: 60, windowMs: 60_000 }, "functions:post");
  if (gate.error) return gate.error;

  const body = await request.json().catch(() => null);
  const parentId = body?.parentId;
  if (typeof parentId !== "string") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const admin = createAdminClient();

  if (entity === "items") {
    const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim() : "New item";

    // Append rather than renumber: the source sheets are numbered lists the
    // committee reads off on the day, so an added line belongs at the end.
    const { data: last } = await admin
      .from("function_items")
      .select("order_no")
      .eq("section_id", parentId)
      .order("order_no", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data, error } = await admin
      .from("function_items")
      .insert({ section_id: parentId, name, order_no: (last?.order_no ?? 0) + 1 })
      .select("*")
      .single();

    if (error) {
      console.error("[functions/items] POST failed", error);
      return NextResponse.json({ error: "Could not add the item" }, { status: 500 });
    }

    await logAudit(admin, gate.viewer.email, "create", "function_items", [data.id], { name });
    return NextResponse.json({ ok: true, item: data });
  }

  const title = typeof body?.title === "string" && body.title.trim() ? body.title.trim() : "New section";
  const kind = body?.kind === "menu" || body?.kind === "schedule" ? body.kind : "items";

  const { data: last } = await admin
    .from("function_sections")
    .select("order_no")
    .eq("function_id", parentId)
    .order("order_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await admin
    .from("function_sections")
    .insert({ function_id: parentId, title, kind, order_no: (last?.order_no ?? 0) + 1 })
    .select("*")
    .single();

  if (error) {
    console.error("[functions/sections] POST failed", error);
    return NextResponse.json({ error: "Could not add the section" }, { status: 500 });
  }

  await logAudit(admin, gate.viewer.email, "create", "function_sections", [data.id], { title, kind });
  return NextResponse.json({ ok: true, section: data });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params;
  if (entity !== "items" && entity !== "sections") {
    return NextResponse.json({ error: "Unknown entity" }, { status: 404 });
  }

  const gate = await requireStaff(request, { max: 40, windowMs: 60_000 }, "functions:delete");
  if (gate.error) return gate.error;

  // Deleting a section takes its items with it (on delete cascade), so this
  // is admin-only even though editing is open to all staff.
  if (entity === "sections" && !gate.viewer.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const id = body?.id;
  if (typeof id !== "string") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const table = entity === "items" ? "function_items" : "function_sections";
  const admin = createAdminClient();
  const { error } = await admin.from(table).delete().eq("id", id);

  if (error) {
    console.error(`[functions/${entity}] DELETE failed`, error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }

  await logAudit(admin, gate.viewer.email, "delete", table, [id]);
  return NextResponse.json({ ok: true });
}
