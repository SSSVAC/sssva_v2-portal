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

1. Auth check (`requireViewer()`) — always runs **before** the registry lookup, so an anonymous visitor gets the same redirect for a valid slug and a typo. Don't reorder this. The guest scope check comes straight after it, and 404s rather than redirects (see Guest access).
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

### Bill payments

`zoho_bill_payments` holds one row per payment applied to one bill. A single vendor payment can be split across several bills, which Zoho returns as one entry per bill sharing a `payment_id` but with distinct `bill_payment_id`s — so the stable key is that per-bill application (`payment_key`), not the payment.

The refetch rule is the useful part. Payments only appear in the per-bill **detail** response, and re-fetching every bill on every sync would waste Zoho's quota, so `needsPaymentBackfill()` in `lib/zoho/client.ts` compares `total - balance` from the cheap list call against the sum of payments already stored. They diverge exactly when a payment has been added or removed in Zoho, so a bill costs one detail call per change and nothing otherwise — and it self-heals rather than needing a manual backfill flag.

`mergeBillDetail` deliberately leaves `payments` **off** the bills it returns from cache. Its absence is what tells the sync "this bill wasn't re-fetched, leave its stored payments alone"; an empty array would read as "Zoho says there are none" and wipe them. For bills that *were* re-fetched, the sync deletes and reinserts their payment rows, so a payment deleted in Zoho disappears here too.

### Sync-failure notification

`lib/alerts.ts`'s `notifySyncFailure(message)` is called from the `catch` block in `runZohoBooksSync`. It's a no-op unless `SYNC_ALERT_WEBHOOK_URL` is set (Slack or Discord incoming webhook — the JSON payload includes both `text` and `content` keys so either platform picks it up). A broken webhook can never fail the sync itself; the POST is wrapped in its own `try/catch` with a 10s timeout.

## Design system

`app/globals.css` is the single source of truth for colour, type and the shared UI classes. It is organised in numbered sections (tokens → base → shell → primitives → blocks → feature surfaces → feedback → responsive → print); add rules to the section they belong to rather than the end of the file.

**Three rules the palette depends on. Breaking any of them is what made the previous design unreadable:**

1. **The brand hue (saffron) means "interactive / you are here" and never carries status.** Buttons, links, active nav, focus rings.
2. **Semantic hues (`--success`/`--warning`/`--danger`) mean the state of a value and are never decorative.** A stat tile is neutral unless its value genuinely has a state — pass `data-state="critical|warning|positive"` on `.metric-card` for that, and `data-emphasis="lead"` on the one figure the page exists to show. The old design rotated four accent colours across stat tiles by `nth-child` position, so a tile's colour depended on where it sat in the grid, and it collided with the real status colours used in the same row.
3. **Category hues are fixed per report family** (`CATEGORY_ACCENT` in `lib/nav.ts`), never positional. They appear as the sidebar dot, the gallery-card left edge, and the `.cat-chip`.

Never read a ramp step (`--n-400`, `--brand-600`) from a component. Read a role token (`--text-muted`, `--brand`); only the role block is redefined for the dark theme, so a component that reaches past it will be wrong in dark mode. Dark mode follows `prefers-color-scheme` with a manual override in `data-theme` on `<html>`, written by `components/shell/theme-toggle.tsx` and applied before first paint by `THEME_INIT_SCRIPT` in `app/layout.tsx`.

The uppercase-micro label treatment (`.eyebrow`, `.metric-head`, `.data-table th`) is deliberately scarce. If it spreads to other elements the hierarchy stops working, because nothing reads as a quiet label any more.

### Page composition

Every signed-in page is `<AppShell>` (persistent sidebar + appbar + width-capped content) wrapping one `<PageHeader>` and a `.stack` of blocks. The sidebar lists the whole tree — Overview, four record tables, all 11 reports under their families — and highlights the current route via `usePathname()`. It must never hide the current page's own link, which is what the previous topbar did.

**Exactly one `<h1>` per page, and it belongs to `PageHeader`.** `ReportShell` renders it for report pages; it used to emit an `<h2>` inside a card with no `<h1>` anywhere on the page.

Heading levels map to containers: `h1` = `PageHeader`, `h2` = `SectionGroup` (a band of related sections, e.g. one section per street), `h3` = `Section`.

### `<Section>` — the one content container

`components/ui/section.tsx`. A card whose header carries the title, a count, and **that section's own controls** — normally a single `<ExportMenu>`. Report pages used to stack up to six five-button `ExportToolbar` rows *above* bare headings, so roughly thirty identical buttons sat between the reader and the data with nothing to say which exported what.

Three things about `Section` are load-bearing and should not be "simplified":

- The class name `report-section` on the `<details>` — `exportSectionToImage` in `lib/export.ts` force-opens `details.report-section:not([open])` before rasterising.
- The body is a **sibling** of `<details>`, not a child. Chromium renders a closed `<details>`'s children through an internal `::details-content` box whose `content-visibility` an author rule on a descendant cannot override; nesting the body there renders every section as a title with nothing under it.
- Desktop ignores open/closed entirely — only the `<=960px` rule hides a body (via `.section:has(.report-section[open])`), so collapsing needs no JavaScript and no hydration-sensitive state.

Report filters go in one `<ReportToolbar>` directly under the page header, not in ad-hoc banners between sections.

## Function arrangements

`/functions` is a three-table module: `event_functions` → `function_sections` → `function_items` (see `supabase/schema.sql`). One shape covers every planning sheet the temple keeps, because the differences between them are presentational:

- **`kind = 'items'`** — a requirements list: item, quantity, expected ₹, actual ₹, ubhayam.
- **`kind = 'menu'`** — an Annathanam session. Costs are settled per session, not per menu line, so `vendor` / `estimate_amount` / `advance_paid` / `balance_paid` live on the **section**, not on its items.
- **`kind = 'schedule'`** — an agenda: `time_label` plus the event name, no costs.

`qty` is text, not numeric, and must stay that way: the source lists read "2 ஜோடி", "அரை கிலோ", "சின்ன மூட்டை", "கலசத்திற்கு 250 கிராம் வீதம்".

**Coverage** is the number the trackers exist to show. A line counts as covered if it has its own sponsor **or** the whole section does — the Kumbabhishekam sheet uses both, and a section-wide ubhayam means nobody needs to claim its lines individually. That rule lives once, in `totalsFor()` in `lib/functions/queries.ts`; both the list page and the detail page derive their numbers from it.

`supabase/seed-functions.sql` is generated from the two source `.docx` files, not hand-written. If those documents change, regenerate rather than editing the SQL. Note that Word wrapped five of the six Annathanam cost tables in `<w:sdt>` content controls, so a parser that walks only the body's direct children silently drops them.

### Editing

Cells save on Enter or blur through `PATCH /api/functions/[entity]`, which takes an entity (`functions` / `sections` / `items`), a column and a value. Columns are allowlisted per entity with a text-or-numeric coercion, so ids, `order_no` and timestamps can't be written through it. An empty string clears a field to `null` rather than writing `0` — a blank quantity and a quantity of zero are different facts, and the source sheets are full of blanks that must stay blank.

`components/ui/editable-cell.tsx` is the click-to-edit primitive: it takes an `onSave` callback rather than knowing about any endpoint. Records still has its own copy of the same interaction inside `editable-data-table.tsx`; converging the two is worth doing, but wasn't done in the change that introduced this.

### Exporting a tracker

`lib/functions/export.ts` builds the export rows, and it branches on the section's `kind` for the same reason the UI does: exporting a menu with the requirements columns would emit empty Expected/Actual columns, and an agenda would gain a Qty column it never had. Section-level settlement fields (vendor, estimate, advance) export as their own small block, because they belong to the session rather than to any one line.

Both the page header and each section header carry an export menu, wired to the same `printId` scoping described under Print/export.

## Guest access

A guest is **not** a Supabase account. `guest_passes` holds a label, an expiry, and a SHA-256 of a generated code — never the code itself. Plain SHA-256 is right here rather than bcrypt: codes carry ~60 bits of entropy because they are generated rather than chosen, so there is nothing to grind offline, and the lookup has to be one indexed equality check instead of a scan with a slow hash over every row.

Signing in sets a signed cookie of `<passId>.<expiryMs>.<hmac>` (`lib/auth/guest-pass.ts`). It is signed, not encrypted — it holds no secret; the signature is what stops a visitor editing the pass id or pushing the expiry out. With no `GUEST_SESSION_SECRET` configured the whole feature **fails closed**: `guestSessionsEnabled()` returns false, no token can be minted, and the login page doesn't offer the option. `lib/auth/guest-pass.test.ts` covers tampering, expiry, wrong secret and the missing-secret case.

`getViewer()` (`lib/auth/viewer.ts`) resolves either viewer and is the only place that reads the cookie. **A guest pass is re-checked against the database on every request**, not just at sign-in, so revoking a pass or its expiry passing takes effect immediately.

**The thing to be careful about**: a guest has no JWT, so RLS cannot authorise their reads. Their queries run through the service-role client, which bypasses RLS entirely. `lib/auth/guest-scope.ts` is therefore the single source of truth for what a guest may reach, and it is enforced by the *pages*, never by the database. Anything you add to that allowlist must be reviewed for what it exposes — Records and the financial reports are deliberately excluded because they carry customer emails, phone numbers and billing addresses. Off-limits report families 404 rather than redirect, so a guest can't tell one apart from a family that doesn't exist.

### Share links

A share link is the same `guest_passes` row with `scope_path` set, so revocation, expiry, last-used and the admin screen all work unchanged. `scope_path` null is a code covering the whole guest area — every pass issued before this feature — so the two coexist without a migration of existing rows.

`guestCanAccessPath()` matches **exactly**, not by prefix. Prefix matching would quietly widen a link: sharing `/reports/silai` would also share every report inside it, which is not what the person picking the narrower page meant. Guest-reachable pages call `requireViewerForPath()` with their own path; a scoped guest who wanders off it is redirected back to their page rather than 404'd, so a stale bookmark lands somewhere useful.

**A stored `scope_path` becomes a redirect target in `/s/[code]`**, so it is validated by `isShareablePath()` both when written and again when read. Validating only on write would leave the redirect trusting whatever is in the row. `lib/auth/guest-pass.test.ts` covers the refusals — other report families, staff pages, `//host` and absolute URLs.

`getViewer()` reads the pass with `select("*")` rather than naming `scope_path`. Naming it would make the query, and therefore **every existing guest session**, fail outright on a deployment where the migration hasn't run yet; with `*` the column is simply absent and the pass falls back to unscoped.

Writes are staff-only everywhere: `/api/functions/[entity]` and `/api/guest-passes` both reject a guest with a 403 before touching anything, and `requireStaffViewer()` bounces them out of staff pages to `/functions` rather than to the login page — they are signed in, just not to that.

## Auth & authorization

- Every page resolves a viewer through `lib/auth/viewer.ts`: `requireStaffViewer()` for staff-only pages, `requireAdminViewer()` for admin ones, `requireViewer()` for the pages guests may reach. Each returns the Supabase client alongside the user and admin flag, because the shell needs the email and role on every render and calling `getUser()` a second time would double the auth round-trip. For staff, RLS grants `authenticated` full read access, so pages use the session-scoped client, not the service-role client — least privilege.
- `AppShell` takes a `ViewerChrome`, not a `Viewer`: a `Viewer` carries a Supabase client, which can't cross the server/client boundary. Use `viewerChrome(viewer)` at the page.
- **Admin** is an `app_metadata.is_admin` flag on the Supabase auth user, not a database table — `app_metadata` can only be set server-side (via the Supabase SQL editor or admin API), so a user can never self-elevate. It gates bulk delete and Zoho resync in `app/api/records/[table]/route.ts`. Granting it is documented in the README.
- Every write through the Records API (edit, delete, resync) is logged to `audit_log` (actor email, action, table, record ids, detail) via `logAudit()` in the same route file. Read-only currently — no UI queries it yet, but the Supabase table editor works for ad-hoc review.

## Rate limiting

`lib/rate-limit.ts` is a best-effort, in-memory, per-instance limiter (`checkRateLimit(key, {max, windowMs})`), keyed by client IP + route. It does **not** guarantee a hard global cap — a serverless deployment can run multiple warm instances, each with its own counter — but it stops the realistic threat for an internal tool (a stuck retry loop, repeated button-mashing) rather than distributed abuse. If this app ever needs a real hard limit, swap the in-memory `Map` for a shared store (Redis, Supabase table with a TTL) behind the same `checkRateLimit` signature; call sites don't need to change.

Applied to: `PATCH`/`DELETE`/`POST` on `/api/records/[table]` (90/20/10 per minute respectively), and `/api/jobs/zoho-sync` (5 per 5 minutes — a full sync makes many outbound Zoho calls and can run for minutes, so this is the tightest limit in the app).

## Records tables

`components/editable-data-table.tsx` loads a full table's rows in one query (no server-side pagination — filtering/sorting is instant and client-side, which matters more at this app's scale than avoiding one larger initial fetch). It paginates client-side after filtering/sorting (`PAGE_SIZE = 50` in `editable-data-table.tsx`) purely to cap how many `<tr>`s are in the DOM at once; the "select all visible" checkbox and Prev/Next controls operate on the current page, but `selectedIds` persists across page changes so a bulk delete/resync can span multiple pages.

The table renders as a `Section` with a search box and a **Filters** toggle in its header. Search matches across every visible column (the common task is "find this customer", which previously meant knowing which column to type into); the per-column filter row is opt-in, because it used to occupy a second dense header row on every table before a single record was visible. Bulk actions appear in a floating `.selection-bar` only once rows are selected, rather than a permanently visible bar reading "0 selected" with two disabled buttons.

## Print/export

`lib/export.ts` provides CSV, Excel, HTML, PDF-via-print and PNG-via-`html-to-image`, surfaced through one `<ExportMenu>` per section plus a whole-report menu in the `ReportToolbar`.

- **PDF**: `printReportSection(target)` marks the element carrying `data-print-id="target"` with `data-printing`, sets `data-print-scoped` on `<body>`, and calls `window.print()`. The scoping rules at the end of the `@media print` block then hide, inside each container that can hold a printable block, every child that is neither the target nor an ancestor of it. So a section's export menu prints that section and the page-level menu prints the whole report — before this, every menu on the page printed the entire report.

  The container half of that selector ends in `:has([data-printing])`, and it is load-bearing. On a whole-report print the target is the outer wrapper, so no container *inside* it holds the marker and nothing is hidden. Drop it and every container below the target would also filter its children, leaving the report printing as just its header. Pass a `printId` to `<Section>` or `<SectionGroup>` to make it addressable.

- **Print palette**: the print block redefines the role tokens to a light palette rather than setting `#000`/`#fff` per rule. Its selector list must include `:root:not([data-theme="light"])`, not just `:root` — the dark theme is applied through that selector inside a `prefers-color-scheme` query, so a bare `:root` override loses on specificity and a viewer on system dark prints every rule and cell edge in the dark theme's near-black. **Print media does not beat specificity**: the same trap catches `.data-table .cell-*::before`, where a single-class print rule loses to the two-class rule that draws the status dot.
- **PNG**: `exportSectionToImage(target, filename)` rasterises `[data-print-id="…"]`, which `ReportShell` puts around the page header *and* the body so the image carries the report's title. Everything marked `.no-print` is filtered out — so any new control must carry that class or it will appear in exported images.
- Both the mobile breakpoints and the collapsible-section rules are `screen`-scoped. A4 portrait is narrower than 960px, so an unscoped mobile rule silently breaks every printed and exported report.
