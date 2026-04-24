# Firestorm — Claude Working Notes

## Project

Firestorm is a desktop-web round-based tower defense game. Stack: Next.js (App Router) on Vercel, React for DOM UI, Phaser 3 for the canvas, Supabase for auth + DB, TypeScript throughout.

Authoritative design: `docs/superpowers/specs/2026-04-24-firestorm-design.md`. Read it before doing implementation work.

## Workflow rules

- **Do not use git worktrees.** Work directly on a branch in the main project folder. There is no need to duplicate the workspace.
- **Branch naming:** `FS-<n>` where `<n>` is an incremental number (e.g. `FS-1`, `FS-2`).
- **Commit messages** must start with the same prefix as the branch: `FS-<n>: <message>` (e.g. `FS-2: Initial Firestorm game design spec`).

## Skills to use

- **`phaser-gamedev`** — invoke whenever working on anything Phaser-side: scenes, sprites, physics, tilemaps, animations, input, game architecture, the `src/game/` tree.
- **`context7`** (`mcp__plugin_context7_context7__query-docs` / `resolve-library-id`) — use for up-to-date docs on any library/framework/SDK touched: Phaser, Next.js, React, Supabase, `@supabase/ssr`, Zod, Zustand, Vercel. Prefer it over web search and over relying on training-data memory for library APIs.

## Architectural rules (from the spec — don't drift)

- **`src/game/sim/` is pure.** No Phaser, no DOM, no `Date.now`, no `Math.random`. Fixed-timestep `(state, inputs, dt) → newState`. This is what makes determinism + future replay possible. Do not put rendering or I/O here.
- **`src/game/render/` reads sim state and draws.** Phaser lives here.
- **React ⇄ Phaser boundary:** Phaser → React via a shared store (HUD state only). React → Phaser via a typed event bus (player intents only). React never touches Phaser scenes; Phaser never touches the DOM.
- **Content lives as static YAML in `content/`** and is validated with Zod at load time.
- **Score submission goes through `/api/runs`** with sanity checks. Never let the client write to `runs` / `leaderboard_entries` directly.

## Open doors (design now, ship later)

Don't close these off:
- Tower upgrades modeled as a graph (linear chains at MVP, multi-path trees later).
- `movementLayer` on creeps and `targetableLayers` on towers (ground-only at MVP).
- `runs.input_log` column reserved for future replay verification.
- Meta-currency wallet accrues at MVP, even though there's no shop yet.
