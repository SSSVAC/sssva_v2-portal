import { createHash, createHmac, randomInt, timingSafeEqual } from "crypto";

// O, 0, I and 1 are left out so a code can be read aloud or retyped from a
// WhatsApp message without the O/0 and I/1 confusions. L is kept: codes are
// always uppercase, where it is unambiguous once 1 and I are gone.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const GROUP_LENGTH = 4;
const GROUP_COUNT = 3;

export const GUEST_COOKIE_NAME = "sssva_guest";

/** e.g. "SSSVA-7K3M-9QX2-BT4F" — 12 random chars ≈ 60 bits of entropy. */
export function generateGuestCode() {
  const groups: string[] = [];
  for (let group = 0; group < GROUP_COUNT; group += 1) {
    let chunk = "";
    for (let index = 0; index < GROUP_LENGTH; index += 1) {
      chunk += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    }
    groups.push(chunk);
  }
  return `SSSVA-${groups.join("-")}`;
}

/**
 * Codes are generated, not chosen, so they carry ~60 bits of entropy and a
 * plain SHA-256 is the right hash here — there is no low-entropy secret for
 * an attacker to grind through, and the lookup has to be a single indexed
 * equality check rather than a scan over every row with bcrypt.
 */
export function hashGuestCode(code: string) {
  return createHash("sha256").update(normalizeGuestCode(code)).digest("hex");
}

/** Tolerates the ways a code gets mangled in transit: case, spaces, stray dashes. */
export function normalizeGuestCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export function codeHint(code: string) {
  const normalized = normalizeGuestCode(code);
  return normalized.slice(-4);
}

// ---------------------------------------------------------------------------
// Session cookie
//
// A guest has no Supabase account, so there is no JWT to carry the session.
// The cookie is `<passId>.<expiryMs>.<hmac>` — signed, not encrypted; it
// holds no secret, and the signature is what stops a visitor from editing the
// pass id or pushing the expiry out.
// ---------------------------------------------------------------------------

function sessionSecret() {
  const secret = process.env.GUEST_SESSION_SECRET;
  // Fail closed: with no secret configured, guest sign-in is simply
  // unavailable rather than silently unsigned.
  return secret && secret.length >= 16 ? secret : null;
}

export function guestSessionsEnabled() {
  return sessionSecret() !== null;
}

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function createGuestSessionToken(passId: string, expiresAt: Date) {
  const secret = sessionSecret();
  if (!secret) return null;

  const payload = `${passId}.${expiresAt.getTime()}`;
  return `${payload}.${sign(payload, secret)}`;
}

export type GuestSessionClaims = {
  passId: string;
  expiresAt: Date;
};

export function readGuestSessionToken(token: string | undefined): GuestSessionClaims | null {
  const secret = sessionSecret();
  if (!secret || !token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [passId, expiryRaw, signature] = parts;
  const expected = sign(`${passId}.${expiryRaw}`, secret);

  const given = Buffer.from(signature, "hex");
  const want = Buffer.from(expected, "hex");
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null;

  const expiryMs = Number(expiryRaw);
  if (!Number.isFinite(expiryMs) || expiryMs <= Date.now()) return null;

  return { passId, expiresAt: new Date(expiryMs) };
}
