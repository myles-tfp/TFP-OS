-- ============================================================
-- TFP OS — 0018: PlayByPoint integration
-- Tables for incoming membership webhooks + facility mapping.
-- Additive only. Run after 0017. Safe to re-run.
-- ============================================================

-- Which PlayByPoint facility feeds this location (their facility
-- ID or exact facility name — either works)
alter table public.locations add column if not exists pbp_facility text;

-- One row per founders membership — the source of truth for counts.
-- Keyed by PlayByPoint's membership id so webhook retries can
-- never double-count.
create table if not exists public.pbp_members (
  membership_id text primary key,
  location_id   uuid not null references public.locations(id) on delete cascade,
  user_email    text,
  user_name     text,
  plan_name     text,
  status        text not null default 'active',
  created_at    timestamptz not null default now(),
  cancelled_at  timestamptz
);

-- Raw event log for debugging / audit (idempotent by webhook_id)
create table if not exists public.pbp_events (
  webhook_id  text primary key,
  event       text not null,
  facility    text,
  payload     jsonb,
  received_at timestamptz not null default now()
);

grant select on public.pbp_members to authenticated;
grant select on public.pbp_events to authenticated;
grant all on public.pbp_members to service_role;
grant all on public.pbp_events to service_role;

alter table public.pbp_members enable row level security;
alter table public.pbp_events enable row level security;

drop policy if exists "admins read pbp members" on public.pbp_members;
create policy "admins read pbp members"
  on public.pbp_members for select to authenticated
  using (public.is_admin() or location_id = public.current_location_id());

drop policy if exists "admins read pbp events" on public.pbp_events;
create policy "admins read pbp events"
  on public.pbp_events for select to authenticated
  using (public.is_admin());
