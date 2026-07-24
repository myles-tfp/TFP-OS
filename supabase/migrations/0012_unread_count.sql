-- ============================================================
-- TFP OS — 0012: unread chat count for the sidebar badge
-- Run after 0011. Safe to re-run.
-- ============================================================

create or replace function public.unread_chat_count()
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int
  from public.chat_messages m
  join public.chat_channels c on c.id = m.channel_id
  where (public.is_admin() or c.location_id = public.current_location_id())
    and m.author_id is distinct from public.current_franchisee_id()
    and m.created_at > coalesce(
      (select r.last_read_at from public.chat_reads r
       where r.channel_id = m.channel_id
         and r.franchisee_id = public.current_franchisee_id()),
      'epoch'::timestamptz
    );
$$;
