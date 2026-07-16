-- ============================================================
-- TFP OS — 0002: feed (channels, posts, reactions) + RLS
-- Run after 0001. Safe to re-run.
-- ============================================================

-- Channels are data, not code (growth rule #1).
create table if not exists public.channels (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  sort_order int  not null default 0
);

create table if not exists public.posts (
  id              uuid primary key default gen_random_uuid(),
  channel_id      uuid not null references public.channels(id),
  title           text,
  body            text not null,
  media_url       text,
  media_type      text check (media_type in ('image', 'video', 'link')),
  requires_action boolean not null default false,
  created_by      uuid references public.franchisees(id),
  created_at      timestamptz not null default now()
);

-- A reaction doubles as a read receipt (existence = read).
create table if not exists public.reactions (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid not null references public.posts(id) on delete cascade,
  franchisee_id uuid not null references public.franchisees(id) on delete cascade,
  emoji         text not null,
  created_at    timestamptz not null default now(),
  unique (post_id, franchisee_id, emoji)
);

-- ------------------------------------------------------------
-- Helpers
-- ------------------------------------------------------------
-- The signed-in user's roster row id.
create or replace function public.current_franchisee_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.franchisees
  where email = public.current_email() and status = 'active'
$$;

-- Is the signed-in user on the active roster at all?
create or replace function public.is_roster_member()
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_franchisee_id() is not null
$$;

-- Total active franchisees (for "Read by X of N") — definer so
-- non-admins can get the count without reading other rows.
create or replace function public.roster_count()
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.franchisees where status = 'active'
$$;

-- ------------------------------------------------------------
-- Grants
-- ------------------------------------------------------------
grant select, insert, update, delete on public.channels  to authenticated;
grant select, insert, update, delete on public.posts     to authenticated;
grant select, insert, update, delete on public.reactions to authenticated;
grant all on public.channels, public.posts, public.reactions to service_role;

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
alter table public.channels  enable row level security;
alter table public.posts     enable row level security;
alter table public.reactions enable row level security;

-- Channels: roster reads, admins write.
drop policy if exists "roster read channels" on public.channels;
create policy "roster read channels"
  on public.channels for select to authenticated
  using (public.is_roster_member());

drop policy if exists "admins write channels" on public.channels;
create policy "admins write channels"
  on public.channels for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Posts: roster reads, admins write.
drop policy if exists "roster read posts" on public.posts;
create policy "roster read posts"
  on public.posts for select to authenticated
  using (public.is_roster_member());

drop policy if exists "admins write posts" on public.posts;
create policy "admins write posts"
  on public.posts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Reactions: roster reads all (needed for counts); each member
-- writes/removes only their own.
drop policy if exists "roster read reactions" on public.reactions;
create policy "roster read reactions"
  on public.reactions for select to authenticated
  using (public.is_roster_member());

drop policy if exists "own reactions insert" on public.reactions;
create policy "own reactions insert"
  on public.reactions for insert to authenticated
  with check (franchisee_id = public.current_franchisee_id());

drop policy if exists "own reactions delete" on public.reactions;
create policy "own reactions delete"
  on public.reactions for delete to authenticated
  using (franchisee_id = public.current_franchisee_id());

-- ------------------------------------------------------------
-- Seed: first channels + a welcome post
-- ------------------------------------------------------------
insert into public.channels (name, sort_order) values
  ('Marketing', 1),
  ('Operations', 2)
on conflict (name) do nothing;

insert into public.posts (channel_id, title, body, requires_action, created_by)
select
  (select id from public.channels where name = 'Marketing'),
  'Welcome to TFP OS',
  'This is the franchisor feed — HQ posts updates here and your reaction confirms you''ve read them. Give this one a 👍 to try it out.',
  false,
  (select id from public.franchisees where email = 'myles@theflyingpickle.com')
where not exists (select 1 from public.posts where title = 'Welcome to TFP OS');
