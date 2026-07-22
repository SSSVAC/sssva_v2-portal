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

## Admin access

Every logged-in staff account can view and edit records. Bulk delete and Zoho resync are restricted to admins, controlled by an `is_admin` flag on the Supabase auth user (not a database table, so it can't be self-granted from the app). Grant it by running the following in the Supabase SQL editor:

```sql
update auth.users
set raw_app_meta_data = raw_app_meta_data || '{"is_admin": true}'::jsonb
where email = 'staff@example.com';
```

Every write made through the Records API (edits, bulk deletes, resyncs) is logged to the `audit_log` table with the acting user's email, so it doubles as a history you can review from the Supabase table editor.
