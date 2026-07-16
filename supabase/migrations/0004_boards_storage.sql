-- ============================================================
-- TFP OS — 0004: unified topic boards + file storage
-- Boards replace separate channels/resource categories: one topic
-- collects posts AND resources. Run after 0003. Safe to re-run.
-- NOTE: do not re-run 0002/0003 after this one.
-- ============================================================

-- ------------------------------------------------------------
-- Topics (boards) — data, not code. status drives "coming soon".
-- ------------------------------------------------------------
create table if not exists public.topics (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  sort_order int  not null default 0,
  status     text not null default 'live' check (status in ('live', 'coming_soon'))
);

insert into public.topics (name, sort_order, status) values
  ('Marketing',  1, 'live'),
  ('Playbooks',  2, 'live'),
  ('Training',   3, 'coming_soon'),
  ('Operations', 4, 'coming_soon')
on conflict (name) do nothing;

grant select, insert, update, delete on public.topics to authenticated;
grant all on public.topics to service_role;

alter table public.topics enable row level security;

drop policy if exists "roster read topics" on public.topics;
create policy "roster read topics"
  on public.topics for select to authenticated
  using (public.is_roster_member());

drop policy if exists "admins write topics" on public.topics;
create policy "admins write topics"
  on public.topics for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------
-- Remap posts: channel_id -> topic_id
-- ------------------------------------------------------------
alter table public.posts add column if not exists topic_id uuid references public.topics(id);

update public.posts p
set topic_id = t.id
from public.channels c
join public.topics t on t.name = c.name
where p.channel_id = c.id and p.topic_id is null;

-- Any stragglers land on Marketing.
update public.posts
set topic_id = (select id from public.topics where name = 'Marketing')
where topic_id is null;

alter table public.posts alter column topic_id set not null;
alter table public.posts drop column if exists channel_id;

-- Allow embeds in media_type.
alter table public.posts drop constraint if exists posts_media_type_check;
alter table public.posts add constraint posts_media_type_check
  check (media_type in ('image', 'video', 'link', 'embed'));

-- ------------------------------------------------------------
-- Remap resources: category_id -> topic_id
-- ------------------------------------------------------------
alter table public.resources add column if not exists topic_id uuid references public.topics(id);

update public.resources r
set topic_id = t.id
from public.resource_categories rc
join public.topics t on t.name = rc.name
where r.category_id = rc.id and r.topic_id is null;

update public.resources
set topic_id = (select id from public.topics where name = 'Marketing')
where topic_id is null;

alter table public.resources alter column topic_id set not null;
alter table public.resources drop column if exists category_id;

-- ------------------------------------------------------------
-- Retire the old tables
-- ------------------------------------------------------------
drop table if exists public.channels;
drop table if exists public.resource_categories;

-- ------------------------------------------------------------
-- Storage: public media bucket (unguessable URLs, admin-managed)
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists "public read media" on storage.objects;
create policy "public read media"
  on storage.objects for select
  using (bucket_id = 'media');

drop policy if exists "admins upload media" on storage.objects;
create policy "admins upload media"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.is_admin());

drop policy if exists "admins update media" on storage.objects;
create policy "admins update media"
  on storage.objects for update to authenticated
  using (bucket_id = 'media' and public.is_admin())
  with check (bucket_id = 'media' and public.is_admin());

drop policy if exists "admins delete media" on storage.objects;
create policy "admins delete media"
  on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.is_admin());
