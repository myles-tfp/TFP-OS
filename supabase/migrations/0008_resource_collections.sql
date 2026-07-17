-- ============================================================
-- TFP OS — 0008: resource collections + Playbooks -> Resources
-- Run after 0007. Safe to re-run.
-- ============================================================

-- Collections group resources within a board (Playbooks & Guides,
-- Content, Design, Canva ...). Plain text so new ones are just data.
alter table public.resources
  add column if not exists collection text;

-- Rename the Playbooks board to Resources (sidebar updates automatically)
update public.topics set name = 'Resources' where name = 'Playbooks';
