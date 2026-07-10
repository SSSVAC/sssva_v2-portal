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

On Vercel, configure a cron job for `/api/jobs/zoho-sync` and add the same `SYNC_JOB_SECRET` as an environment variable.
