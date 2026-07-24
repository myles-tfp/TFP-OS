-- ============================================================
-- TFP OS — 0014: edit chat messages (3-minute window)
-- Run after 0013. Safe to re-run.
-- ============================================================

alter table public.chat_messages
  add column if not exists edited_at timestamptz;

-- Authors can edit their own messages for 3 minutes after sending;
-- the clock is enforced by the database, not the UI.
drop policy if exists "edit own recent messages" on public.chat_messages;
create policy "edit own recent messages"
  on public.chat_messages for update to authenticated
  using (
    author_id = public.current_franchisee_id()
    and created_at > now() - interval '3 minutes'
  )
  with check (author_id = public.current_franchisee_id());
