import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  GUEST_COOKIE_NAME,
  createGuestSessionToken,
  guestSessionsEnabled,
  hashGuestCode,
  normalizeGuestCode
} from "@/lib/auth/guest-pass";
import { GUEST_HOME, guestLandingPath, isShareablePath } from "@/lib/auth/guest-scope";
import { checkRateLimit, getClientIp, rateLimitResponseInit } from "@/lib/rate-limit";

// A share link is capped at a day per visit even when the pass runs for
// months, so a link opened on a shared or borrowed phone doesn't leave a
// long-lived session behind it. Following the link again just re-issues.
const SHARE_SESSION_MS = 24 * 60 * 60 * 1000;

/**
 * Opens a share link: `/s/<code>` validates the code, starts a read-only
 * guest session and redirects to the page the link was made for.
 *
 * The code is in the URL rather than typed, which is the whole point of a
 * share link — so it is treated as a credential in transit: the redirect
 * lands on a clean path with no trace of the code, and the session lives in
 * an httpOnly cookie rather than the address bar, so forwarding the page
 * afterwards doesn't forward the credential.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const origin = request.nextUrl.origin;

  const deny = (reason: string) =>
    NextResponse.redirect(new URL(`/login?share=${reason}`, origin));

  if (!guestSessionsEnabled()) {
    return deny("disabled");
  }

  // Share links are guessable only by brute force, so rate-limit the attempt
  // rather than relying on entropy alone.
  const rateLimit = checkRateLimit(`share:${getClientIp(request)}`, { max: 30, windowMs: 10 * 60_000 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, rateLimitResponseInit(rateLimit));
  }

  const admin = createAdminClient();
  const { data: pass } = await admin
    .from("guest_passes")
    .select("id, expires_at, revoked_at, scope_path, use_count")
    .eq("code_hash", hashGuestCode(normalizeGuestCode(code)))
    .maybeSingle();

  if (!pass) return deny("invalid");
  if (pass.revoked_at) return deny("revoked");

  const expiresAt = new Date(pass.expires_at);
  if (expiresAt <= new Date()) return deny("expired");

  const sessionExpiry = new Date(Math.min(expiresAt.getTime(), Date.now() + SHARE_SESSION_MS));
  const token = createGuestSessionToken(pass.id, sessionExpiry);
  if (!token) return deny("disabled");

  // Re-validated on the way out as well as on the way in: a scope_path is
  // written by an admin, but this is what actually turns into a redirect, and
  // an unchecked stored path would be an open redirect.
  const target =
    pass.scope_path && isShareablePath(pass.scope_path) ? guestLandingPath(pass.scope_path) : GUEST_HOME;

  const response = NextResponse.redirect(new URL(target, origin));
  response.cookies.set(GUEST_COOKIE_NAME, token, {
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

  return response;
}
