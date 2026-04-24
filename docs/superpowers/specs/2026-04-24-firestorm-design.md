# Firestorm — Game Design Spec

**Date:** 2026-04-24
**Status:** Draft for review
**Scope:** Whole-game design + MVP slice definition for Firestorm, a round-based tower defense game.

---

## 1. Vision & Pillars

Firestorm is a desktop-web, round-based tower defense game in the BloonsTD lineage but with its own identity. Players pick a map and difficulty, place and upgrade towers from a roster of ~10–12 distinct units, defend against ~40 (Easy) or ~60 (Hard) hand-authored waves of discrete creep types, and compete on per-map leaderboards.

It is built as a _real game_ with accounts, cloud-saved progress, and a long-term meta-progression ladder (tower unlocks, account-wide passive upgrades, tower XP, achievements, daily challenges, profile level/prestige). The launch (MVP) ships only the core run loop + leaderboards; meta-currency accumulates silently for a future spendable shop.

**Design pillars**

1. **Strategy over reflexes.** Damage types vs. creep resistances create real counter-picking decisions. Mid-round placement is allowed, but the game rewards planning between rounds, not panic-clicking.
2. **Clarity over chrome.** Discrete creep types with legible identities. Wave previews tell you what's coming. No hidden mechanics.
3. **Doors left open.** Flat upgrades now, but data models support multi-path trees. Cash-only economy now, but meta-currency persists. Single-difficulty MVP slice possible, but Easy/Hard authored from the start. Deterministic engine for future replay/verification. Ground-only at launch, but a movement-layer field exists from day one.
4. **Polish on what ships.** Two maps at launch, but they look and feel finished — not 20 half-finished maps.

---

## 2. Game Mechanics

### 2.1 The run loop

Player picks a map + difficulty from the map-select screen. Loads into a run with that map's starting cash and lives (per-difficulty). The HUD shows: cash, lives, current round / total rounds, game speed (1×/2×), pause button, and "start next round" button. The tower shop is a side panel listing all currently-unlocked towers with cost and a brief tooltip.

### 2.2 Placement

Player clicks a tower in the shop, then clicks the map to place it. While placing, a ghost preview follows the cursor showing range and whether the spot is valid (against the map's placement mask — no path, no water, no decoration). Click to confirm, ESC or right-click to cancel. After placement, clicking an existing tower opens an upgrade panel showing its current stats, the next upgrade's cost and stat delta, a sell button (70% refund), and a targeting-priority dropdown (First / Last / Strong / Close).

### 2.3 Combat

Towers autotarget creeps in range according to their priority setting. Each tower has: damage, damage type, attack speed, range, projectile behavior (single-target / splash / piercing / chain / DoT / slow-debuff / support-buff). Creeps walk the path at their speed, take damage based on `damage × typeVsResistanceMultiplier`, and drop bounty cash on kill. Some creeps have abilities (regen, shield, spawn-on-death). When a creep reaches the path end, it costs the player lives equal to its leak value. 0 lives = run lost.

### 2.4 Round flow

Between rounds the game is paused on a "next round" button; the player builds, upgrades, plans, and sees a preview of the next wave's creep composition. Pressing "start next round" begins the wave (with a small cash bonus if pressed before the previous wave fully ends). Mid-round: place, upgrade, sell, retarget, pause, and speed toggle are all fully allowed. After round N (40 Easy / 60 Hard), the run resolves: win → save score, award meta-currency, post to leaderboard. Lose → run-end screen with stats, no leaderboard submission.

### 2.5 Damage type system

Towers deal one of several damage types (e.g. physical, magic, fire, ice — exact roster designed during detailed design). Creeps have resistances/weaknesses per type as a multiplier table. A "true damage" type ignores resistances, used sparingly on premium upgrades. This is the strategic backbone — no tower is universally optimal, composition matters.

### 2.6 Determinism

All game logic runs on a fixed-timestep simulation with a seeded RNG. Render is decoupled from simulation. No wall-clock or `Math.random()` in gameplay code. Run start records the seed; every player action (place, upgrade, sell, retarget, start-round, target-change) is timestamped against simulation tick. The recording is _captured_ at MVP but not yet _used_ for verification — the door stays open for future replay/verification.

---

## 3. Content & Data

Content lives as static YAML/JSON in the repo, organized for both human authoring (designer can edit a wave file and reload) and machine consumption (typed loaders validate at build time).

```
content/
  towers/                 # one file per tower
  creeps/                 # one file per creep
  damage-types.yaml       # type matrix: damage type × resistance class → multiplier
  maps/
    in-the-loop/
      map.yaml
      waves-easy.yaml
      waves-hard.yaml
    logs/
      map.yaml
      waves-easy.yaml
      waves-hard.yaml
```

### 3.1 Tower schema (sketch)

```
id, name, cost,
damageType,
targetableLayers: ["ground"]            # default; can include "water" / "air" later
baseStats { damage, attackSpeed, range, projectileBehavior, ... }
targetingDefaults
upgrades: [ { id, requires: [...], cost, statDeltas, ... } ]   # graph of nodes
```

Every launch tower has a single linear chain of upgrade nodes (A → B → C → D), but the data shape is a graph — adding multi-path trees later is a content change, not a code change.

### 3.2 Creep schema (sketch)

```
id, name,
hp, speed,
movementLayer: "ground"                  # default; "water" / "air" reserved
resistanceClass,                         # which row of the matrix applies
bounty, leakDamage,
abilities: [ { type, ...params } ]       # open enum
```

Examples of abilities: `{ type: "regen", rate: 5 }`, `{ type: "shield", hp: 100 }`, `{ type: "spawnOnDeath", spawn: "scout", count: 3 }`. Future abilities (invisibility, immunity-to-X, flying behavior) slot in without schema churn.

### 3.3 Map schema (sketch)

```
id, name,
background,                              # image path
path,                                    # ordered points; Phaser turns into Path/Curve
placementMask,                           # image (black = blocked) or polygon set
waterPath?                               # optional, reserved for future water-layer creeps
difficulty:
  easy:  { startCash, startLives, waves: "waves-easy.yaml" }
  hard:  { startCash, startLives, waves: "waves-hard.yaml" }
```

### 3.4 Wave schema (sketch)

```
waves:
  - groups:
      - { creep: "scout", count: 10, spacing: 0.6, delay: 0 }
      - { creep: "tank",  count: 2,  spacing: 1.5, delay: 8 }
  - groups:
      ...
```

Designer-friendly to author; the simulation just iterates.

### 3.5 Damage type matrix

A YAML 2D table: rows = damage types, columns = resistance classes, cells = multiplier (1.0 = neutral, 0.5 = resisted, 1.5 = weak, 0 = immune). One file, easy to balance-tune.

### 3.6 Validation

Content is loaded and validated against Zod schemas at app boot, and ideally at build time as a CI check. Broken content fails loudly with a clear error rather than crashing mid-run.

---

## 4. Tech Architecture

### 4.1 Stack

Next.js (App Router) on Vercel. React for all DOM UI. Phaser 3 for the canvas. Supabase for auth + database. TypeScript throughout. Zod for content & API schema validation. Zustand (or similar lightweight store) for the React⇄Phaser shared state.

### 4.2 Repo shape (sketch)

```
src/
  app/                    # Next.js routes: marketing, auth, /play, /leaderboards, /profile
  components/             # React DOM: HUD, menus, shop, upgrade panel, pause, run-end
  game/
    sim/                  # pure deterministic simulation (no Phaser deps)
    render/               # Phaser scenes, sprites, FX
    bridge/               # event bus + shared store contract
  content-loader/         # Zod-validated loaders, content registry
  lib/
    supabase/             # server + browser clients
    api/                  # API route handlers (score submit, etc.)
content/                  # static YAML game content
```

### 4.3 The sim/render split

The key split inside `game/` is **`sim/` is pure** — no Phaser, no DOM, no `Date.now`, no `Math.random`. It takes `(state, inputs, dt) → newState` on a fixed timestep. `render/` reads sim state and draws it. This is what makes determinism + future replay possible, and it makes the sim unit-testable in plain Node.

### 4.4 React ⇄ Phaser boundary

A typed event bus (e.g. `mitt` or a tiny custom one) plus a Zustand store. Rules of the road:

- **Phaser → React (via store):** HUD-relevant state only — cash, lives, current round, round phase (between/active), selected tower id, run status. Phaser pushes these on change; React subscribes and re-renders.
- **React → Phaser (via event bus):** player intents — `placeTower`, `upgradeTower`, `sellTower`, `setTargeting`, `startNextRound`, `setSpeed`, `pause`, `resume`. Phaser's input layer translates these into sim inputs at the correct tick.
- React **never** touches Phaser scenes directly; Phaser **never** touches the DOM. One owner per side.

### 4.5 Auth

Supabase Auth with email/password + Google OAuth + magic link. SSR-aware via `@supabase/ssr` so server components can read the session. A guest-play path exists (no account needed to play; account needed to submit to leaderboards / earn meta-currency persistently).

### 4.6 Database (sketch)

Supabase Postgres with RLS:

- `profiles` — one per user: display name, level, xp, prestige, meta-currency balance.
- `tower_unlocks` — `(user_id, tower_id, unlocked_at)`. Schema in place; everything unlocked at MVP.
- `tower_xp` — `(user_id, tower_id, xp)`. Schema in place; not earned-against at MVP.
- `achievements` — `(user_id, achievement_id, progress, completed_at)`. Schema in place; not active at MVP.
- `runs` — `(user_id, map_id, difficulty, result, rounds_completed, lives_remaining, duration_ms, seed, completed_at, input_log JSONB nullable)`.
- `leaderboard_entries` — denormalized per-map per-difficulty best score per user, for fast reads.
- `daily_challenges` + `daily_challenge_runs` — schema in place; not active at MVP.

RLS: profiles readable by anyone (for leaderboard display), writable only by owner. Runs writable only via the score-submit API route (using the service-role key), readable by owner. Leaderboards readable by all.

### 4.7 Score submission

Client `POST /api/runs` with `{ mapId, difficulty, seed, result, roundsCompleted, livesRemaining, durationMs, startedAt, finishedAt }`. The route validates: user authenticated, fields shaped, plausible ranges, duration ≥ a per-map minimum (so a 0-second clear can't be submitted), `roundsCompleted` ≤ map max. On pass, insert into `runs` and upsert `leaderboard_entries`.

**Anti-cheat posture.** MVP = sanity checks only (catches casual cheaters; determined ones will get past it). Long-term goal = full input-log recording + server-side replay verification. The engine is built deterministically from day one to keep that door open; the `runs.input_log` column is reserved.

### 4.8 Hosting / env

Vercel for the Next.js app. Supabase managed. Environment variables for Supabase URL + anon + service-role keys. Static content bundled with the app (no runtime CDN fetch needed).

---

## 5. MVP Slice & Roadmap

The whole-game design above is the target. The **MVP slice** is the smallest version that's a real, playable, shippable game — not a tech demo. Everything else is parked behind it.

### 5.1 MVP — "Firestorm 0.1"

- Next.js + Phaser + Supabase scaffolded; deterministic sim/render split in place from day one.
- **Two maps** (the two examples — `In The Loop` and `Logs`), **Easy difficulty only** (40 hand-authored waves each).
- **One placement model** — free-form with mask.
- **6 towers** (out of the eventual 10–12) — enough to express the damage-type system meaningfully (e.g. one each of: single-target physical, splash physical, magic single-target, fire DoT, ice slow, support buff). All flat upgrades, modeled as the graph data structure.
- **~8–10 creep types** with the discrete model and resistance-class system. One creep with `spawnOnDeath` to validate that pathway. Ground-only.
- **Damage type matrix** populated and balanced for the MVP roster.
- **Full run loop:** map select → run → win/lose screen.
- **HUD + shop + upgrade panel + pause + 1×/2× speed + start-round-early + sell + targeting priority.**
- **Guest play works.** Account optional for play.
- **Auth** (email/password + Google + magic link). Logged-in players' runs persist.
- **Per-map per-difficulty leaderboard** (sort: `roundsCompleted` desc, `livesRemaining` desc, `durationMs` asc). Score submission via API route with sanity checks.
- **Schemas in place but unused for:** meta-currency wallet (accrues, can't spend), Hard difficulty (wave files exist as stubs), tower XP, achievements, daily challenges, profile level, tower unlocks (all unlocked at MVP).

### 5.2 Post-MVP roadmap (rough dependency order)

**Slice 2 — More content & Hard difficulty.** Fill towers to 10–12. Author Hard wave files for both maps. Expand creep roster. Tune damage matrix.

**Slice 3 — Meta-progression activated.** Tower unlocks gate (start with 4 of 10–12, unlock by play). Account-wide passive shop spending meta-currency. Profile level + XP from runs.

**Slice 4 — Tower XP + achievements.** Per-tower XP, achievement system, achievement-driven rewards.

**Slice 5 — Daily challenges.** Server-defined daily seed/modifier, per-day leaderboard.

**Slice 6 — Replay & verification.** Activate the input-log recording the engine's been doing all along. Server-side replay verification for leaderboard integrity. Replay viewer as a UI feature.

### 5.3 Backlog (no committed slice yet)

- Air/water movement layers and matching towers.
- Multi-path tower upgrade trees (BTD-style 3×5).
- More maps + a map authoring/editor flow.
- Boss waves with unique mechanics.
- Mobile/touch support.
- PWA / offline.
- Events / seasons on top of daily challenges.
