-- RAB Calculator schema (Supabase Postgres)
-- REQUIRED: run this file against your Supabase project once.
-- Dashboard → SQL Editor → New query → paste → Run.
-- Or: supabase db push (if CLI is linked to this project)

create extension if not exists "pgcrypto";

-- === Master data ===
create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null default '',
  price numeric(18, 2) not null default 0 check (price >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.labor (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null default '',
  price numeric(18, 2) not null default 0 check (price >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.work_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.work_item_details (
  id uuid primary key default gen_random_uuid(),
  work_item_id uuid not null references public.work_items (id) on delete cascade,
  type text not null check (type in ('material', 'labor')),
  ref_id uuid not null,
  coefficient numeric(18, 6) not null default 1 check (coefficient >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_work_item_details_work_item_id on public.work_item_details (work_item_id);

create table if not exists public.rab_calculation_history (
  id uuid primary key default gen_random_uuid(),
  work_item_id uuid references public.work_items (id) on delete set null,
  volume numeric(18, 4) not null,
  base_result jsonb not null,
  ai_result jsonb,
  ai_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_rab_history_created on public.rab_calculation_history (created_at desc);

alter table public.materials enable row level security;
alter table public.labor enable row level security;
alter table public.work_items enable row level security;
alter table public.work_item_details enable row level security;
alter table public.rab_calculation_history enable row level security;

drop policy if exists "materials_all_anon" on public.materials;
drop policy if exists "labor_all_anon" on public.labor;
drop policy if exists "work_items_all_anon" on public.work_items;
drop policy if exists "work_item_details_all_anon" on public.work_item_details;
drop policy if exists "rab_history_all_anon" on public.rab_calculation_history;

create policy "materials_all_anon" on public.materials for all using (true) with check (true);
create policy "labor_all_anon" on public.labor for all using (true) with check (true);
create policy "work_items_all_anon" on public.work_items for all using (true) with check (true);
create policy "work_item_details_all_anon" on public.work_item_details for all using (true) with check (true);
create policy "rab_history_all_anon" on public.rab_calculation_history for all using (true) with check (true);
