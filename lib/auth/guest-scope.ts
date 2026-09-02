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

/** Where a guest lands, and where they are sent back to when blocked. */
export const GUEST_HOME = "/functions";
