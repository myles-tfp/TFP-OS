-- ============================================================
-- TFP OS — 0019: chat notification fix for the owner role
-- The chat trigger only excluded role 'admin' from the "ping HQ"
-- notification, so owner messages pinged the admin bell (yourself).
-- Additive only (replaces one function). Run after 0018. Safe to re-run.
-- ============================================================

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

  -- owners are admins too — don't ping HQ about HQ's own messages
  if author.role not in ('admin', 'owner') then
    insert into public.notifications (audience, kind, title, body, link)
    values ('admins', 'chat',
            ch.location_name || ' · #' || ch.name,
            author.name || ': ' || left(new.body, 100),
            '/#chat');
  end if;
  return new;
end $$;
