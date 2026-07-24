-- ============================================================
-- TFP OS — 0011: member profiles + per-location chat
-- Run after 0010. Safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- Profiles: display name + avatar, self-editable (safely)
-- ------------------------------------------------------------
alter table public.franchisees
  add column if not exists display_name text,
  add column if not exists avatar_url text;

drop policy if exists "update own profile" on public.franchisees;
create policy "update own profile"
  on public.franchisees for update to authenticated
  using (email = public.current_email())
  with check (email = public.current_email());

-- Guard: non-admins editing their own row can only change safe columns
create or replace function public.guard_franchisee_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;
  if old.email = public.current_email() then
    if new.role is distinct from old.role
      or new.status is distinct from old.status
      or new.email is distinct from old.email
      or new.location_id is distinct from old.location_id
      or new.location_role is distinct from old.location_role then
      raise exception 'not_authorized: you can only edit your name and photo';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists guard_franchisee_update on public.franchisees;
create trigger guard_franchisee_update
  before update on public.franchisees
  for each row execute function public.guard_franchisee_update();

-- ------------------------------------------------------------
-- Chat: channels per location (shared with HQ), messages,
-- reactions, and per-member read markers
-- ------------------------------------------------------------
create table if not exists public.chat_channels (
  id          uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  name        text not null,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  unique (location_id, name)
);

create table if not exists public.chat_messages (
  id         uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.chat_channels(id) on delete cascade,
  author_id  uuid not null references public.franchisees(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_reactions (
  id            uuid primary key default gen_random_uuid(),
  message_id    uuid not null references public.chat_messages(id) on delete cascade,
  franchisee_id uuid not null references public.franchisees(id) on delete cascade,
  emoji         text not null,
  unique (message_id, franchisee_id, emoji)
);

create table if not exists public.chat_reads (
  channel_id    uuid not null references public.chat_channels(id) on delete cascade,
  franchisee_id uuid not null references public.franchisees(id) on delete cascade,
  last_read_at  timestamptz not null default now(),
  primary key (channel_id, franchisee_id)
);

grant select, insert, update, delete on public.chat_channels, public.chat_messages, public.chat_reactions, public.chat_reads to authenticated;
grant all on public.chat_channels, public.chat_messages, public.chat_reactions, public.chat_reads to service_role;

alter table public.chat_channels  enable row level security;
alter table public.chat_messages  enable row level security;
alter table public.chat_reactions enable row level security;
alter table public.chat_reads     enable row level security;

drop policy if exists "chat channels read" on public.chat_channels;
create policy "chat channels read"
  on public.chat_channels for select to authenticated
  using (location_id = public.current_location_id() or public.is_admin());

drop policy if exists "chat channels manage" on public.chat_channels;
create policy "chat channels manage"
  on public.chat_channels for all to authenticated
  using (public.is_admin() or (public.is_manager() and location_id = public.current_location_id()))
  with check (public.is_admin() or (public.is_manager() and location_id = public.current_location_id()));

drop policy if exists "chat messages read" on public.chat_messages;
create policy "chat messages read"
  on public.chat_messages for select to authenticated
  using (
    public.is_admin() or exists (
      select 1 from public.chat_channels c
      where c.id = channel_id and c.location_id = public.current_location_id()
    )
  );

drop policy if exists "chat messages write" on public.chat_messages;
create policy "chat messages write"
  on public.chat_messages for insert to authenticated
  with check (
    author_id = public.current_franchisee_id()
    and (
      public.is_admin() or exists (
        select 1 from public.chat_channels c
        where c.id = channel_id and c.location_id = public.current_location_id()
      )
    )
  );

drop policy if exists "chat reactions read" on public.chat_reactions;
create policy "chat reactions read"
  on public.chat_reactions for select to authenticated
  using (
    public.is_admin() or exists (
      select 1 from public.chat_messages m
      join public.chat_channels c on c.id = m.channel_id
      where m.id = message_id and c.location_id = public.current_location_id()
    )
  );

drop policy if exists "chat reactions own insert" on public.chat_reactions;
create policy "chat reactions own insert"
  on public.chat_reactions for insert to authenticated
  with check (franchisee_id = public.current_franchisee_id());

drop policy if exists "chat reactions own delete" on public.chat_reactions;
create policy "chat reactions own delete"
  on public.chat_reactions for delete to authenticated
  using (franchisee_id = public.current_franchisee_id());

drop policy if exists "chat reads own" on public.chat_reads;
create policy "chat reads own"
  on public.chat_reads for all to authenticated
  using (franchisee_id = public.current_franchisee_id())
  with check (franchisee_id = public.current_franchisee_id());

-- ------------------------------------------------------------
-- Default channels per location (also for future locations)
-- ------------------------------------------------------------
create or replace function public.seed_default_channels(target uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.chat_channels (location_id, name, sort_order)
  values
    (target, 'general',      1),
    (target, 'marketing',    2),
    (target, 'training',     3),
    (target, 'programming',  4),
    (target, 'hiring',       5),
    (target, 'construction', 6)
  on conflict (location_id, name) do nothing;
$$;

create or replace function public.on_location_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.copy_template_board(new.id);
  perform public.seed_default_channels(new.id);
  return new;
end $$;

select public.seed_default_channels(id) from public.locations;

-- ------------------------------------------------------------
-- Chat notifications: message -> bell for the location's other
-- members; admins get pinged when a non-admin writes
-- ------------------------------------------------------------
create or replace function public.notify_chat_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare ch record; author record;
begin
  select c.name, c.location_id, l.name as location_name
    into ch
  from public.chat_channels c
  join public.locations l on l.id = c.location_id
  where c.id = new.channel_id;

  select coalesce(display_name, email) as name, role
    into author
  from public.franchisees where id = new.author_id;

  insert into public.notifications (audience, recipient_id, kind, title, body, link)
  select 'franchisees', f.id, 'chat',
         ch.location_name || ' · #' || ch.name,
         author.name || ': ' || left(new.body, 100),
         '/#chat'
  from public.franchisees f
  where f.location_id = ch.location_id
    and f.status = 'active'
    and f.id <> new.author_id;

  if author.role <> 'admin' then
    insert into public.notifications (audience, kind, title, body, link)
    values ('admins', 'chat',
            ch.location_name || ' · #' || ch.name,
            author.name || ': ' || left(new.body, 100),
            '/#chat');
  end if;
  return new;
end $$;

drop trigger if exists notify_chat_message on public.chat_messages;
create trigger notify_chat_message
  after insert on public.chat_messages
  for each row execute function public.notify_chat_message();

-- ------------------------------------------------------------
-- Storage: anyone signed in may upload their own avatar
-- ------------------------------------------------------------
drop policy if exists "members upload avatars" on storage.objects;
create policy "members upload avatars"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and name like 'avatars/%');

drop policy if exists "members update avatars" on storage.objects;
create policy "members update avatars"
  on storage.objects for update to authenticated
  using (bucket_id = 'media' and name like 'avatars/%')
  with check (bucket_id = 'media' and name like 'avatars/%');
