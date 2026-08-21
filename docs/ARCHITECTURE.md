# Architecture

This document covers the patterns that aren't obvious from reading a single file — why things are shaped the way they are, and what to copy when extending them. For setup instructions, see [README.md](../README.md).

## Stack

Next.js 15 (App Router) + React 19 + TypeScript, Supabase (Postgres, Auth, RLS), Zoho Books as the system of record for financial data, deployed on Vercel (auto-deploys from `main`). No ORM — Supabase's generated `Database` type (`types/database.ts`) plus `.select()`/`.returns<T>()` calls provide type safety.

## Reports: registry pattern

Every report is a `ReportDefinition` (`lib/reports/types.ts`):

```ts
type ReportDefinition<TProps> = {
  slug: string;
  category: "financial" | "silai" | "events";
  title: string;
  description: string;
  summary: string; // one-liner shown on the gallery card
  loader: (ctx: { supabase, searchParams }) => Promise<TProps>;
  Component: ComponentType<TProps>;
};
```

Definitions live in `lib/reports/definitions/<category>/<slug>.ts` and are collected into `REPORT_REGISTRY` (`lib/reports/registry.ts`). One generic route, `app/reports/[category]/[slug]/page.tsx`, handles every report:

1. Auth check (`requireAuthedSupabase()`) — always runs **before** the registry lookup, so an anonymous visitor gets the same redirect for a valid slug and a typo. Don't reorder this.
2. `getReport(category, slug)` → 404 via `notFound()` if missing.
3. `definition.loader({ supabase, searchParams })` fetches and shapes the data server-side.
4. `<Component {...data} />` — the loader's return value is spread as props, not passed as a single `data` object. This was a deliberate choice so existing report components (`SilaiFundReport`, `EventFundReport`, `MonthlyReport`, ...) didn't need their prop signatures changed when they joined the registry.

**Adding a new report**: write one file exporting a `ReportDefinition`, add it to the `REPORT_REGISTRY` array. Nothing in the routing layer changes. If it reuses an existing shape (see below), it's usually 20-30 lines.

### Two report shapes

- **All-time** (`lib/reports/all-time-fund.ts` + `components/silai-fund-report.tsx`): one running total per member, no year concept. Used by Silai Fund and Registration. `SilaiFundReport` takes optional `title`/`subtitle`/`fileSlug`/`printTarget` props (defaulting to the original Silai values) so it can be reused as-is rather than forked.
- **Year-based** (`lib/event-fund.ts` + `components/event-fund-report.tsx`): one row per (member, year), with a year `<select>`. Used by Ugadi, Varushabishegam, Marghazhi Poojai.

Picking the wrong one for a new report is an easy mistake — Registration was originally built year-based, then corrected, because registration is a one-time fee, not an annual contribution. **If the underlying activity happens once per member, use all-time. If it recurs every year, use year-based.**

### Shared query helpers

`lib/reports/shared-queries.ts` exposes `getAllCustomers(supabase)`, wrapped in `React.cache()` so multiple report loaders (or a loader + the dashboard) calling it within the same request share one Supabase round-trip instead of issuing duplicate queries.

### Id-then-name customer matching

Invoices/expenses reference a customer by `customer_id` when Zoho has one, but older or manually-entered records sometimes only have a `customer_name` string. The matching pattern used everywhere a report needs to join invoices back to a customer (`lib/event-fund.ts`, `lib/reports/all-time-fund.ts`, `app/dashboard/page.tsx` via `member-rows.ts`):

1. Bucket by `customer_id` first.
2. Only fall back to matching by `display_name` for records with **no** `customer_id` at all.

Never fall back to name-matching for a record that already has an id — a second customer sharing the same `display_name` would otherwise double-count an amount already attributed by id.

### URL-driven filters

Report filters (month/year dropdowns, "show all members" toggles) are seeded from the URL on the server and kept in sync with it on the client, so a specific view is bookmarkable/shareable:

- The loader reads `searchParams` (already threaded through by the generic report page) and validates the requested value against what's actually in the data (e.g. `pickInitialEventYear` in `lib/event-fund.ts`), returning `initialYear`/`initialMonth`/`initialShowAllMembers` as a prop.
- The component seeds its `useState` from that prop, so the very first client render matches the server-rendered HTML exactly (no hydration mismatch).
- On change, the component calls `useUrlParamSetter()` (`lib/reports/use-url-param.ts`), which does `history.replaceState` directly — **not** `router.push`/`router.replace`. All the data for every filter value is already on the client (loaders fetch the full dataset, filtering happens client-side), so going through Next's router would trigger a pointless server round-trip. The URL update is purely cosmetic/for sharing.

If a new report's loader ever needs to *refetch* on filter change (e.g. a filter that changes the SQL query, not just what's shown), don't reuse `useUrlParamSetter` — use real navigation (`router.push`) so the loader re-runs.

## Zoho sync

`lib/zoho/sync.ts`'s `runZohoBooksSync()` is the only writer of Zoho data into Supabase. It records a `sync_runs` row (`running` → `succeeded`/`failed`) and upserts customers/invoices/expenses/bills by their Zoho id (`onConflict`).

### Detail-fetch backfill pattern

Zoho's list endpoints omit some fields the app needs (invoice `item_name`, `subject`; bill `account_name`, `item_name`). Only the per-record **detail** endpoint returns them. Fetching detail for every record on every sync would blow through Zoho's rate limits, so:

1. Before syncing, load a map of "what we already have" for the field in question (`loadExistingInvoiceItemNames`, `loadExistingInvoiceSubjects`, `loadExistingBillDetails` in `lib/zoho/sync.ts`).
2. `fetchZohoInvoices`/`fetchZohoBills` (`lib/zoho/client.ts`) only call the detail endpoint for records missing the field.
3. The detail response is merged into the list-sourced record via a narrow `patch` object touching **only** the specific missing key (e.g. `item_name`, `subject`) — never spread the whole detail response over the list response. An earlier bug corrupted `total`/`balance` by doing a full merge; the fix was to patch just the field that was actually missing.
4. Records still missing the field after a sync (e.g. Zoho hasn't backfilled a line item yet) are retried indefinitely — only records that already have a non-null value are treated as "done" and skipped on future syncs.

If you add a new field that needs this treatment, follow the same shape: a `load...` map function, a call-site check for "missing", a narrow patch merge, and only cache "already have it" (not "already tried").

### Sync-failure notification

`lib/alerts.ts`'s `notifySyncFailure(message)` is called from the `catch` block in `runZohoBooksSync`. It's a no-op unless `SYNC_ALERT_WEBHOOK_URL` is set (Slack or Discord incoming webhook — the JSON payload includes both `text` and `content` keys so either platform picks it up). A broken webhook can never fail the sync itself; the POST is wrapped in its own `try/catch` with a 10s timeout.

## Auth & authorization

- Every page requires a logged-in Supabase session (`requireAuthedSupabase()` for reports; equivalent inline checks in `app/dashboard/page.tsx`, `app/records/page.tsx`). RLS grants `authenticated` full read access, so pages use the session-scoped client, not the service-role client — least privilege.
- **Admin** is an `app_metadata.is_admin` flag on the Supabase auth user, not a database table — `app_metadata` can only be set server-side (via the Supabase SQL editor or admin API), so a user can never self-elevate. It gates bulk delete and Zoho resync in `app/api/records/[table]/route.ts`. Granting it is documented in the README.
- Every write through the Records API (edit, delete, resync) is logged to `audit_log` (actor email, action, table, record ids, detail) via `logAudit()` in the same route file. Read-only currently — no UI queries it yet, but the Supabase table editor works for ad-hoc review.

## Rate limiting

`lib/rate-limit.ts` is a best-effort, in-memory, per-instance limiter (`checkRateLimit(key, {max, windowMs})`), keyed by client IP + route. It does **not** guarantee a hard global cap — a serverless deployment can run multiple warm instances, each with its own counter — but it stops the realistic threat for an internal tool (a stuck retry loop, repeated button-mashing) rather than distributed abuse. If this app ever needs a real hard limit, swap the in-memory `Map` for a shared store (Redis, Supabase table with a TTL) behind the same `checkRateLimit` signature; call sites don't need to change.

Applied to: `PATCH`/`DELETE`/`POST` on `/api/records/[table]` (90/20/10 per minute respectively), and `/api/jobs/zoho-sync` (5 per 5 minutes — a full sync makes many outbound Zoho calls and can run for minutes, so this is the tightest limit in the app).

## Records tables

`components/editable-data-table.tsx` loads a full table's rows in one query (no server-side pagination — filtering/sorting is instant and client-side, which matters more at this app's scale than avoiding one larger initial fetch). It paginates client-side after filtering/sorting (`PAGE_SIZE = 50` in `editable-data-table.tsx`) purely to cap how many `<tr>`s are in the DOM at once; the "select all visible" checkbox and Prev/Next controls operate on the current page, but `selectedIds` persists across page changes so a bulk delete/resync can span multiple pages.

## Print/export

Every report has its own `ExportToolbar` (CSV, HTML, PDF-via-print, PNG-via-`html-to-image`) — see `lib/export.ts`. Print-to-PDF calls `printReportSection(target)`, which sets `data-print-target` on `<body>` before `window.print()`. Since each report now lives on its own page (one `<ReportShell>` = one `.report-card` in the DOM, ever), the print CSS in `app/globals.css` no longer needs the old per-slug allowlist — it just style-resets `.report-card` unconditionally under `@media print`. `data-print-target` is still set by `printReportSection` but nothing reads it anymore; harmless to leave as-is, not worth touching the ~10 call sites to remove it.
