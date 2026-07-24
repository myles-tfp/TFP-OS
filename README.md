# TFP OS

Private operations platform for The Flying Pickle franchisees. Franchisor (HQ) posts updates and resources; franchisees log in to get everything they need to run their location.

**Stack:** Next.js (App Router) · Supabase (auth + data) · Vercel (hosting) · Google Drive + PlayByPoint (phase 2)

## Status — build order

- [x] **1. App shell + brand + auth** — frosted-glass sidebar, brand tokens (Bebas Neue / Poppins), Supabase Auth with email allowlist
- [ ] 2. Supabase schema + RLS (feed, resources)
- [ ] 3. Home feed (posts + reactions as read-tracking)
- [ ] 4. Resource library (data-driven categories, Marketing first)
- [ ] 5. Admin dashboard
- [ ] 6. Home dashboard assembly

## Local development

```bash
npm install
cp .env.example .env.local   # fill in your Supabase URL + anon key
npm run dev
```

## Supabase setup

1. Run `supabase/migrations/0001_franchisees_allowlist.sql` in the Supabase SQL editor. This creates the `franchisees` roster (which doubles as the login allowlist), RLS policies, and a trigger that rejects signups from emails not on the roster.
2. Add franchisees by inserting rows into `franchisees` (the admin dashboard will manage this in a later step).
3. Optional but preferred: enable Google under **Auth → Providers** and add your site URL + `https://YOUR-SITE/auth/callback` to the redirect allowlist under **Auth → URL Configuration**. Email/password works without any extra setup.

## Deploying to Vercel

Connect the GitHub repo to Vercel (auto-deploy on push). `Vercel auto-detects Next.js — no config needed. Set two environment variables in Site settings:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## How the allowlist works

Access is controlled by the `franchisees` table, not code:

1. A DB trigger on `auth.users` rejects any signup (Google or email/password) whose email isn't an active roster row.
2. The app layout looks up the signed-in user's roster row; if it's missing or inactive, the user is signed out. Removing someone's row (or setting `status = 'inactive'`) revokes access.
3. `role` (`franchisee` | `admin`) drives what's visible — admins see the Admin nav; the structure supports more roles later.

## Brand system

Tokens live in `app/globals.css` (colors from the Flying Pickle Brand Playbook: Drop-in navy, Erne, Dillball lime, Bert teal, etc.). Headings are Bebas Neue; body is Poppins (both via `next/font`). The frosted-glass animated sidebar is the signature visual — everything else stays solid and calm. Never stretch, rotate, recolor, or outline the logo.
