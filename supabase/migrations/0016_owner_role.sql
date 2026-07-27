-- ============================================================
-- TFP OS — 0016: account owner role
-- Owner = admin powers + the top-of-the-tree title. Only an
-- owner can grant owner. Additive; no data touched.
-- Run after 0015. Safe to re-run.
-- ============================================================

alter table public.franchisees
  drop constraint if exists franchisees_role_check;
alter table public.franchisees
  add constraint franchisees_role_check
  check (role in ('franchisee', 'admin', 'owner'));

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.franchisees
    where email = public.current_email()
      and role = 'owner' and status = 'active'
  )
$$;

-- Owners count as admins everywhere in the app
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.franchisees
    where email = public.current_email()
      and role in ('admin', 'owner')
      and status = 'active'
  )
$$;

-- Only an owner can grant (or revoke) the owner role
create or replace function public.guard_owner_grant()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- No signed-in user = trusted context (SQL editor / server) — allow
  if public.current_email() = '' then
    return new;
  end if;
  if new.role is distinct from old.role
     and (new.role = 'owner' or old.role = 'owner')
     and not public.is_owner() then
    raise exception 'not_authorized: only an account owner can change owner status';
  end if;
  return new;
end $$;

drop trigger if exists guard_owner_grant on public.franchisees;
create trigger guard_owner_grant
  before update on public.franchisees
  for each row execute function public.guard_owner_grant();

-- Myles is the account owner
update public.franchisees
set role = 'owner'
where email = 'myles@theflyingpickle.com';
