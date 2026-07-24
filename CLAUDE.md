# TFP OS — project guide for Claude

Private operations platform for The Flying Pickle franchisees. HQ (admins)
post updates, resources, and manage per-location onboarding boards;
franchisees log in to run their location.

## Stack & pipeline
- Next.js App Router (TypeScript), plain CSS in `app/globals.css` (no Tailwind)
- Supabase: auth + Postgres (RLS everywhere) + storage (public `media` bucket)
- Vercel: continuous deployment from `main` — every push auto-deploys
- The owner (Myles, myles@theflyingpickle.com) is non-technical. He runs all
  SQL himself in the Supabase SQL editor. Hand him numbered migration
  scripts pasted in chat as one block, safe to re-run, and also commit them
  to `supabase/migrations/`. Never assume you can run SQL directly.

## Hard rules
- Run `next build` successfully BEFORE every push. Never push unverified code.
- Never commit secrets. Env vars: `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY` (in `.env.local` + Vercel).
- RLS on every table AND table grants to `authenticated` (error 42501 =
  missing grants — this bit us once).
- Content/categories are data, not code (topics table drives the sidebar).
- Brand: colors + fonts in `globals.css` (Bebas Neue headings, Poppins body,
  navy #07243E bg, Erne #0D3038 panels, Dillball lime #BEE515 accent).
  Frosted-glass animated sidebar is the signature; everything else solid
  and calm. Never restyle the logo.
- After each push, give Myles plain-English browser test steps.

## Architecture map
- Auth: allowlist = `franchisees` table; DB trigger blocks non-roster
  signups; `lib/get-franchisee.ts` gates every page and signs out
  non-roster users. Roles: `franchisee` | `admin`.
- Topics ("boards") = unified channels + resource categories. Board pages
  (`/boards/[topic]`) show posts + resources for one topic. `status`
  column drives "coming soon" graying in the sidebar.
- Feed: posts + emoji reactions; a reaction = a read receipt. Admins see
  who reacted (hover) and read stats (admin page).
- Phases/tasks: Monday-style per-franchisee onboarding boards. Template
  board = rows with `franchisee_id null`, auto-copied to new franchisees
  by trigger. Marketing-tagged phases power the Marketing tab plan cards.
- Saves: per-user favorites of posts/resources (`/saved`).
- Notifications: table + DB triggers; bell in `components/notification-bell.tsx`;
  seen-tracking via `franchisees.notifications_seen_at` + rpc
  `mark_notifications_seen()`.
- Rally: mascot assistant (`components/rally.tsx`, `rally-icon.tsx`).
  Currently "Lite": keyword search over resources/posts, no LLM. Planned:
  Anthropic API brain answering only from TFP content.
- Admin (`/admin`): locations overview grid, post composer (preview,
  embeds, uploads), resource form (upload w/ overwrite-by-filename,
  collections), board manager, roster manager, read tracking.

## Migrations so far (never re-run 0002/0003 — superseded by 0004)
0001 franchisees/allowlist · 0002 feed · 0003 resources · 0004 boards+storage
· 0005 saves · 0006 founding_members · 0007 phases/tasks · 0008 collections
· 0009 notifications

## Parked / next up
- Task comments + replies (deliberately deferred)
- Rally AI brain (needs Anthropic API key from Myles)
- Custom domain os.theflyingpickle.com (CNAME + Supabase URL config update)
- Phase 2 from the brief: Google Drive folder mirroring (`resources.drive_ref`
  is ready), PlayByPoint metrics, richer onboarding checklist
