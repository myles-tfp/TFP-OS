-- ============================================================
-- TFP OS — 0006: founding-members count per franchisee
-- (admin-entered for now; PlayByPoint feeds this in phase 2)
-- Run after 0005. Safe to re-run.
-- ============================================================

alter table public.franchisees
  add column if not exists founding_members int;
