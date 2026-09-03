import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getViewer } from "@/lib/auth/viewer";
import { checkRateLimit, getClientIp, rateLimitResponseInit } from "@/lib/rate-limit";
import { codeHint, generateGuestCode, guestSessionsEnabled, hashGuestCode } from "@/lib/auth/guest-pass";
import { isShareablePath } from "@/lib/auth/guest-scope";
import type { Json } from "@/types/database";

async function requireAdmin(request: NextRequest, key: string, max: number) {
  const viewer = await getViewer();

  if (!viewer) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (viewer.kind !== "staff" || !viewer.isAdmin) {
    return { error: NextResponse.json({ error: "Admin access required" }, { status: 403 }) };
  }

  const rateLimit = checkRateLimit(`${key}:${getClientIp(request)}`, { max, windowMs: 60_000 });
  if (!rateLimit.allowed) {
    return { error: NextResponse.json({ error: "Too many requests" }, rateLimitResponseInit(rateLimit)) };
  }

  return { viewer };
}

async function logAudit(
  admin: ReturnType<typeof createAdminClient>,
  actorEmail: string | null,
  action: string,
  ids: string[],
  detail: Record<string, unknown> = {}
) {
  const { error } = await admin.from("audit_log").insert({
    actor_email: actorEmail,
    action,
    table_name: "guest_passes",
    record_ids: ids,
    detail: detail as Json
  });

  if (error) {
    console.error(`[audit_log] failed to record ${action} on guest_passes`, error);
  }
}

/** Creates a pass and returns its code — the only time the code is ever readable. */
export async function POST(request: NextRequest) {
  if (!guestSessionsEnabled()) {
    return NextResponse.json(
      { error: "Set GUEST_SESSION_SECRET before issuing guest passes." },
      { status: 400 }
    );
  }

  const gate = await requireAdmin(request, "guest-passes:post", 20);
  if (gate.error) return gate.error;

  const body = await request.json().catch(() => null);
  const label = typeof body?.label === "string" ? body.label.trim() : "";
  const expiresOn = typeof body?.expiresOn === "string" ? body.expiresOn : "";
  const scopePath = typeof body?.scopePath === "string" ? body.scopePath.trim() : "";

  if (!label) {
    return NextResponse.json({ error: "Give the pass a label so you can recognise it later." }, { status: 400 });
  }

  // A share link's scope becomes a redirect target in /s/[code], so it is
  // validated against the shape of the pages that may be shared rather than
  // stored as given — otherwise a link would be an open redirect.
  if (scopePath && !isShareablePath(scopePath)) {
    return NextResponse.json({ error: "That page can't be shared." }, { status: 400 });
  }

  // The form sends a date; a pass should stay usable through the whole of
  // its last day, so it expires at the end of that day rather than midnight
  // at the start of it.
  const expiresAt = new Date(`${expiresOn}T23:59:59`);
  if (Number.isNaN(expiresAt.getTime())) {
    return NextResponse.json({ error: "Choose a valid expiry date." }, { status: 400 });
  }
  if (expiresAt <= new Date()) {
    return NextResponse.json({ error: "The expiry date must be in the future." }, { status: 400 });
  }

  const code = generateGuestCode();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("guest_passes")
    .insert({
      label,
      code_hash: hashGuestCode(code),
      code_hint: codeHint(code),
      expires_at: expiresAt.toISOString(),
      created_by: gate.viewer.email,
      scope_path: scopePath || null,
      kind: scopePath ? "link" : "code"
    })
    .select("*")
    .single();

  if (error) {
    console.error("[guest-passes] POST failed", error);
    return NextResponse.json({ error: "Could not create the pass" }, { status: 500 });
  }

  await logAudit(admin, gate.viewer.email, "create", [data.id], {
    label,
    expires_at: data.expires_at,
    scope_path: scopePath || null
  });

  return NextResponse.json({ ok: true, pass: data, code });
}

/** Revoke, restore, change the expiry, or issue a fresh code for a pass. */
export async function PATCH(request: NextRequest) {
  const gate = await requireAdmin(request, "guest-passes:patch", 30);
  if (gate.error) return gate.error;

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : null;
  const action = typeof body?.action === "string" ? body.action : null;

  if (!id || !action) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const admin = createAdminClient();

  if (action === "revoke") {
    const { error } = await admin
      .from("guest_passes")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id);

    if (error) return NextResponse.json({ error: "Could not revoke the pass" }, { status: 500 });
    await logAudit(admin, gate.viewer.email, "revoke", [id]);
    return NextResponse.json({ ok: true });
  }

  if (action === "restore") {
    const { error } = await admin.from("guest_passes").update({ revoked_at: null }).eq("id", id);
    if (error) return NextResponse.json({ error: "Could not restore the pass" }, { status: 500 });
    await logAudit(admin, gate.viewer.email, "restore", [id]);
    return NextResponse.json({ ok: true });
  }

  if (action === "expiry") {
    const expiresOn = typeof body?.expiresOn === "string" ? body.expiresOn : "";
    const expiresAt = new Date(`${expiresOn}T23:59:59`);
    if (Number.isNaN(expiresAt.getTime())) {
      return NextResponse.json({ error: "Choose a valid expiry date." }, { status: 400 });
    }

    const { error } = await admin
      .from("guest_passes")
      .update({ expires_at: expiresAt.toISOString() })
      .eq("id", id);

    if (error) return NextResponse.json({ error: "Could not update the expiry" }, { status: 500 });
    await logAudit(admin, gate.viewer.email, "update", [id], { expires_at: expiresAt.toISOString() });
    return NextResponse.json({ ok: true });
  }

  if (action === "regenerate") {
    // Codes are stored hashed and shown once, so a lost code can only be
    // replaced, never recovered. Replacing it invalidates the old one
    // immediately, which is also the fastest way to cut off one group.
    const code = generateGuestCode();
    const { error } = await admin
      .from("guest_passes")
      .update({ code_hash: hashGuestCode(code), code_hint: codeHint(code), revoked_at: null })
      .eq("id", id);

    if (error) return NextResponse.json({ error: "Could not issue a new code" }, { status: 500 });
    await logAudit(admin, gate.viewer.email, "regenerate", [id]);
    return NextResponse.json({ ok: true, code });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function DELETE(request: NextRequest) {
  const gate = await requireAdmin(request, "guest-passes:delete", 20);
  if (gate.error) return gate.error;

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : null;
  if (!id) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("guest_passes").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Could not delete the pass" }, { status: 500 });

  await logAudit(admin, gate.viewer.email, "delete", [id]);
  return NextResponse.json({ ok: true });
}
