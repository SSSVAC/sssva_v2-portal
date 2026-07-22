import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resyncZohoRecords } from "@/lib/zoho/sync";

const EDITABLE_TABLES = {
  zoho_customers: [
    "display_name",
    "company_name",
    "email",
    "phone",
    "billing_address",
    "is_active",
    "is_member",
    "collected_by",
    "ownership",
    "customer_group",
    "order_number"
  ],
  zoho_invoices: [
    "invoice_number",
    "customer_name",
    "status",
    "date",
    "due_date",
    "total",
    "balance",
    "currency_code",
    "item_name"
  ],
  zoho_expenses: [
    "expense_number",
    "vendor_name",
    "account_name",
    "paid_through_account_name",
    "description",
    "status",
    "date",
    "due_date",
    "total",
    "balance",
    "currency_code"
  ],
  zoho_bills: [
    "bill_number",
    "vendor_name",
    "account_name",
    "item_name",
    "status",
    "date",
    "due_date",
    "total",
    "balance",
    "currency_code"
  ]
} as const;

type TableName = keyof typeof EDITABLE_TABLES;

function isTableName(value: string): value is TableName {
  return value in EDITABLE_TABLES;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ table: string }> }) {
  const { table } = await params;

  if (!isTableName(table)) {
    return NextResponse.json({ error: "Unknown table" }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const id = body?.id;
  const column = body?.column;
  const value = body?.value;

  if (typeof id !== "string" || typeof column !== "string") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const editableColumns: readonly string[] = EDITABLE_TABLES[table];
  if (!editableColumns.includes(column)) {
    return NextResponse.json({ error: "Column is not editable" }, { status: 400 });
  }

  if (value !== null && typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
    return NextResponse.json({ error: "Invalid value" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from(table)
    // Safe: `column` is checked against the table's allowlist above.
    .update({ [column]: value } as never)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ table: string }> }) {
  const { table } = await params;

  if (!isTableName(table)) {
    return NextResponse.json({ error: "Unknown table" }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const ids = body?.ids;

  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === "string")) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.from(table).delete().in("id", ids).select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deleted: data?.length ?? 0 });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ table: string }> }) {
  const { table } = await params;

  if (!isTableName(table)) {
    return NextResponse.json({ error: "Unknown table" }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const action = body?.action;
  const ids = body?.ids;

  if (action !== "resync") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === "string")) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const result = await resyncZohoRecords(table, ids);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Resync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
