-- ============================================================
-- TFP OS — 0007: phase/task engine (Monday-style boards)
-- Template board (franchisee_id null) auto-copies to each new
-- franchisee. Run after 0006. Safe to re-run.
-- ============================================================

-- Grand opening + founders goal (editable by both parties later)
alter table public.franchisees
  add column if not exists grand_opening date,
  add column if not exists founding_goal int not null default 100;

create table if not exists public.phases (
  id            uuid primary key default gen_random_uuid(),
  franchisee_id uuid references public.franchisees(id) on delete cascade,
  name          text not null,
  tag           text,              -- e.g. 'marketing' powers the Marketing tab
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  phase_id    uuid not null references public.phases(id) on delete cascade,
  title       text not null,
  owner       text not null default 'franchisee' check (owner in ('hq', 'franchisee')),
  status      text not null default 'not_started'
              check (status in ('not_started', 'working', 'stuck', 'done')),
  due_date    date,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Grants + RLS
-- ------------------------------------------------------------
grant select, insert, update, delete on public.phases to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant all on public.phases, public.tasks to service_role;

alter table public.phases enable row level security;
alter table public.tasks enable row level security;

-- Franchisees see their own board; admins see everything incl. template.
drop policy if exists "read own phases" on public.phases;
create policy "read own phases"
  on public.phases for select to authenticated
  using (franchisee_id = public.current_franchisee_id() or public.is_admin());

drop policy if exists "admins write phases" on public.phases;
create policy "admins write phases"
  on public.phases for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "read own tasks" on public.tasks;
create policy "read own tasks"
  on public.tasks for select to authenticated
  using (
    public.is_admin() or exists (
      select 1 from public.phases p
      where p.id = phase_id and p.franchisee_id = public.current_franchisee_id()
    )
  );

-- Franchisees can update tasks on their own board (check things off);
-- structure changes (add/delete) are admin-only.
drop policy if exists "update own tasks" on public.tasks;
create policy "update own tasks"
  on public.tasks for update to authenticated
  using (
    public.is_admin() or exists (
      select 1 from public.phases p
      where p.id = phase_id and p.franchisee_id = public.current_franchisee_id()
    )
  )
  with check (
    public.is_admin() or exists (
      select 1 from public.phases p
      where p.id = phase_id and p.franchisee_id = public.current_franchisee_id()
    )
  );

drop policy if exists "admins insert tasks" on public.tasks;
create policy "admins insert tasks"
  on public.tasks for insert to authenticated
  with check (public.is_admin());

drop policy if exists "admins delete tasks" on public.tasks;
create policy "admins delete tasks"
  on public.tasks for delete to authenticated
  using (public.is_admin());

-- ------------------------------------------------------------
-- Template auto-copy
-- ------------------------------------------------------------
create or replace function public.copy_template_board(target uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  tpl record;
  new_phase uuid;
begin
  -- don't double-copy
  if exists (select 1 from public.phases where franchisee_id = target) then
    return;
  end if;
  for tpl in
    select * from public.phases where franchisee_id is null order by sort_order
  loop
    insert into public.phases (franchisee_id, name, tag, sort_order)
    values (target, tpl.name, tpl.tag, tpl.sort_order)
    returning id into new_phase;

    insert into public.tasks (phase_id, title, owner, status, due_date, sort_order)
    select new_phase, t.title, t.owner, 'not_started', t.due_date, t.sort_order
    from public.tasks t where t.phase_id = tpl.id;
  end loop;
end $$;

create or replace function public.on_franchisee_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.copy_template_board(new.id);
  return new;
end $$;

drop trigger if exists copy_board_on_signup on public.franchisees;
create trigger copy_board_on_signup
  after insert on public.franchisees
  for each row execute function public.on_franchisee_created();

-- ------------------------------------------------------------
-- Seed the template (franchisee_id null) with your phase names
-- ------------------------------------------------------------
insert into public.phases (franchisee_id, name, tag, sort_order)
select null, v.name, v.tag, v.sort_order
from (values
  ('Phase 1 — Agreement Signed',            null,        1),
  ('More than 6 months from Grand Open',    null,        2),
  ('6 months from Grand Open',              null,        3),
  ('90 days from Grand Open',               null,        4),
  ('Month 1 — Kickoff and Awareness',       'marketing', 5),
  ('Month 2 — First Community Event',       'marketing', 6),
  ('Month 3 — Build Momentum',              'marketing', 7),
  ('Month 4 — Second Event and Membership', 'marketing', 8),
  ('Month 5 — Grand Opening Prep',          'marketing', 9),
  ('Month 6 — Launch Hype',                 'marketing', 10),
  ('Phase 3 — Ongoing Support',             null,        11)
) as v(name, tag, sort_order)
where not exists (select 1 from public.phases where franchisee_id is null);

-- A few starter tasks in Phase 1 so the template isn't empty
insert into public.tasks (phase_id, title, owner, sort_order)
select p.id, v.title, v.owner, v.sort_order
from public.phases p,
(values
  ('Welcome emails',                       'hq',         1),
  ('Email creation',                       'hq',         2),
  ('Social handles creation',              'hq',         3),
  ('Site selection',                       'franchisee', 4),
  ('Business license',                     'franchisee', 5),
  ('Set up business entity',               'franchisee', 6),
  ('Secure funding',                       'franchisee', 7),
  ('Create EIN',                           'franchisee', 8),
  ('Lease negotiated and signed',          'franchisee', 9)
) as v(title, owner, sort_order)
where p.franchisee_id is null
  and p.name = 'Phase 1 — Agreement Signed'
  and not exists (select 1 from public.tasks t where t.phase_id = p.id);

-- Give boards to franchisees already on the roster
select public.copy_template_board(id)
from public.franchisees where status = 'active';
