-- ============================================================
-- TFP OS — 0001: franchisee roster / email allowlist + RLS
-- Run this in the Supabase SQL editor (or supabase db push).
-- ============================================================

-- Roster doubles as the login allowlist. Roles are data so more
-- can be added later (growth rule #3).
create table if not exists public.franchisees (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  location_name text,
  role          text not null default 'franchisee'
                check (role in ('franchisee', 'admin')),
  status        text not null default 'active'
                check (status in ('active', 'inactive')),
  created_at    timestamptz not null default now()
);

-- Normalize emails on write so lookups are case-insensitive.
create or replace function public.franchisees_normalize_email()
returns trigger language plpgsql as $$
begin
  new.email := lower(trim(new.email));
  return new;
end $$;

drop trigger if exists franchisees_normalize_email on public.franchisees;
create trigger franchisees_normalize_email
  before insert or update on public.franchisees
  for each row execute function public.franchisees_normalize_email();

-- ------------------------------------------------------------
-- Helpers (security definer so RLS policies don't recurse)
-- ------------------------------------------------------------
create or replace function public.current_email()
returns text language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.franchisees
    where email = public.current_email()
      and role = 'admin'
      and status = 'active'
  )
$$;

-- ------------------------------------------------------------
-- Grants (table-level access; RLS below decides which rows)
-- ------------------------------------------------------------
grant usage on schema public to authenticated, anon;
grant select, insert, update, delete on public.franchisees to authenticated;
grant all on public.franchisees to service_role;

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
alter table public.franchisees enable row level security;

drop policy if exists "read own profile" on public.franchisees;
create policy "read own profile"
  on public.franchisees for select
  to authenticated
  using (email = public.current_email());

drop policy if exists "admins read all" on public.franchisees;
create policy "admins read all"
  on public.franchisees for select
  to authenticated
  using (public.is_admin());

drop policy if exists "admins insert" on public.franchisees;
create policy "admins insert"
  on public.franchisees for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "admins update" on public.franchisees;
create policy "admins update"
  on public.franchisees for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admins delete" on public.franchisees;
create policy "admins delete"
  on public.franchisees for delete
  to authenticated
  using (public.is_admin());

-- ------------------------------------------------------------
-- Enforce the allowlist at signup (blocks Google AND email/password
-- signups for any email not on the roster).
-- ------------------------------------------------------------
create or replace function public.enforce_allowlist()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.franchisees
    where email = lower(new.email) and status = 'active'
  ) then
    raise exception 'not_authorized: this email is not on the TFP franchisee roster';
  end if;
  return new;
end $$;

drop trigger if exists enforce_allowlist on auth.users;
create trigger enforce_allowlist
  before insert on auth.users
  for each row execute function public.enforce_allowlist();

-- ------------------------------------------------------------
-- Seed: first admin (TFP HQ)
-- ------------------------------------------------------------
insert into public.franchisees (email, location_name, role)
values ('myles@theflyingpickle.com', 'TFP HQ', 'admin')
on conflict (email) do update set role = 'admin', status = 'active';
