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

create table if not exists public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  status text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  records_upserted integer not null default 0,
  error text
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
group by date_trunc('month', date)
order by date_trunc('month', date);

alter table public.zoho_customers enable row level security;
alter table public.zoho_invoices enable row level security;
alter table public.zoho_expenses enable row level security;
alter table public.zoho_bills enable row level security;
alter table public.sync_runs enable row level security;

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
