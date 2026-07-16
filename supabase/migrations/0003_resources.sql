-- ============================================================
-- TFP OS — 0003: resource library (categories + resources)
-- Run after 0002. Safe to re-run.
-- ============================================================

-- Categories are data, not code (growth rule #1).
create table if not exists public.resource_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  sort_order int  not null default 0
);

create table if not exists public.resources (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.resource_categories(id),
  title       text not null,
  type        text not null default 'link'
              check (type in ('doc', 'sheet', 'slides', 'pdf', 'video', 'image', 'canva', 'link')),
  url         text not null,
  drive_ref   text,            -- phase 2: Drive file/folder id for live mirroring
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Grants + RLS
-- ------------------------------------------------------------
grant select, insert, update, delete on public.resource_categories to authenticated;
grant select, insert, update, delete on public.resources to authenticated;
grant all on public.resource_categories, public.resources to service_role;

alter table public.resource_categories enable row level security;
alter table public.resources enable row level security;

drop policy if exists "roster read categories" on public.resource_categories;
create policy "roster read categories"
  on public.resource_categories for select to authenticated
  using (public.is_roster_member());

drop policy if exists "admins write categories" on public.resource_categories;
create policy "admins write categories"
  on public.resource_categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "roster read resources" on public.resources;
create policy "roster read resources"
  on public.resources for select to authenticated
  using (public.is_roster_member());

drop policy if exists "admins write resources" on public.resources;
create policy "admins write resources"
  on public.resources for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------
-- Seed: first categories
-- ------------------------------------------------------------
insert into public.resource_categories (name, sort_order) values
  ('Marketing', 1),
  ('Playbooks', 2)
on conflict (name) do nothing;
