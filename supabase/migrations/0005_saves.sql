-- ============================================================
-- TFP OS — 0005: saves (favorites for posts + resources)
-- Run after 0004. Safe to re-run.
-- ============================================================

create table if not exists public.saves (
  id            uuid primary key default gen_random_uuid(),
  franchisee_id uuid not null references public.franchisees(id) on delete cascade,
  post_id       uuid references public.posts(id) on delete cascade,
  resource_id   uuid references public.resources(id) on delete cascade,
  created_at    timestamptz not null default now(),
  check ((post_id is null) <> (resource_id is null)),
  unique (franchisee_id, post_id),
  unique (franchisee_id, resource_id)
);

grant select, insert, update, delete on public.saves to authenticated;
grant all on public.saves to service_role;

alter table public.saves enable row level security;

drop policy if exists "own saves select" on public.saves;
create policy "own saves select"
  on public.saves for select to authenticated
  using (franchisee_id = public.current_franchisee_id());

drop policy if exists "own saves insert" on public.saves;
create policy "own saves insert"
  on public.saves for insert to authenticated
  with check (franchisee_id = public.current_franchisee_id());

drop policy if exists "own saves delete" on public.saves;
create policy "own saves delete"
  on public.saves for delete to authenticated
  using (franchisee_id = public.current_franchisee_id());
