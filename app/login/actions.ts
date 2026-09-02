"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  GUEST_COOKIE_NAME,
  createGuestSessionToken,
  guestSessionsEnabled,
  hashGuestCode,
  normalizeGuestCode
} from "@/lib/auth/guest-pass";
import { GUEST_HOME } from "@/lib/auth/guest-scope";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { formatDateOnly } from "@/lib/format";

export type SignInState = { error: string | null };

export async function signIn(_prevState: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}

// A guest cookie is capped at a week even when the pass runs longer, so a
// shared phone doesn't stay signed in for months on a pass issued for a
// festival season.
const MAX_GUEST_SESSION_MS = 7 * 24 * 60 * 60 * 1000;

export async function signInAsGuest(
  _prevState: SignInState,
  formData: FormData
): Promise<SignInState> {
  if (!guestSessionsEnabled()) {
    return { error: "Guest access is not configured on this deployment." };
  }

  const raw = String(formData.get("code") ?? "");
  if (!raw.trim()) {
    return { error: "Enter the guest code you were given." };
  }

  // Codes are the only credential here and they arrive over WhatsApp, so
  // rate-limit guessing per client rather than relying on entropy alone.
  const ip = getClientIp({ headers: await headers() });
  const rateLimit = checkRateLimit(`guest:signin:${ip}`, { max: 10, windowMs: 10 * 60_000 });
  if (!rateLimit.allowed) {
    return { error: "Too many attempts. Please try again in a few minutes." };
  }

  const admin = createAdminClient();
  const { data: pass } = await admin
    .from("guest_passes")
    .select("id, label, expires_at, revoked_at, use_count")
    .eq("code_hash", hashGuestCode(normalizeGuestCode(raw)))
    .maybeSingle();

  // One message for "no such code", "revoked" and "expired" would hide a
  // genuinely useful distinction from someone holding a pass that has simply
  // run out, so expiry and revocation say so; an unknown code stays vague.
  if (!pass) {
    return { error: "That guest code isn't valid." };
  }
  if (pass.revoked_at) {
    return { error: "This guest code has been revoked. Please ask the temple office for a new one." };
  }

  const expiresAt = new Date(pass.expires_at);
  if (expiresAt <= new Date()) {
    return { error: `This guest code expired on ${formatDateOnly(pass.expires_at)}.` };
  }

  const sessionExpiry = new Date(Math.min(expiresAt.getTime(), Date.now() + MAX_GUEST_SESSION_MS));
  const token = createGuestSessionToken(pass.id, sessionExpiry);
  if (!token) {
    return { error: "Guest access is not configured on this deployment." };
  }

  const cookieStore = await cookies();
  cookieStore.set(GUEST_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: sessionExpiry
  });

  await admin
    .from("guest_passes")
    .update({ last_used_at: new Date().toISOString(), use_count: (pass.use_count ?? 0) + 1 })
    .eq("id", pass.id);

  redirect(GUEST_HOME);
}
