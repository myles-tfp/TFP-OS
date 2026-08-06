-- ============================================================
-- TFP OS — 0020: Team Hubs (foundation)
-- Private team workspaces per location. HQ is NOT auto-included:
-- hub content is visible to hub members only.
-- Creating a hub auto-creates its #channel; renaming syncs it.
-- Additive only. Run after 0019. Safe to re-run.
-- ============================================================

create table if not exists public.hubs (
  id          uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  name        text not null,
  created_by  uuid not null references public.franchisees(id) on delete cascade,
  archived    boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.hub_members (
  hub_id        uuid not null references public.hubs(id) on delete cascade,
  franchisee_id uuid not null references public.franchisees(id) on delete cascade,
  role          text not null default 'member', -- 'owner' | 'member'
  added_at      timestamptz not null default now(),
  primary key (hub_id, franchisee_id)
);

grant select, insert, update, delete on public.hubs, public.hub_members to authenticated;
grant all on public.hubs, public.hub_members to service_role;

-- ---- helpers ----
create or replace function public.is_hub_member(h uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.hub_members
    where hub_id = h and franchisee_id = public.current_franchisee_id()
  )
$$;

create or replace function public.is_hub_owner(h uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.hub_members
    where hub_id = h and franchisee_id = public.current_franchisee_id()
      and role = 'owner'
  )
$$;

-- ---- RLS: hubs are members-only (even HQ stays out unless added) ----
alter table public.hubs enable row level security;
alter table public.hub_members enable row level security;

drop policy if exists "hub members read hubs" on public.hubs;
create policy "hub members read hubs"
  on public.hubs for select to authenticated
  using (public.is_hub_member(id) or created_by = public.current_franchisee_id());

drop policy if exists "managers create hubs" on public.hubs;
create policy "managers create hubs"
  on public.hubs for insert to authenticated
  with check (
    created_by = public.current_franchisee_id()
    and location_id = public.current_location_id()
    and (public.is_admin() or public.is_manager())
  );

drop policy if exists "hub owners update hubs" on public.hubs;
create policy "hub owners update hubs"
  on public.hubs for update to authenticated
  using (public.is_hub_owner(id) or created_by = public.current_franchisee_id());

drop policy if exists "read hub membership" on public.hub_members;
create policy "read hub membership"
  on public.hub_members for select to authenticated
  using (
    public.is_hub_member(hub_id)
    or exists (select 1 from public.hubs h
               where h.id = hub_id and h.created_by = public.current_franchisee_id())
  );

drop policy if exists "hub owners add members" on public.hub_members;
create policy "hub owners add members"
  on public.hub_members for insert to authenticated
  with check (
    (public.is_hub_owner(hub_id)
     or exists (select 1 from public.hubs h
                where h.id = hub_id and h.created_by = public.current_franchisee_id()))
    -- members must come from the hub's own location
    and exists (
      select 1 from public.franchisees f
      join public.hubs h on h.id = hub_id
      where f.id = franchisee_id and f.location_id = h.location_id
    )
  );

drop policy if exists "hub owners remove members or self-leave" on public.hub_members;
create policy "hub owners remove members or self-leave"
  on public.hub_members for delete to authenticated
  using (
    public.is_hub_owner(hub_id)
    or franchisee_id = public.current_franchisee_id()
  );

-- ---- chat: channels can now belong to a hub instead of a location ----
alter table public.chat_channels alter column location_id drop not null;
alter table public.chat_channels
  add column if not exists hub_id uuid references public.hubs(id) on delete cascade;
create unique index if not exists chat_channels_hub_name
  on public.chat_channels (hub_id, name) where hub_id is not null;

drop policy if exists "chat channels read" on public.chat_channels;
create policy "chat channels read"
  on public.chat_channels for select to authenticated
  using (
    (hub_id is null and (
      public.is_admin()
      or (location_id = public.current_location_id() and archived = false)
    ))
    or (hub_id is not null and public.is_hub_member(hub_id)
        and (archived = false or public.is_hub_owner(hub_id)))
  );

drop policy if exists "chat channels manage" on public.chat_channels;
create policy "chat channels manage"
  on public.chat_channels for all to authenticated
  using (
    (hub_id is null and (public.is_admin()
      or (public.is_manager() and location_id = public.current_location_id())))
    or (hub_id is not null and public.is_hub_owner(hub_id))
  )
  with check (
    (hub_id is null and (public.is_admin()
      or (public.is_manager() and location_id = public.current_location_id())))
    or (hub_id is not null and public.is_hub_owner(hub_id))
  );

-- hub channel restores are for the hub owner (HQ stays out of hubs)
create or replace function public.guard_channel_unarchive()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.archived = true and new.archived = false then
    if new.hub_id is not null then
      if not public.is_hub_owner(new.hub_id) then
        raise exception 'not_authorized: only the hub owner can restore this channel';
      end if;
    elsif not public.is_admin() then
      raise exception 'not_authorized: only HQ can restore an archived channel';
    end if;
  end if;
  return new;
end $$;

drop policy if exists "chat messages read" on public.chat_messages;
create policy "chat messages read"
  on public.chat_messages for select to authenticated
  using (
    exists (
      select 1 from public.chat_channels c
      where c.id = channel_id
        and (
          (c.hub_id is null and (public.is_admin()
            or c.location_id = public.current_location_id()))
          or (c.hub_id is not null and public.is_hub_member(c.hub_id))
        )
    )
  );

drop policy if exists "chat messages write" on public.chat_messages;
create policy "chat messages write"
  on public.chat_messages for insert to authenticated
  with check (
    author_id = public.current_franchisee_id()
    and exists (
      select 1 from public.chat_channels c
      where c.id = channel_id
        and c.archived = false
        and (
          (c.hub_id is null and (public.is_admin()
            or c.location_id = public.current_location_id()))
          or (c.hub_id is not null and public.is_hub_member(c.hub_id))
        )
    )
  );

drop policy if exists "chat reactions read" on public.chat_reactions;
create policy "chat reactions read"
  on public.chat_reactions for select to authenticated
  using (
    exists (
      select 1 from public.chat_messages m
      join public.chat_channels c on c.id = m.channel_id
      where m.id = message_id
        and (
          (c.hub_id is null and (public.is_admin()
            or c.location_id = public.current_location_id()))
          or (c.hub_id is not null and public.is_hub_member(c.hub_id))
        )
    )
  );

-- ---- unread counts include hub channels ----
create or replace function public.unread_chat_count()
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int
  from public.chat_messages m
  join public.chat_channels c on c.id = m.channel_id
  where (
      (c.hub_id is null and (public.is_admin() or c.location_id = public.current_location_id()))
      or (c.hub_id is not null and public.is_hub_member(c.hub_id))
    )
    and c.archived = false
    and m.author_id is distinct from public.current_franchisee_id()
    and m.created_at > coalesce(
      (select r.last_read_at from public.chat_reads r
       where r.channel_id = m.channel_id
         and r.franchisee_id = public.current_franchisee_id()),
      'epoch'::timestamptz
    );
$$;

-- ---- chat notifications: hub messages ping hub members only ----
create or replace function public.notify_chat_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare ch record; author record;
begin
  select c.name, c.location_id, c.hub_id,
         coalesce(h.name, l.name) as space_name
    into ch
  from public.chat_channels c
  left join public.locations l on l.id = c.location_id
  left join public.hubs h on h.id = c.hub_id
  where c.id = new.channel_id;

  select coalesce(display_name, email) as name, role
    into author
  from public.franchisees where id = new.author_id;

  if ch.hub_id is not null then
    insert into public.notifications (audience, recipient_id, kind, title, body, link)
    select 'franchisees', hm.franchisee_id, 'chat',
           ch.space_name || ' · #' || ch.name,
           author.name || ': ' || left(new.body, 100),
           '/#chat'
    from public.hub_members hm
    where hm.hub_id = ch.hub_id and hm.franchisee_id <> new.author_id;
    return new;
  end if;

  insert into public.notifications (audience, recipient_id, kind, title, body, link)
  select 'franchisees', f.id, 'chat',
         ch.space_name || ' · #' || ch.name,
         author.name || ': ' || left(new.body, 100),
         '/#chat'
  from public.franchisees f
  where f.location_id = ch.location_id
    and f.status = 'active'
    and f.id <> new.author_id;

  if author.role not in ('admin', 'owner') then
    insert into public.notifications (audience, kind, title, body, link)
    values ('admins', 'chat',
            ch.space_name || ' · #' || ch.name,
            author.name || ': ' || left(new.body, 100),
            '/#chat');
  end if;
  return new;
end $$;

-- ---- lifecycle: creator becomes owner + #hubname channel appears ----
create or replace function public.hub_slug(t text)
returns text language sql immutable as $$
  select trim(both '-' from lower(regexp_replace(t, '[^a-zA-Z0-9]+', '-', 'g')))
$$;

create or replace function public.on_hub_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.hub_members (hub_id, franchisee_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict (hub_id, franchisee_id) do update set role = 'owner';

  insert into public.chat_channels (hub_id, name, sort_order)
  values (new.id, public.hub_slug(new.name), 1)
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists hub_created on public.hubs;
create trigger hub_created
  after insert on public.hubs
  for each row execute function public.on_hub_created();

-- renaming the hub renames its #channel to match
create or replace function public.on_hub_renamed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.name is distinct from old.name then
    update public.chat_channels
    set name = public.hub_slug(new.name)
    where hub_id = new.id and name = public.hub_slug(old.name);
  end if;
  return new;
end $$;

drop trigger if exists hub_renamed on public.hubs;
create trigger hub_renamed
  after update of name on public.hubs
  for each row execute function public.on_hub_renamed();
