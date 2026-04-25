# Plan F — Leaderboards + score submission

## Pre-existing

- Migration `0001_auth_and_runs.sql`: `profiles`, `runs` (+ RLS: read-own / insert-own).
- `POST /api/runs`: Zod validation (`RunSubmissionSchema`), auth via `createSupabaseServerClient`, basic `roundsCompleted ≤ totalRounds` check, inserts row.
- `RunEnd.tsx`: posts to `/api/runs` once when run resolves and the user is signed in.

## What this plan adds

1. **Migration `0002_leaderboards.sql`** — `leaderboard_entries (user_id, map_id, difficulty, rounds_completed, lives_remaining, duration_seconds, run_id, updated_at)` with PK `(user_id, map_id, difficulty)`. RLS: public select, no direct insert/update (writes go through service-role inside `/api/runs`).
2. **Stronger server-side validation in `POST /api/runs`** — load content, verify `mapId`/`difficulty` exist, clamp `totalRounds` to wave count, require `durationSeconds ≥ totalRounds * MIN_SECONDS_PER_ROUND` (3s baseline), `roundsCompleted ≤ wave count`, `livesRemaining ≤ map.startLives`.
3. **Leaderboard upsert** on successful win (or any run, ranked) — keep best entry per `(user, map, difficulty)`. Ranking key: higher `rounds_completed` → higher `lives_remaining` → lower `duration_seconds`.
4. **`GET /api/leaderboard?mapId=&difficulty=`** — top N entries joined with `profiles.display_name`.
5. **`/leaderboard` page** + per-map links from map-select.
6. **RunEnd placement** — after submit, show user's rank.

## Out of scope

- Anti-cheat beyond plausibility ranges. (Replay verification stays parked behind `runs.input_log`.)
- Pagination beyond top N.

## Steps

1. Migration file.
2. Backend: refactor `route.ts` to compute ranking + upsert. Add helper for plausibility against content.
3. `GET /api/leaderboard` route.
4. `/leaderboard` page (server component, reads anonymously).
5. RunEnd — read placement after POST response.
6. Run typecheck + tests.
