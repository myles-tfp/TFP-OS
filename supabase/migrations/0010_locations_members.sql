-- ============================================================
-- TFP OS — 0010: locations + team members
-- A location (club) owns the board and numbers; people are
-- members of a location with a location_role (manager | user).
-- Managers invite/remove their own team. Run after 0009.
-- ============================================================

create table if not exists public.locations (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  founding_members int,
  founding_goal    int not null default 100,
  grand_opening    date,
  created_at       timestamptz not null default now()
);

alter table public.franchisees
  add column if not exists location_id uuid references public.locations(id),
  add column if not exists location_role text not null default 'manager'
    check (location_role in ('manager', 'user'));

-- ------------------------------------------------------------
-- Backfill: every existing franchisee row becomes the manager
-- of a new location carrying their old numbers.
-- ------------------------------------------------------------
do $$
declare r record; lid uuid;
begin
  for r in select * from public.franchisees where location_id is null loop
    insert into public.locations (name, founding_members, founding_goal, grand_opening)
    values (
      coalesce(r.location_name, split_part(r.email, '@', 1)),
      r.founding_members, coalesce(r.founding_goal, 100), r.grand_opening
    )
    returning id into lid;
    update public.franchisees
    set location_id = lid, location_role = 'manager'
    where id = r.id;
  end loop;
end $$;

-- ------------------------------------------------------------
-- Helpers
-- ------------------------------------------------------------
create or replace function public.current_location_id()
returns uuid language sql stable security definer set search_path = public as $$
  select location_id from public.franchisees
  where email = public.current_email() and status = 'active'
$$;

create or replace function public.is_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.franchisees
    where email = public.current_email()
      and status = 'active' and location_role = 'manager'
  )
$$;

-- ------------------------------------------------------------
-- Locations grants + RLS
-- ------------------------------------------------------------
grant select, insert, update, delete on public.locations to authenticated;
grant all on public.locations to service_role;

alter table public.locations enable row level security;

drop policy if exists "read own location" on public.locations;
create policy "read own location"
  on public.locations for select to authenticated
  using (id = public.current_location_id() or public.is_admin());

drop policy if exists "manager update own location" on public.locations;
create policy "manager update own location"
  on public.locations for update to authenticated
  using (public.is_admin() or (public.is_manager() and id = public.current_location_id()))
  with check (public.is_admin() or (public.is_manager() and id = public.current_location_id()));

drop policy if exists "admins write locations" on public.locations;
create policy "admins write locations"
  on public.locations for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------
-- Team management: members can see teammates; managers run
-- their own crew (users only — never other managers/admins).
-- ------------------------------------------------------------
drop policy if exists "read teammates" on public.franchisees;
create policy "read teammates"
  on public.franchisees for select to authenticated
  using (location_id = public.current_location_id());

drop policy if exists "manager invite users" on public.franchisees;
create policy "manager invite users"
  on public.franchisees for insert to authenticated
  with check (
    public.is_manager()
    and location_id = public.current_location_id()
    and location_role = 'user'
    and role = 'franchisee'
  );

drop policy if exists "manager update users" on public.franchisees;
create policy "manager update users"
  on public.franchisees for update to authenticated
  using (public.is_manager() and location_id = public.current_location_id() and location_role = 'user')
  with check (public.is_manager() and location_id = public.current_location_id() and location_role = 'user' and role = 'franchisee');

drop policy if exists "manager remove users" on public.franchisees;
create policy "manager remove users"
  on public.franchisees for delete to authenticated
  using (public.is_manager() and location_id = public.current_location_id() and location_role = 'user');

-- ------------------------------------------------------------
-- Boards move from person -> location
-- ------------------------------------------------------------
alter table public.phases
  add column if not exists location_id uuid references public.locations(id) on delete cascade;

update public.phases p
set location_id = f.location_id
from public.franchisees f
where p.franchisee_id = f.id and p.location_id is null;

drop policy if exists "read own phases" on public.phases;
drop policy if exists "read own tasks" on public.tasks;
drop policy if exists "update own tasks" on public.tasks;

alter table public.phases drop column if exists franchisee_id;

create policy "read own phases"
  on public.phases for select to authenticated
  using (location_id = public.current_location_id() or public.is_admin());

create policy "read own tasks"
  on public.tasks for select to authenticated
  using (
    public.is_admin() or exists (
      select 1 from public.phases p
      where p.id = phase_id and p.location_id = public.current_location_id()
    )
  );

create policy "update own tasks"
  on public.tasks for update to authenticated
  using (
    public.is_admin() or exists (
      select 1 from public.phases p
      where p.id = phase_id and p.location_id = public.current_location_id()
    )
  )
  with check (
    public.is_admin() or exists (
      select 1 from public.phases p
      where p.id = phase_id and p.location_id = public.current_location_id()
    )
  );

-- Template copy now targets a location; boards spawn per location
create or replace function public.copy_template_board(target uuid)
returns void language plpgsql security definer set search_path = public as $$
declare tpl record; new_phase uuid;
begin
  if exists (select 1 from public.phases where location_id = target) then
    return;
  end if;
  for tpl in
    select * from public.phases where location_id is null order by sort_order
  loop
    insert into public.phases (location_id, name, tag, sort_order)
    values (target, tpl.name, tpl.tag, tpl.sort_order)
    returning id into new_phase;

    insert into public.tasks (phase_id, title, owner, status, due_date, sort_order)
    select new_phase, t.title, t.owner, 'not_started', t.due_date, t.sort_order
    from public.tasks t where t.phase_id = tpl.id;
  end loop;
end $$;

drop trigger if exists copy_board_on_signup on public.franchisees;

create or replace function public.on_location_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.copy_template_board(new.id);
  return new;
end $$;

drop trigger if exists copy_board_on_location on public.locations;
create trigger copy_board_on_location
  after insert on public.locations
  for each row execute function public.on_location_created();

-- Task-progress notifications now name the location
create or replace function public.notify_task_progress()
returns trigger language plpgsql security definer set search_path = public as $$
declare loc text; lid uuid;
begin
  if new.status = old.status then return new; end if;
  if public.is_admin() then return new; end if;

  select p.location_id, l.name into lid, loc
  from public.phases p
  join public.locations l on l.id = p.location_id
  where p.id = new.phase_id;

  if lid is null then return new; end if;

  insert into public.notifications (audience, kind, title, body, link)
  values (
    'admins', 'task',
    loc || ' — ' || new.title,
    case new.status
      when 'done' then 'Marked done ✅'
      when 'stuck' then 'Marked STUCK — may need help'
      when 'working' then 'Started working on it'
      else 'Status changed'
    end,
    '/admin/boards/' || lid
  );
  return new;
end $$;

-- Old per-person fields now live on locations
alter table public.franchisees
  drop column if exists founding_members,
  drop column if exists founding_goal,
  drop column if exists grand_opening;
