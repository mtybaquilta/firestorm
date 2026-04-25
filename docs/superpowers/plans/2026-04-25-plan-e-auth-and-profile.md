# Plan E — Auth + Profile

Add Supabase Auth so signed-in players can persist runs. Guest play continues to work unchanged.

## Scope

- Supabase database: `profiles` and `runs` tables with RLS. `runs.input_log` JSONB column reserved (nullable) for future replay verification.
- `@supabase/ssr` middleware for session refresh on every request.
- Auth pages: `/auth/sign-in`, `/auth/sign-up`, `/auth/callback`, `/auth/sign-out`. Email/password + magic link + Google OAuth.
- Auto-create `profiles` row on first sign-in (Postgres trigger).
- Header component on every page showing logged-in state with sign-in / sign-out controls.
- `/api/runs` POST handler — auth required, basic sanity validation, inserts into `runs`. Leaderboard upsert deferred to Plan F.
- `RunEnd` component submits the run when the player is signed in.

## Out of scope

- Leaderboard upsert + read (Plan F).
- Rich profile UI / avatar / display name editing.
- Password reset / email change flows.

## Tasks

1. SQL migration file `supabase/migrations/0001_auth_and_runs.sql`: `profiles` table, `runs` table (with `input_log JSONB NULL`), RLS enabled on both, trigger to insert a `profiles` row from `auth.users` on signup. Document that the user runs this in their Supabase project.
2. Update `src/lib/supabase/types.ts` to describe `profiles` and `runs`.
3. Add `middleware.ts` at the project root using `@supabase/ssr` `createServerClient` to refresh the session cookie.
4. Add `src/lib/supabase/session.ts` helper: `getSession()` reads the current user via the server client.
5. Add `src/components/Header.tsx` (server component) — shows "Sign in" link or signed-in email + sign-out form.
6. Mount `<Header />` in `src/app/layout.tsx`.
7. Add `/auth/sign-in/page.tsx` — client component with email/password form, magic link form, Google button.
8. Add `/auth/sign-up/page.tsx` — client component with email/password form.
9. Add `/auth/callback/route.ts` — exchanges OAuth/magic-link `?code` for a session, redirects to `/`.
10. Add `/auth/sign-out/route.ts` — POST handler that calls `signOut` and redirects to `/`.
11. Add `src/app/api/runs/route.ts` — POST: requires auth, validates body with Zod, inserts a `runs` row.
12. Wire `RunEnd` to call `/api/runs` once on result, only when `result !== 'in-progress'` and the user is signed in. Provide signed-in flag via a `useSession` hook backed by the browser client.
13. Add Vitest unit tests for the `/api/runs` Zod body schema (happy path + rejections).
14. Manual smoke: `/`, `/auth/sign-in`, `/auth/sign-up` all 200; lint/typecheck/test all green.

## End state

A user can sign up, sign in (email/password, magic link, or Google), and see their email in the header. Completing a run while signed in writes a row to `runs`. Guest runs still work and write nothing.
