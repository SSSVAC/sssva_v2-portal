# SSSVA Portal V2

Temple finance and function-planning portal. Next.js 15 (App Router) + React 19 + TypeScript, Supabase (Postgres/Auth/RLS), Zoho Books as the system of record for financial data, deployed on Vercel (auto-deploys from `main`). No ORM; `types/database.ts` types the Supabase client.

Read before non-trivial work: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (why things are shaped as they are) and [README.md](README.md) (setup, admin, guest access).

## Commands

```bash
npm run dev        # next dev on :3000 (4GB heap; also available as the "dev" launch config)
npm run build      # production build — run before declaring UI/route work done
npm run lint       # next lint
npm test           # vitest run (node env, "@" alias = repo root)
npx tsc --noEmit   # typecheck
```

Env vars: copy `.env.example` to `.env.local`. Schema is `supabase/schema.sql`; `seed-functions.sql` and `update-*.sql` are one-off scripts run by hand in the Supabase SQL editor (never auto-applied).

## Layout

- `app/` — routes. `app/api/*` for mutations/jobs; `app/reports/[category]/[slug]` is the single generic report page.
- `lib/reports/` — report registry (`registry.ts`) + definitions per category. New report = one `ReportDefinition` file + a registry entry.
- `lib/functions/` — function-tracker queries, types, export. `lib/zoho/` — the only writer of Zoho data. `lib/auth/` — viewer resolution and guest scope.
- `components/` — `shell/` (AppShell, sidebar), `ui/` (Section, ExportMenu, EditableCell), feature folders.
- `app/globals.css` — single source of truth for design tokens and shared classes.

## Rules that are easy to break

- **Auth order**: pages call `requireViewer()`/`requireStaffViewer()`/`requireAdminViewer()` first, before any lookup (so valid slug and typo behave alike). Don't reorder.
- **Guests bypass RLS** (service-role client). `lib/auth/guest-scope.ts` is the only gate; anything added to it exposes data. Share-link paths match exactly, not by prefix, and `scope_path` is validated on write *and* read. Every mutation route must reject guests with 403.
- **Admin** is `app_metadata.is_admin`, never a table.
- **Customer matching**: bucket by `customer_id` first; name-match only records with no id.
- **Zoho detail backfill**: patch only the missing field from detail responses; never spread a detail response over a list record. Bill payments: leave `payments` off cache-merged bills.
- **Function trackers**: `qty` stays text; empty string saves as `null`, not 0; coverage logic lives only in `totalsFor()`.
- **Design**: brand (saffron) = interactive only; semantic hues = value state only; category hues fixed in `CATEGORY_ACCENT`. Components read role tokens, never ramp steps. One `<h1>` per page, owned by `PageHeader`.
- **Print/export**: new controls need `.no-print`; mobile CSS must be `screen`-scoped; `Section`'s sibling-body structure and `report-section` class are load-bearing.
- Report filters: client-side filtering uses `useUrlParamSetter` (replaceState); filters that change the SQL need real navigation.

## Conventions

- Match existing style; TypeScript strict; validate request bodies with zod; allowlist writable columns.
- Add a vitest next to the code (`*.test.ts`) for auth, sync and parsing logic — those are the areas already tested.
- Update `docs/ARCHITECTURE.md` when you add a pattern someone would otherwise re-derive.
- Never commit `.env*`, logs, `.next`, or `.claude/`. Don't run SQL or Zoho syncs against production without being asked.
- Commit messages: short imperative, describing the user-visible change (see `git log`).
