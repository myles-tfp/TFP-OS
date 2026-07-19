-- ============================================================
-- TFP OS — 0009: notifications
-- Franchisees: new posts + new resources. Admins: task progress.
-- Run after 0008. Safe to re-run.
-- ============================================================

create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  audience     text not null check (audience in ('franchisees', 'admins')),
  recipient_id uuid references public.franchisees(id) on delete cascade,
  kind         text not null,
  title        text not null,
  body         text,
  link         text,
  created_at   timestamptz not null default now()
);

alter table public.franchisees
  add column if not exists notifications_seen_at timestamptz not null default now();

grant select, insert, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;

alter table public.notifications enable row level security;

drop policy if exists "read own notifications" on public.notifications;
create policy "read own notifications"
  on public.notifications for select to authenticated
  using (
    recipient_id = public.current_franchisee_id()
    or (recipient_id is null and audience = 'franchisees' and not public.is_admin())
    or (recipient_id is null and audience = 'admins' and public.is_admin())
  );

drop policy if exists "admins manage notifications" on public.notifications;
create policy "admins manage notifications"
  on public.notifications for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- mark seen (definer so franchisees don't need update rights on their row)
create or replace function public.mark_notifications_seen()
returns void language sql security definer set search_path = public as $$
  update public.franchisees
  set notifications_seen_at = now()
  where email = public.current_email();
$$;

-- ------------------------------------------------------------
-- Triggers that create notifications
-- ------------------------------------------------------------
create or replace function public.notify_new_post()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (audience, kind, title, body, link)
  values (
    'franchisees', 'post',
    coalesce(nullif(new.title, ''), 'New update from HQ'),
    left(new.body, 140),
    '/#post-' || new.id
  );
  return new;
end $$;

drop trigger if exists notify_new_post on public.posts;
create trigger notify_new_post
  after insert on public.posts
  for each row execute function public.notify_new_post();

create or replace function public.notify_new_resource()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (audience, kind, title, body, link)
  values (
    'franchisees', 'resource',
    'New resource: ' || new.title,
    null,
    '/boards/' || new.topic_id
  );
  return new;
end $$;

drop trigger if exists notify_new_resource on public.resources;
create trigger notify_new_resource
  after insert on public.resources
  for each row execute function public.notify_new_resource();

-- Task progress: only when a NON-admin (a franchisee) changes status
create or replace function public.notify_task_progress()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  loc text;
  fid uuid;
begin
  if new.status = old.status then return new; end if;
  if public.is_admin() then return new; end if;

  select p.franchisee_id, coalesce(f.location_name, f.email)
    into fid, loc
  from public.phases p
  join public.franchisees f on f.id = p.franchisee_id
  where p.id = new.phase_id;

  if fid is null then return new; end if;

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
    '/admin/boards/' || fid
  );
  return new;
end $$;

drop trigger if exists notify_task_progress on public.tasks;
create trigger notify_task_progress
  after update on public.tasks
  for each row execute function public.notify_task_progress();
