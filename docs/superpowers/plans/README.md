# Firestorm Implementation Plans — Roadmap

The MVP slice from `docs/superpowers/specs/2026-04-24-firestorm-design.md` is decomposed into a sequence of plans. Each plan ships something real and de-risks the next. Write and execute one plan at a time.

## Plan order

### Plan A — Scaffold + content pipeline

Next.js (App Router) + TypeScript + Phaser 3 + Supabase clients + Zod + Zustand + Vitest + lint/format + CI. YAML content loader with Zod-validated schemas for damage-types, towers, creeps, maps, and waves. Build-time validation. One minimal end-to-end content fixture so loaders have something real to chew on.

**End state:** `npm run dev` boots a placeholder Next.js page. `npm test` passes. `npm run validate-content` validates all YAML in `content/`. CI runs lint + typecheck + tests + content validation on every push. **No game yet.**

File: `docs/superpowers/plans/2026-04-24-plan-a-scaffold-and-content.md`

---

### Plan B — Deterministic sim core

Pure-TypeScript simulation in `src/game/sim/` with no Phaser, no DOM, no `Date.now`, no `Math.random`. Fixed-timestep `(state, inputs, dt) → newState` loop. Seeded RNG. Sim state shape covers: map path, towers, creeps, projectiles, cash, lives, round phase, current round, RNG state. Inputs cover: place/upgrade/sell/retarget tower, start round, set speed, pause. Combat resolution with damage-type matrix. Wave spawner reads from loaded wave content. Replay-friendly input log captured per tick.

**End state:** Vitest suite drives a headless run end-to-end on a fixture map: tower kills creep, creep leaks and reduces lives, full wave plays out, round resolves to win/lose. Pure Node, no browser.

---

### Plan C — Phaser render layer + bridge + minimal run UI

Phaser 3 in `src/game/render/`. One `GameScene` that reads sim state and draws the map background, path, creeps, towers, projectiles. Typed event bus (`src/game/bridge/events.ts`) and Zustand store (`src/game/bridge/store.ts`). React⇄Phaser contract: Phaser pushes HUD-relevant state into the store; React dispatches player intents on the event bus; Phaser translates them into sim inputs at the next tick. Minimal React HUD (cash, lives, round) and a hardcoded "place tower" button — enough to play a single round in a browser.

**End state:** `npm run dev`, navigate to `/play`, see one map with one wave running, click to place a tower, watch it shoot creeps. Placeholder art is fine.

---

### Plan D — Full run UI + map-select

React DOM components for: map-select screen, tower shop side panel, upgrade panel (with sell + retarget priority), pause menu, run-end screen, full HUD (round counter, speed toggle 1×/2×, start-round-early button). Placement ghost preview with valid/invalid mask check. Mid-round place/upgrade/sell/retarget all wired through. Win/lose detection from sim state.

**End state:** A logged-out / guest player can pick either of the two MVP maps on Easy and play a complete run from round 1 to 40. No accounts, no leaderboards. Game is fully playable as a single-player experience.

---

### Plan E — Auth + profile

Supabase Auth: email/password + Google OAuth + magic link, SSR-aware via `@supabase/ssr`. Account routes: sign-up, sign-in, callback, sign-out. Auto-create `profiles` row on first sign-in. Header UI showing logged-in state. Guest play continues to work; signed-in play attaches `user_id` to runs.

**End state:** A user can sign up, sign in, and see their profile. Runs they complete while signed in are persisted to the `runs` table (writes via the score-submit API route, scaffolded but not yet doing leaderboard upsert).

---

### Plan F — Leaderboards + score submission

`/api/runs` POST handler with full validation (auth required, plausible ranges, duration ≥ map minimum, `roundsCompleted` ≤ map max). Insert into `runs`, upsert into `leaderboard_entries`. RLS policies for all tables. Per-map per-difficulty leaderboard read endpoint and React leaderboard page. Run-end screen offers "submit score" for signed-in users; shows leaderboard placement.

**End state:** Signed-in users complete a run, submit a score, and see themselves on the leaderboard. MVP is shippable.

---

## Parallel content authoring stream (not a coding plan)

Driven by the project owner alongside Plans B–D as a non-code workstream. Tracked here so it doesn't get forgotten.

- **Damage type matrix balance:** decide damage types and resistance classes for the MVP roster; populate `content/damage-types.yaml` with sensible multipliers; iterate based on playtest.
- **Tower roster:** design 6 launch towers covering the chosen damage types and projectile behaviors; specify base stats and 2–4 linear upgrade nodes each; author YAML.
- **Creep roster:** design 8–10 discrete creep types across resistance classes and HP/speed bands; one with `spawnOnDeath`; author YAML.
- **Map data:** trace the path polyline for each example map; author placement masks; specify per-difficulty starting cash/lives.
- **Easy wave authoring:** 40 waves per map. Iterate against the sim once Plan B is in. Hard waves stubbed (empty list is fine until Slice 2).
- **Art sourcing:** find/generate vector sprites consistent with the BTD6-inspired style; settle a sprite spec (canvas size per type, palette, line weight, perspective) early so mixed sources don't look like a collage.

---

## Out of scope for MVP

Tracked in `Section 5.3 Backlog` of the design spec. Do not pull anything from there into a plan without revisiting the spec first.
