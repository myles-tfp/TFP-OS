-- ============================================================
-- TFP OS — 0015: channel archiving, chat attachments, board
-- descriptions, doodle notes. Additive only — no data touched.
-- Run after 0014. Safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- Channel archiving (managers+admins archive; only admins restore)
-- ------------------------------------------------------------
alter table public.chat_channels
  add column if not exists archived boolean not null default false;

create or replace function public.guard_channel_unarchive()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.archived = true and new.archived = false and not public.is_admin() then
    raise exception 'not_authorized: only HQ can restore an archived channel';
  end if;
  return new;
end $$;

drop trigger if exists guard_channel_unarchive on public.chat_channels;
create trigger guard_channel_unarchive
  before update on public.chat_channels
  for each row execute function public.guard_channel_unarchive();

-- Non-admins never see archived channels (paper trail stays with HQ)
drop policy if exists "chat channels read" on public.chat_channels;
create policy "chat channels read"
  on public.chat_channels for select to authenticated
  using (
    public.is_admin()
    or (location_id = public.current_location_id() and archived = false)
  );

-- Nobody posts into an archived channel
drop policy if exists "chat messages write" on public.chat_messages;
create policy "chat messages write"
  on public.chat_messages for insert to authenticated
  with check (
    author_id = public.current_franchisee_id()
    and exists (
      select 1 from public.chat_channels c
      where c.id = channel_id
        and c.archived = false
        and (public.is_admin() or c.location_id = public.current_location_id())
    )
  );

-- ------------------------------------------------------------
-- Chat attachments (original quality — stored as-is)
-- ------------------------------------------------------------
alter table public.chat_messages
  add column if not exists media_url text,
  add column if not exists media_type text;

-- Everyone signed in may upload chat attachments
drop policy if exists "members upload chat media" on storage.objects;
create policy "members upload chat media"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and name like 'chat/%');

-- ------------------------------------------------------------
-- Board (topic) descriptions with optional media
-- ------------------------------------------------------------
alter table public.topics
  add column if not exists description text,
  add column if not exists media_url text,
  add column if not exists media_type text;

-- ------------------------------------------------------------
-- Doodle notes (private per member)
-- ------------------------------------------------------------
create table if not exists public.notes (
  id            uuid primary key default gen_random_uuid(),
  franchisee_id uuid not null references public.franchisees(id) on delete cascade,
  title         text not null default 'Untitled',
  body          text not null default '',
  attachments   jsonb not null default '[]',
  height        int not null default 280,
  updated_at    timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

grant select, insert, update, delete on public.notes to authenticated;
grant all on public.notes to service_role;

alter table public.notes enable row level security;

drop policy if exists "own notes" on public.notes;
create policy "own notes"
  on public.notes for all to authenticated
  using (franchisee_id = public.current_franchisee_id())
  with check (franchisee_id = public.current_franchisee_id());

drop policy if exists "members upload note media" on storage.objects;
create policy "members upload note media"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and name like 'notes/%');
