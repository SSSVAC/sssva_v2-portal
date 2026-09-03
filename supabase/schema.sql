create extension if not exists pgcrypto;

create table if not exists public.zoho_customers (
  id uuid primary key default gen_random_uuid(),
  zoho_customer_id text not null unique,
  display_name text not null,
  company_name text,
  email text,
  phone text,
  billing_address text,
  is_active boolean not null default true,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.zoho_invoices (
  id uuid primary key default gen_random_uuid(),
  zoho_invoice_id text not null unique,
  customer_id text,
  customer_name text,
  invoice_number text,
  status text not null,
  date date,
  due_date date,
  total numeric(14, 2) not null default 0,
  balance numeric(14, 2) not null default 0,
  currency_code text,
  item_name text,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.zoho_invoices
add column if not exists item_name text;

-- Zoho's invoice "subject" field, used to record what was donated on a
-- zero-total invoice (a direct/non-cash ubhayam) — populated by the same
-- detail-fetch backfill pattern as item_name, but only for total = 0
-- invoices, so it doesn't cost a detail call for every ordinary invoice.
alter table public.zoho_invoices
add column if not exists subject text;

alter table public.zoho_customers
add column if not exists is_member boolean not null default false;

alter table public.zoho_customers
add column if not exists collected_by text;

-- Local-only fields, not sourced from Zoho: ownership type, an
-- admin-defined group (dropdown values come from whatever's already in use
-- across customers; no group left ungrouped is treated as "Others" in the
-- UI rather than stored as a literal value), and a manual display order.
alter table public.zoho_customers
add column if not exists ownership text;

alter table public.zoho_customers
add column if not exists customer_group text;

alter table public.zoho_customers
add column if not exists order_number integer;

create table if not exists public.zoho_expenses (
  id uuid primary key default gen_random_uuid(),
  zoho_expense_id text not null unique,
  vendor_name text,
  expense_number text,
  status text not null,
  date date,
  due_date date,
  total numeric(14, 2) not null default 0,
  balance numeric(14, 2) not null default 0,
  currency_code text,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.zoho_expenses
add column if not exists account_name text;

alter table public.zoho_expenses
add column if not exists paid_through_account_name text;

alter table public.zoho_expenses
add column if not exists description text;

create table if not exists public.zoho_bills (
  id uuid primary key default gen_random_uuid(),
  zoho_bill_id text not null unique,
  vendor_name text,
  bill_number text,
  status text not null,
  date date,
  due_date date,
  total numeric(14, 2) not null default 0,
  balance numeric(14, 2) not null default 0,
  currency_code text,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.zoho_bills
add column if not exists account_name text;

alter table public.zoho_bills
add column if not exists item_name text;

-- Soft-delete marker: set by the sync job when a record that used to
-- exist in a full Zoho fetch no longer appears in it (deleted in Zoho),
-- and cleared again if it later reappears. The app filters every
-- archived_at is null everywhere — an archived row is fully hidden
-- rather than kept in historical totals, but the row itself (and its
-- history) is preserved rather than hard-deleted, so it isn't lost to a
-- mistaken deletion in Zoho.
alter table public.zoho_customers
add column if not exists archived_at timestamptz;

alter table public.zoho_invoices
add column if not exists archived_at timestamptz;

alter table public.zoho_expenses
add column if not exists archived_at timestamptz;

alter table public.zoho_bills
add column if not exists archived_at timestamptz;

create index if not exists idx_zoho_customers_archived_at on public.zoho_customers (archived_at);
create index if not exists idx_zoho_invoices_archived_at on public.zoho_invoices (archived_at);
create index if not exists idx_zoho_expenses_archived_at on public.zoho_expenses (archived_at);
create index if not exists idx_zoho_bills_archived_at on public.zoho_bills (archived_at);

create table if not exists public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  status text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  records_upserted integer not null default 0,
  error text
);

alter table public.sync_runs
add column if not exists records_archived integer not null default 0;

-- Persisted trail of who performed destructive/write actions (record edits,
-- bulk deletes, Zoho resyncs) through the app's API routes, since these
-- tables hold financial data and previously had no audit history at all.
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_email text,
  action text not null,
  table_name text not null,
  record_ids text[] not null default '{}',
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_zoho_customers_updated_at on public.zoho_customers;
create trigger set_zoho_customers_updated_at
before update on public.zoho_customers
for each row execute function public.set_updated_at();

drop trigger if exists set_zoho_invoices_updated_at on public.zoho_invoices;
create trigger set_zoho_invoices_updated_at
before update on public.zoho_invoices
for each row execute function public.set_updated_at();

drop trigger if exists set_zoho_expenses_updated_at on public.zoho_expenses;
create trigger set_zoho_expenses_updated_at
before update on public.zoho_expenses
for each row execute function public.set_updated_at();

drop trigger if exists set_zoho_bills_updated_at on public.zoho_bills;
create trigger set_zoho_bills_updated_at
before update on public.zoho_bills
for each row execute function public.set_updated_at();

create or replace view public.dashboard_monthly_revenue as
select
  to_char(date_trunc('month', date), 'YYYY-MM') as month,
  sum(total)::numeric(14, 2) as revenue
from public.zoho_invoices
where date is not null
  and archived_at is null
group by date_trunc('month', date)
order by date_trunc('month', date);

alter table public.zoho_customers enable row level security;
alter table public.zoho_invoices enable row level security;
alter table public.zoho_expenses enable row level security;
alter table public.zoho_bills enable row level security;
alter table public.sync_runs enable row level security;
alter table public.audit_log enable row level security;

drop policy if exists "Authenticated users can read audit log" on public.audit_log;
create policy "Authenticated users can read audit log"
on public.audit_log for select
to authenticated
using (true);

drop policy if exists "Authenticated users can read customers" on public.zoho_customers;
create policy "Authenticated users can read customers"
on public.zoho_customers for select
to authenticated
using (true);

drop policy if exists "Authenticated users can read invoices" on public.zoho_invoices;
create policy "Authenticated users can read invoices"
on public.zoho_invoices for select
to authenticated
using (true);

drop policy if exists "Authenticated users can read sync runs" on public.sync_runs;
create policy "Authenticated users can read sync runs"
on public.sync_runs for select
to authenticated
using (true);

drop policy if exists "Authenticated users can read expenses" on public.zoho_expenses;
create policy "Authenticated users can read expenses"
on public.zoho_expenses for select
to authenticated
using (true);

drop policy if exists "Authenticated users can read bills" on public.zoho_bills;
create policy "Authenticated users can read bills"
on public.zoho_bills for select
to authenticated
using (true);

create index if not exists zoho_invoices_date_idx on public.zoho_invoices (date desc);
create index if not exists zoho_invoices_status_idx on public.zoho_invoices (status);
create index if not exists zoho_expenses_date_idx on public.zoho_expenses (date desc);
create index if not exists zoho_expenses_status_idx on public.zoho_expenses (status);
create index if not exists zoho_bills_date_idx on public.zoho_bills (date desc);
create index if not exists zoho_bills_status_idx on public.zoho_bills (status);
create index if not exists sync_runs_provider_started_idx on public.sync_runs (provider, started_at desc);
create index if not exists audit_log_created_at_idx on public.audit_log (created_at desc);

-- =====================================================================
-- Function arrangements
--
-- One shape covers every kind of temple event planning sheet: a function
-- holds ordered sections, each section holds ordered line items. A
-- section's `kind` decides which columns the UI renders, so a Kumbabhishekam
-- requirement list, an Annathanam menu with its own vendor/estimate block,
-- and a printed agenda are all the same three tables.
-- =====================================================================

create table if not exists public.event_functions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  subtitle text,
  description text,
  starts_on date,
  ends_on date,
  -- planning | active | completed | archived
  status text not null default 'planning',
  order_no integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.function_sections (
  id uuid primary key default gen_random_uuid(),
  function_id uuid not null references public.event_functions (id) on delete cascade,
  order_no integer not null default 0,
  -- The numbering used in the source document ("4.1", "10.2"), kept so a
  -- printed sheet and the tracker can be read side by side.
  code text,
  title text not null,
  subtitle text,
  -- items | menu | schedule
  kind text not null default 'items',
  -- Whole-section ubhayam ("இந்தப் பிரிவு முழுவதும் உபயம்").
  sponsor text,
  -- Annathanam sessions settle costs per session, not per menu line, so
  -- these four live on the section rather than on its items.
  vendor text,
  estimate_amount numeric(14, 2),
  advance_paid numeric(14, 2),
  balance_paid numeric(14, 2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.function_items (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.function_sections (id) on delete cascade,
  order_no integer not null default 0,
  name text not null,
  -- Free text, not numeric: the source lists read "2 ஜோடி", "அரை கிலோ",
  -- "சின்ன மூட்டை", "கலசத்திற்கு 250 கிராம் வீதம்".
  qty text,
  unit text,
  -- Only used by kind = 'schedule' rows.
  time_label text,
  expected_amount numeric(14, 2),
  actual_amount numeric(14, 2),
  sponsor text,
  -- pending | committed | purchased | done
  status text not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- Guest passes
--
-- Read-only access for people outside the committee. A pass is a shared
-- code with a label and a hard expiry; it is NOT a Supabase account, so a
-- guest request has no JWT and its reads run through the service-role
-- client on the server, gated by the allowlist in lib/auth/guest-scope.ts.
--
-- The code itself is never stored. `code_hash` is a plain SHA-256 of the
-- code, which is appropriate here because codes are generated with ~60
-- bits of entropy rather than chosen by a person — there is nothing to
-- brute-force offline. `code_hint` keeps the last four characters so a
-- pass stays identifiable in the admin list after the code is shown once.
-- =====================================================================

create table if not exists public.guest_passes (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  code_hash text not null unique,
  code_hint text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by text,
  last_used_at timestamptz,
  use_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_event_functions_updated_at on public.event_functions;
create trigger set_event_functions_updated_at
before update on public.event_functions
for each row execute function public.set_updated_at();

drop trigger if exists set_function_sections_updated_at on public.function_sections;
create trigger set_function_sections_updated_at
before update on public.function_sections
for each row execute function public.set_updated_at();

drop trigger if exists set_function_items_updated_at on public.function_items;
create trigger set_function_items_updated_at
before update on public.function_items
for each row execute function public.set_updated_at();

drop trigger if exists set_guest_passes_updated_at on public.guest_passes;
create trigger set_guest_passes_updated_at
before update on public.guest_passes
for each row execute function public.set_updated_at();

alter table public.event_functions enable row level security;
alter table public.function_sections enable row level security;
alter table public.function_items enable row level security;
alter table public.guest_passes enable row level security;

drop policy if exists "Authenticated users can read functions" on public.event_functions;
create policy "Authenticated users can read functions"
on public.event_functions for select
to authenticated
using (true);

drop policy if exists "Authenticated users can read function sections" on public.function_sections;
create policy "Authenticated users can read function sections"
on public.function_sections for select
to authenticated
using (true);

drop policy if exists "Authenticated users can read function items" on public.function_items;
create policy "Authenticated users can read function items"
on public.function_items for select
to authenticated
using (true);

-- Staff can see which passes exist and when they expire, but the codes are
-- not stored, so reading this table never leaks access.
drop policy if exists "Authenticated users can read guest passes" on public.guest_passes;
create policy "Authenticated users can read guest passes"
on public.guest_passes for select
to authenticated
using (true);

create index if not exists function_sections_function_idx
  on public.function_sections (function_id, order_no);
create index if not exists function_items_section_idx
  on public.function_items (section_id, order_no);
create index if not exists guest_passes_code_hash_idx
  on public.guest_passes (code_hash);

-- =====================================================================
-- Bill payments
--
-- One row per payment applied to a bill. Zoho's bill LIST endpoint gives
-- only total and balance; the individual payments come from the per-bill
-- DETAIL endpoint's `payments[]` array, so these are populated by the same
-- detail-fetch backfill that fills account_name/item_name.
--
-- A single vendor payment can be split across several bills, which Zoho
-- returns as one entry per bill with a shared payment_id and a distinct
-- bill_payment_id. payment_key is that per-bill application: the
-- bill_payment_id when Zoho supplies one, otherwise bill id + payment id.
-- Keying on it means a payment split across two bills stays two rows.
-- =====================================================================

create table if not exists public.zoho_bill_payments (
  id uuid primary key default gen_random_uuid(),
  payment_key text not null unique,
  zoho_bill_id text not null,
  zoho_payment_id text,
  zoho_bill_payment_id text,
  payment_number text,
  date date,
  amount numeric(14, 2) not null default 0,
  payment_mode text,
  reference_number text,
  description text,
  paid_through_account_name text,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_zoho_bill_payments_updated_at on public.zoho_bill_payments;
create trigger set_zoho_bill_payments_updated_at
before update on public.zoho_bill_payments
for each row execute function public.set_updated_at();

alter table public.zoho_bill_payments enable row level security;

drop policy if exists "Authenticated users can read bill payments" on public.zoho_bill_payments;
create policy "Authenticated users can read bill payments"
on public.zoho_bill_payments for select
to authenticated
using (true);

create index if not exists zoho_bill_payments_bill_idx
  on public.zoho_bill_payments (zoho_bill_id, date desc);
