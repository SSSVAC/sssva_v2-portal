import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  codeHint,
  createGuestSessionToken,
  generateGuestCode,
  guestSessionsEnabled,
  hashGuestCode,
  normalizeGuestCode,
  readGuestSessionToken
} from "./guest-pass";
import { guestCanAccessPath, guestLandingPath, isShareablePath } from "./guest-scope";

const SECRET = "test-secret-at-least-16-chars";

describe("guest codes", () => {
  it("generates codes in the shared format", () => {
    const code = generateGuestCode();
    expect(code).toMatch(/^SSSVA(-[A-Z2-9]{4}){3}$/);
  });

  it("does not reuse codes", () => {
    const codes = new Set(Array.from({ length: 200 }, () => generateGuestCode()));
    expect(codes.size).toBe(200);
  });

  it("leaves out characters that are misread when a code is typed from a message", () => {
    const codes = Array.from({ length: 200 }, () => generateGuestCode()).join("");
    for (const character of ["O", "0", "I", "1"]) {
      expect(codes.includes(character)).toBe(false);
    }
  });

  it("normalises the ways a code gets mangled in transit", () => {
    const code = "SSSVA-7K3M-9QX2-BT4F";
    expect(normalizeGuestCode("  sssva-7k3m-9qx2-bt4f ")).toBe(code);
    expect(normalizeGuestCode("SSSVA-7K3M-9QX2-BT4F\n")).toBe(code);
    expect(hashGuestCode("sssva-7k3m-9qx2-bt4f")).toBe(hashGuestCode(code));
  });

  it("hashes to a stable value and never stores the code itself", () => {
    const code = "SSSVA-7K3M-9QX2-BT4F";
    const hash = hashGuestCode(code);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("7K3M");
    expect(hashGuestCode(code)).toBe(hash);
    expect(hashGuestCode("SSSVA-7K3M-9QX2-BT4G")).not.toBe(hash);
  });

  it("keeps only the last four characters as a hint", () => {
    expect(codeHint("SSSVA-7K3M-9QX2-BT4F")).toBe("BT4F");
  });
});

describe("guest session tokens", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.GUEST_SESSION_SECRET = SECRET;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  function future(minutes = 60) {
    return new Date(Date.now() + minutes * 60_000);
  }

  it("round-trips a pass id and expiry", () => {
    const expires = future();
    const token = createGuestSessionToken("pass-123", expires);
    expect(token).not.toBeNull();

    const claims = readGuestSessionToken(token!);
    expect(claims?.passId).toBe("pass-123");
    expect(claims?.expiresAt.getTime()).toBe(expires.getTime());
  });

  it("rejects a token whose pass id has been swapped", () => {
    const token = createGuestSessionToken("pass-123", future())!;
    const [, expiry, signature] = token.split(".");
    expect(readGuestSessionToken(`pass-999.${expiry}.${signature}`)).toBeNull();
  });

  it("rejects a token whose expiry has been pushed out", () => {
    const token = createGuestSessionToken("pass-123", future())!;
    const [passId, , signature] = token.split(".");
    const later = Date.now() + 10 * 365 * 24 * 60 * 60_000;
    expect(readGuestSessionToken(`${passId}.${later}.${signature}`)).toBeNull();
  });

  it("rejects an expired token even though the signature is valid", () => {
    const token = createGuestSessionToken("pass-123", new Date(Date.now() - 1000))!;
    expect(readGuestSessionToken(token)).toBeNull();
  });

  it("rejects a token signed with a different secret", () => {
    const token = createGuestSessionToken("pass-123", future())!;
    process.env.GUEST_SESSION_SECRET = "another-secret-16-chars-long";
    expect(readGuestSessionToken(token)).toBeNull();
  });

  it("rejects malformed input rather than throwing", () => {
    expect(readGuestSessionToken(undefined)).toBeNull();
    expect(readGuestSessionToken("")).toBeNull();
    expect(readGuestSessionToken("nonsense")).toBeNull();
    expect(readGuestSessionToken("a.b")).toBeNull();
    expect(readGuestSessionToken("a.b.c.d")).toBeNull();
    expect(readGuestSessionToken("pass.123.zz")).toBeNull();
  });

  // Without a secret the app must not fall back to unsigned cookies — guest
  // sign-in is simply unavailable.
  it("fails closed when no secret is configured", () => {
    delete process.env.GUEST_SESSION_SECRET;
    expect(guestSessionsEnabled()).toBe(false);
    expect(createGuestSessionToken("pass-123", future())).toBeNull();
    expect(readGuestSessionToken("pass-123.999.abc")).toBeNull();
  });

  it("treats a too-short secret as no secret at all", () => {
    process.env.GUEST_SESSION_SECRET = "short";
    expect(guestSessionsEnabled()).toBe(false);
    expect(createGuestSessionToken("pass-123", future())).toBeNull();
  });
});

describe("share link scope", () => {
  it("lets an unscoped code reach anything the guest area allows", () => {
    expect(guestCanAccessPath(null, "/functions")).toBe(true);
    expect(guestCanAccessPath(null, "/reports/silai/silai-fund")).toBe(true);
  });

  it("pins a share link to exactly its own page", () => {
    const scope = "/reports/silai/silai-fund";
    expect(guestCanAccessPath(scope, scope)).toBe(true);
    expect(guestCanAccessPath(scope, "/reports/silai")).toBe(false);
    expect(guestCanAccessPath(scope, "/reports/events/ugadi")).toBe(false);
    expect(guestCanAccessPath(scope, "/functions")).toBe(false);
  });

  // Prefix matching would quietly widen a link: sharing a category would
  // also share every report inside it.
  it("does not treat a parent path as covering its children", () => {
    expect(guestCanAccessPath("/reports/silai", "/reports/silai/silai-fund")).toBe(false);
    expect(guestCanAccessPath("/functions", "/functions/kumbabhishekam-2026")).toBe(false);
  });

  it("sends a scoped guest to their page and an unscoped one home", () => {
    expect(guestLandingPath("/functions/kumbabhishekam-2026")).toBe("/functions/kumbabhishekam-2026");
    expect(guestLandingPath(null)).toBe("/functions");
  });

  it("accepts only the pages that may be shared", () => {
    for (const path of [
      "/functions",
      "/functions/kumbabhishekam-2026",
      "/reports/silai",
      "/reports/silai/silai-fund",
      "/reports/events/ugadi"
    ]) {
      expect(isShareablePath(path)).toBe(true);
    }
  });

  // A stored scope becomes a redirect target, so anything outside the
  // allowlist — another family, a staff page, or an absolute URL — has to be
  // refused before it is written.
  it("refuses paths that would leak access or redirect off-site", () => {
    for (const path of [
      "/reports/financial",
      "/reports/financial/monthly-report",
      "/records",
      "/dashboard",
      "/settings/access",
      "//evil.example.com",
      "https://evil.example.com",
      "/functions/../records",
      ""
    ]) {
      expect(isShareablePath(path)).toBe(false);
    }
  });
});
