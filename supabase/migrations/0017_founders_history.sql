-- ============================================================
-- TFP OS — 0017: founders history (daily snapshots)
-- Captures each location's founding-members count so HQ can see
-- plateaus and spikes over time. Additive only.
-- Run after 0016. Safe to re-run.
-- ============================================================

create table if not exists public.founders_snapshots (
  location_id uuid not null references public.locations(id) on delete cascade,
  day         date not null default current_date,
  members     int not null default 0,
  primary key (location_id, day)
);

grant select on public.founders_snapshots to authenticated;
grant all on public.founders_snapshots to service_role;

alter table public.founders_snapshots enable row level security;

drop policy if exists "admins read snapshots" on public.founders_snapshots;
create policy "admins read snapshots"
  on public.founders_snapshots for select to authenticated
  using (public.is_admin() or location_id = public.current_location_id());

-- Snapshot every location's current count for today (idempotent)
create or replace function public.snapshot_founders()
returns void language sql security definer set search_path = public as $$
  insert into public.founders_snapshots (location_id, day, members)
  select id, current_date, coalesce(founding_members, 0)
  from public.locations
  on conflict (location_id, day)
  do update set members = excluded.members;
$$;

grant execute on function public.snapshot_founders() to anon, authenticated;

-- Also capture instantly whenever a founders number changes
create or replace function public.on_founders_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.founders_snapshots (location_id, day, members)
  values (new.id, current_date, coalesce(new.founding_members, 0))
  on conflict (location_id, day)
  do update set members = excluded.members;
  return new;
end $$;

drop trigger if exists snapshot_on_founders_change on public.locations;
create trigger snapshot_on_founders_change
  after update of founding_members on public.locations
  for each row execute function public.on_founders_change();

-- Seed today's snapshot right now
select public.snapshot_founders();
