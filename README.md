# SSSVA Portal V2

A Next.js app using Supabase Auth, Supabase PostgreSQL, Recharts, and a secure Vercel-compatible Zoho Books synchronization endpoint.

## Setup

1. Copy `.env.example` to `.env.local` and fill in the values.
2. Run the SQL in `supabase/schema.sql` in your Supabase SQL editor.
3. Install dependencies with `npm install`.
4. Start locally with `npm run dev`.

## Zoho Sync

The sync endpoint is server-only:

```txt
POST /api/jobs/zoho-sync
Authorization: Bearer $SYNC_JOB_SECRET
```

Sync is triggered manually (e.g. the "Sync now" action on the dashboard, or a direct call to the endpoint above) rather than on a schedule. Set `SYNC_JOB_SECRET` as an environment variable for non-interactive calls.

To get notified when a sync fails, set `SYNC_ALERT_WEBHOOK_URL` to a Slack or Discord incoming-webhook URL. Leave it unset to disable notifications (this is the default — nothing changes if you don't configure it).

## Admin access

Every logged-in staff account can view and edit records. Bulk delete and Zoho resync are restricted to admins, controlled by an `is_admin` flag on the Supabase auth user (not a database table, so it can't be self-granted from the app). Grant it by running the following in the Supabase SQL editor:

```sql
update auth.users
set raw_app_meta_data = raw_app_meta_data || '{"is_admin": true}'::jsonb
where email = 'staff@example.com';
```

Every write made through the Records API (edits, bulk deletes, resyncs) is logged to the `audit_log` table with the acting user's email, so it doubles as a history you can review from the Supabase table editor.

## Function arrangements

`/functions` tracks what each temple function needs, who has committed to it, and what it actually cost. A function holds ordered sections; a section holds ordered line items. The section's type decides which columns appear — a requirements list, a menu with its own vendor/estimate/settlement block, or a printed agenda — so the same three tables cover every planning sheet the temple keeps.

Load the two existing plans (Maha Kumbabhishekam 2026 and the Annathanam food order) by running `supabase/seed-functions.sql` in the Supabase SQL editor after `supabase/schema.sql`. It deletes and reinserts those two functions by slug, so run it once at setup — re-running discards any edits made in the app for them.

### Bill payments

Zoho settles a bill through any number of separate payments, and its bill *list* endpoint reports only the net balance. The individual payments come from the per-bill detail endpoint and are stored in `zoho_bill_payments`, so every Bills table can show a breakdown behind **Show payment details**.

A bill is re-fetched from Zoho exactly when the payments recorded here stop adding up to `total - balance`, so a newly paid bill costs one detail call and an unchanged one costs none. Run a Zoho sync after applying the schema to pull the existing payments in; until then the toggle is disabled and says so.

## Guest access

Staff sign in with email and password. Anyone else can be given a **guest pass**: a shared code, valid until a date you choose, that grants read-only access to the function trackers and the Silai and Event reports. Records, the dashboard and the financial reports stay staff-only.

1. Set `GUEST_SESSION_SECRET` to any random string of 16 characters or more. Guest sign-in stays disabled until you do.
2. As an admin, open **Guest access** in the sidebar, give the pass a label ("Kalluri Salai contributors") and an expiry date, and create it.
3. The code is shown **once** — copy it then. Codes are stored hashed, so a lost code can't be recovered, only replaced with **New code**, which invalidates the old one immediately.

Every request re-checks the pass against the database, so revoking one or letting it expire takes effect straight away rather than when a cookie happens to lapse. Guests can't write anything: every mutation route rejects them with a 403.
