import type { ReportCategory } from "@/lib/reports/types";

// What a guest pass is allowed to reach. This is the ONLY place that
// decides it — a guest request has no Supabase JWT, so its reads run through
// the service-role client (see lib/auth/viewer.ts), which bypasses row-level
// security. Nothing else stands between a guest and the database, so any
// page or route that a guest can reach must be listed here and must have
// been reviewed for what it exposes.
//
// Financial reports and Records are deliberately absent: they carry customer
// emails, phone numbers and billing addresses.
export const GUEST_REPORT_CATEGORIES: ReportCategory[] = ["silai", "events"];

export function guestCanSeeReportCategory(category: string) {
  return (GUEST_REPORT_CATEGORIES as string[]).includes(category);
}

/** Where an unscoped guest lands, and where a blocked one is sent back to. */
export const GUEST_HOME = "/functions";

/**
 * A pass pinned to one page — a share link — may open only that page.
 *
 * `scopePath` null means the pass is a code covering the whole guest area,
 * which is the original behaviour and what every pass issued before share
 * links had. The check is exact rather than prefix-based on purpose: a link
 * to `/reports/silai` should not also open `/reports/silai/silai-fund`,
 * because the person sharing it picked the narrower page deliberately.
 */
export function guestCanAccessPath(scopePath: string | null, pathname: string) {
  if (!scopePath) return true;
  return scopePath === pathname;
}

/** Where a scoped guest belongs — their one page, or the guest home. */
export function guestLandingPath(scopePath: string | null) {
  return scopePath ?? GUEST_HOME;
}

// The pages a share link may point at. A link is only ever created from one
// of these pages, but the value arrives from a request body, so it is
// validated against this shape before being stored — otherwise a share link
// would be an open redirect into any path an admin could be tricked into
// posting.
const SHAREABLE_PATH = /^\/(functions(\/[a-z0-9-]+)?|reports\/(silai|events)(\/[a-z0-9-]+)?)$/;

export function isShareablePath(path: string) {
  return SHAREABLE_PATH.test(path);
}
