# Plan D — Full Run UI + Map-Select

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the in-browser Plan C demo into a complete single-player game. A guest player picks a map from a map-select screen, plays a full run with a real shop / upgrade panel / sell / retarget UI and placement validation, and sees a win or lose screen at the end with a return-to-maps action. No accounts, no leaderboards, no persistence (those are Plans E/F).

**Architecture:**

- New routes: `/` (map-select home), `/play/[mapId]/[difficulty]` (run). The current `/play` placeholder route is removed.
- `PhaserMount` is parameterized — it takes `{ mapId, difficulty }` from the URL and initializes the runner accordingly. Same component, no internal hard-coded map.
- A small UI-only state store extension (`selectedTowerId`) lets the React HUD / upgrade panel know which placed tower the player has clicked.
- Placement validation lives in `src/game/sim/placement.ts` (a new pure module) — for MVP, a tower is valid if its position is more than a tower-blocked-radius away from the path centerline. Real image masks are deferred to the parallel content authoring stream.
- Run-end overlay is a React component that watches `result` from the store and reveals when the run is over.

**Tech Stack:** No new dependencies.

**Branch:** `FS-11`. Each commit prefixed `FS-11: `.

---

## Design notes

### Routing

Next.js App Router with dynamic segments:

```
src/app/
  page.tsx                         # map-select (replaces the default Next welcome page)
  play/
    [mapId]/
      [difficulty]/
        page.tsx                   # mounts GameClient with mapId + difficulty
```

The old `src/app/play/page.tsx` placeholder is removed. Map-select is server-rendered (it just reads content via `loadAllContent`).

### Tower selection vs. placement

Two mutually exclusive UI modes drive Phaser pointer handling:

- `selectedDefId !== null` → **placement mode** (ghost follows cursor; click places).
- `selectedDefId === null` → **selection mode** (click an existing tower to select it; click empty space deselects).

Both lived-in state pieces sit in the existing `HudStore`. We add `selectedTowerId: number | null`. `GameScene` reads the store on `pointerdown` and either emits `intent:placeTower` or sets `selectedTowerId`.

### Upgrade panel

When `selectedTowerId !== null`, an `<UpgradePanel>` appears in the HUD column showing:

- Tower name + current effective stats (damage / range / attack speed).
- The next available upgrade (first node whose prereqs are satisfied) with cost + delta + "Buy" button.
- Targeting priority dropdown (`first` / `last` / `strong` / `close`).
- "Sell ($N refund)" button.
- "Deselect" button (or click empty canvas).

The HUD reads the live `SimState` to compute effective stats. The panel needs read access to `SimState`, not just `HudFields`. We solve this by extending the bridge: `PhaserMount` exposes a `getSimState` callback through a React context, and `<UpgradePanel>` calls it on each render. (A subscription beats a re-derive each frame; we wire `runner.tick` to bump a small counter in the store so React re-renders.)

Concretely: add `revision: number` to `HudFields`, incremented every time `pushHud` fires. The upgrade panel uses `revision` as its render trigger, then reads the latest sim state via the runner ref.

### Placement validation

`isValidPlacement(state, ctx, x, y)` returns boolean. MVP rule: distance from `(x, y)` to the path polyline must be at least `MIN_DISTANCE_FROM_PATH = 24` pixels (radius slightly larger than the path's drawn width / 2). Also: don't allow placement on top of an existing tower (within `TOWER_FOOTPRINT = 24` pixels of an existing tower).

`distanceToPolyline(point, path)` — segment-by-segment shortest distance, pure function. Tested.

The Phaser ghost preview turns red when invalid; click does nothing (we still emit the intent; `applyInput` will see "invalid" in the pure sim and silently drop it — but it's nicer UX to also block in the renderer).

### Run-end overlay

A `<RunEnd>` React component overlays the canvas when `hud.result !== 'in-progress'`. It shows result (Win! / Defeat), final round / lives, and a "Back to maps" button (router push to `/`).

### Restart / back-to-maps

Routing handles this for free: navigating to `/` unmounts `PhaserMount`, the cleanup destroys the Phaser game and runner. Picking a map again creates a fresh runner. No explicit "restart" action needed within the run page; restarting = back to maps then click again.

### Hard difficulty

Hard waves are empty stubs. The map-select shows Hard as disabled (button greyed with tooltip "Coming soon").

### File map

**Created:**

- `src/app/page.tsx` — replace Next's default with map-select.
- `src/app/play/[mapId]/[difficulty]/page.tsx` — run dispatcher.
- `src/components/MapSelect.tsx` — server component, lists maps + difficulty buttons.
- `src/components/UpgradePanel.tsx` — selected-tower panel.
- `src/components/RunEnd.tsx` — win/lose overlay.
- `src/game/sim/placement.ts` — `isValidPlacement` + `distanceToPolyline`.
- `src/game/sim/__tests__/placement.test.ts`

**Modified:**

- `src/app/play/page.tsx` — **deleted** (old placeholder).
- `src/game/bridge/store.ts` — add `selectedTowerId`, `revision`, helpers.
- `src/game/bridge/runner.ts` — bump `revision` on every push; expose `getSimState` for UI consumers.
- `src/game/render/scenes/GameScene.ts` — selection mode (click existing tower → set `selectedTowerId`); ghost color reflects placement validity.
- `src/components/PhaserMount.tsx` — accept `{ mapId, difficulty }` props; thread runner ref through context.
- `src/components/Hud.tsx` — show full HUD (already mostly there); shop iterates all towers; render `<UpgradePanel>` when a tower is selected; render `<RunEnd>` overlay when run is over.
- `src/app/globals.css` — add styles for map-select, upgrade panel, run-end overlay.

---

## Phase 1 — Sim placement validation

### Task 1: Distance-to-polyline + isValidPlacement

**Files:**

- Create: `src/game/sim/placement.ts`, `src/game/sim/__tests__/placement.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadAllContent } from '@/content-loader/load';
import { buildRegistry } from '@/content-loader/registry';
import { distanceToPolyline, isValidPlacement } from '@/game/sim/placement';
import { createInitialState } from '@/game/sim/state';

async function setup() {
  const content = await loadAllContent(path.resolve(__dirname, '../../../../content'));
  const registry = buildRegistry(content);
  const loadedMap = registry.mapsById.get('in-the-loop')!;
  const ctx = { registry, loadedMap };
  const state = createInitialState({ ctx, difficulty: 'easy', seed: 1 });
  return { ctx, state };
}

describe('distanceToPolyline', () => {
  it('returns the perpendicular distance to the nearest segment', () => {
    const polyline = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    expect(distanceToPolyline({ x: 5, y: 3 }, polyline)).toBeCloseTo(3);
  });

  it('clamps to endpoints for points past the segment', () => {
    const polyline = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    expect(distanceToPolyline({ x: -5, y: 0 }, polyline)).toBeCloseTo(5);
    expect(distanceToPolyline({ x: 15, y: 0 }, polyline)).toBeCloseTo(5);
  });
});

describe('isValidPlacement', () => {
  it('rejects placements too close to the path', async () => {
    const { ctx, state } = await setup();
    // The path goes through (0,100) → (200,100). A point at (50, 105) is 5px away — too close.
    expect(isValidPlacement(state, ctx, 50, 105)).toBe(false);
  });

  it('accepts placements far from the path', async () => {
    const { ctx, state } = await setup();
    expect(isValidPlacement(state, ctx, 500, 50)).toBe(true);
  });

  it('rejects placements on top of existing towers', async () => {
    const { ctx, state } = await setup();
    state.towers.push({
      id: 1,
      defId: 'arrow',
      x: 500,
      y: 50,
      upgrades: [],
      targeting: 'first',
      cooldownRemaining: 0,
    });
    expect(isValidPlacement(state, ctx, 500, 50)).toBe(false);
    expect(isValidPlacement(state, ctx, 600, 50)).toBe(true);
  });
});
```

- [ ] **Step 2: Confirm fail**

```bash
npm test -- placement
```

- [ ] **Step 3: Implement `src/game/sim/placement.ts`**

```ts
import type { Point } from './path';
import type { SimContext, SimState } from './types';

export const MIN_DISTANCE_FROM_PATH = 24;
export const TOWER_FOOTPRINT = 24;

export function distanceToPolyline(point: Point, polyline: Point[]): number {
  let best = Infinity;
  for (let i = 1; i < polyline.length; i++) {
    const d = distanceToSegment(point, polyline[i - 1], polyline[i]);
    if (d < best) best = d;
  }
  return best;
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = a.x + t * dx;
  const cy = a.y + t * dy;
  return Math.hypot(p.x - cx, p.y - cy);
}

export function isValidPlacement(state: SimState, ctx: SimContext, x: number, y: number): boolean {
  if (distanceToPolyline({ x, y }, ctx.loadedMap.map.path) < MIN_DISTANCE_FROM_PATH) {
    return false;
  }
  for (const tower of state.towers) {
    if (Math.hypot(tower.x - x, tower.y - y) < TOWER_FOOTPRINT) return false;
  }
  return true;
}
```

- [ ] **Step 4: Pass + commit**

```bash
npm test -- placement
git add src/game/sim/placement.ts src/game/sim/__tests__/placement.test.ts
git commit -m "FS-11: placement validation"
```

---

### Task 2: Wire placement validation into the placeTower input

So invalid clicks are dropped at the sim level, regardless of UI gating.

**Files:**

- Modify: `src/game/sim/inputs.ts`
- Modify: `src/game/sim/__tests__/inputs.test.ts` (extend existing test file with a new test)

- [ ] **Step 1: Add a failing test to `src/game/sim/__tests__/inputs.test.ts`**

Append to the `describe('applyInput', ...)` block:

```ts
it('placeTower rejects invalid placement (on the path)', async () => {
  const { ctx, state } = await setup();
  const next = applyInput(state, ctx, { type: 'placeTower', defId: 'arrow', x: 100, y: 100 });
  expect(next.towers).toHaveLength(0);
  expect(next.cash).toBe(state.cash);
});
```

- [ ] **Step 2: Confirm fail**

```bash
npm test -- inputs
```

- [ ] **Step 3: Modify `src/game/sim/inputs.ts`** — add the import and the validity check inside the `placeTower` case:

At the top of the file:

```ts
import { isValidPlacement } from './placement';
```

In the `placeTower` case, after the `cash` check, before constructing the tower:

```ts
if (!isValidPlacement(state, ctx, input.x, input.y)) return state;
```

- [ ] **Step 4: Re-test**

```bash
npm test -- inputs
```

All input tests must pass (existing ones + the new one). Existing e2e tests place towers off the path; verify they still pass:

```bash
npm test
```

- [ ] **Step 5: Commit**

```bash
git add src/game/sim/inputs.ts src/game/sim/__tests__/inputs.test.ts
git commit -m "FS-11: placeTower drops invalid placements"
```

---

## Phase 2 — Bridge extensions

### Task 3: Add `selectedTowerId` and `revision` to the HUD store

**Files:**

- Modify: `src/game/bridge/store.ts`
- Modify: `src/game/bridge/__tests__/store.test.ts`

- [ ] **Step 1: Extend the test file**

Append:

```ts
it('selectTowerId updates the field', () => {
  const store = createHudStore();
  store.getState().selectTowerId(7);
  expect(store.getState().selectedTowerId).toBe(7);
  store.getState().selectTowerId(null);
  expect(store.getState().selectedTowerId).toBeNull();
});

it('bumpRevision increments revision', () => {
  const store = createHudStore();
  const before = store.getState().revision;
  store.getState().bumpRevision();
  expect(store.getState().revision).toBe(before + 1);
});
```

- [ ] **Step 2: Modify `src/game/bridge/store.ts`** — add the new fields and actions:

```ts
export interface HudFields {
  cash: number;
  lives: number;
  currentRound: number;
  totalRounds: number;
  phase: SimPhase;
  result: SimResult;
  speed: 1 | 2;
  paused: boolean;
  selectedDefId: string | null;
  selectedTowerId: number | null;
  revision: number;
}

export interface HudActions {
  setHud: (patch: Partial<HudFields>) => void;
  selectDefId: (defId: string | null) => void;
  selectTowerId: (towerId: number | null) => void;
  bumpRevision: () => void;
}
```

In `createHudStore`, add defaults `selectedTowerId: null, revision: 0` and:

```ts
    selectTowerId: (towerId) => set({ selectedTowerId: towerId }),
    bumpRevision: () => set((s) => ({ revision: s.revision + 1 })),
```

- [ ] **Step 3: Pass + commit**

```bash
npm test -- store
git add src/game/bridge/store.ts src/game/bridge/__tests__/store.test.ts
git commit -m "FS-11: store fields for selected tower and revision"
```

---

### Task 4: Bump revision in `GameRunner.pushHud` + expose `getSimState`

**Files:**

- Modify: `src/game/bridge/runner.ts`
- Modify: `src/game/bridge/__tests__/runner.test.ts`

- [ ] **Step 1: Extend the test file**

Append:

```ts
it('bumps store revision after a tick', async () => {
  const { runner, store } = await setup();
  runner.start();
  const before = store.getState().revision;
  runner.tick(DT);
  expect(store.getState().revision).toBeGreaterThan(before);
});
```

- [ ] **Step 2: Modify `src/game/bridge/runner.ts`** — at the end of `pushHud`, add:

```ts
prev.bumpRevision();
```

(Place this after the `if (... ) { prev.setHud(next); }` block, unconditionally — even if HUD fields didn't change, the sim _did_ tick, and the upgrade panel needs to re-read live stats. Put it inside the constructor's `pushHud()` call too — actually, the constructor's call writes initial state and we already increment unconditionally there as well.)

Concretely the new `pushHud` body is:

```ts
  private pushHud() {
    const prev = this.store.getState();
    const next = project(this.state, prev);
    if (
      prev.cash !== next.cash ||
      prev.lives !== next.lives ||
      prev.currentRound !== next.currentRound ||
      prev.totalRounds !== next.totalRounds ||
      prev.phase !== next.phase ||
      prev.result !== next.result ||
      prev.speed !== next.speed ||
      prev.paused !== next.paused
    ) {
      prev.setHud(next);
    }
    prev.bumpRevision();
  }
```

`getSimState()` already exists from Plan C — no change needed. Just confirm the test passes.

- [ ] **Step 3: Pass + commit**

```bash
npm test -- runner
git add src/game/bridge/runner.ts src/game/bridge/__tests__/runner.test.ts
git commit -m "FS-11: bump revision each pushHud for live UI re-read"
```

---

## Phase 3 — Phaser scene: selection + valid/invalid ghost

### Task 5: Click existing tower to select; ghost color reflects placement validity

**Files:**

- Modify: `src/game/render/scenes/GameScene.ts`

- [ ] **Step 1: Replace the imports + `create` + `draw` portions**

Add the placement helper import at the top:

```ts
import { isValidPlacement, TOWER_FOOTPRINT } from '@/game/sim/placement';
```

Add a new color constant:

```ts
const COLOR_GHOST_INVALID = 0xff5555;
const COLOR_TOWER_SELECTED = 0xffffff;
```

Replace the `create()` body's pointerdown with:

```ts
this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
  const ui = this.store.getState();
  if (ui.selectedDefId) {
    // Placement mode
    const state = this.runner.getState();
    const ctx = this.runner.getCtx();
    if (isValidPlacement(state, ctx, p.worldX, p.worldY)) {
      this.bus.emit('intent:placeTower', {
        defId: ui.selectedDefId,
        x: p.worldX,
        y: p.worldY,
      });
      this.store.getState().selectDefId(null);
    }
    return;
  }
  // Selection mode: click an existing tower to select; click empty space deselects.
  const state = this.runner.getState();
  let hit: number | null = null;
  for (const tower of state.towers) {
    if (Math.hypot(tower.x - p.worldX, tower.y - p.worldY) <= TOWER_FOOTPRINT / 2 + 4) {
      hit = tower.id;
      break;
    }
  }
  this.store.getState().selectTowerId(hit);
});
```

In `draw()`, after rendering each tower, if the tower's id matches `selectedTowerId`, stroke it in white:

Replace the towers loop:

```ts
const selectedTowerId = this.store.getState().selectedTowerId;
for (const tower of state.towers) {
  const def = ctx.registry.towersById.get(tower.defId);
  const range = def?.baseStats.range ?? 0;
  g.lineStyle(1, COLOR_RANGE, 0.25);
  g.strokeCircle(tower.x, tower.y, range);
  g.fillStyle(COLOR_TOWER, 1);
  g.fillRect(tower.x - 12, tower.y - 12, 24, 24);
  if (tower.id === selectedTowerId) {
    g.lineStyle(2, COLOR_TOWER_SELECTED, 1);
    g.strokeRect(tower.x - 13, tower.y - 13, 26, 26);
  }
}
```

Replace the ghost block:

```ts
this.ghost.clear();
const selected = this.store.getState().selectedDefId;
if (selected && this.input.activePointer.active) {
  const p = this.input.activePointer;
  const def = ctx.registry.towersById.get(selected);
  const range = def?.baseStats.range ?? 0;
  const valid = isValidPlacement(state, ctx, p.worldX, p.worldY);
  const color = valid ? COLOR_GHOST : COLOR_GHOST_INVALID;
  this.ghost.lineStyle(1, color, 0.7);
  this.ghost.strokeCircle(p.worldX, p.worldY, range);
  this.ghost.fillStyle(color, 0.5);
  this.ghost.fillRect(p.worldX - 12, p.worldY - 12, 24, 24);
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/game/render/scenes/GameScene.ts
git commit -m "FS-11: scene supports tower selection and valid/invalid ghost"
```

---

## Phase 4 — React: routing, map-select, run pages

### Task 6: Map-select page at `/`

**Files:**

- Create: `src/components/MapSelect.tsx` (server component)
- Modify: `src/app/page.tsx` — replace Next default

- [ ] **Step 1: Write `src/components/MapSelect.tsx`**

```tsx
import path from 'node:path';
import Link from 'next/link';
import { loadAllContent } from '@/content-loader/load';

export async function MapSelect() {
  const content = await loadAllContent(path.resolve(process.cwd(), 'content'));
  return (
    <main className="map-select">
      <h1>Firestorm</h1>
      <p>Pick a map.</p>
      <ul className="map-select__list">
        {content.maps.map(({ map, wavesEasy, wavesHard }) => (
          <li key={map.id} className="map-select__card">
            <h2>{map.name}</h2>
            <div className="map-select__diffs">
              <Link href={`/play/${map.id}/easy`} className="map-select__btn">
                Easy ({wavesEasy.waves.length} waves)
              </Link>
              <button className="map-select__btn" disabled title="Coming soon">
                Hard ({wavesHard.waves.length} waves)
              </button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 2: Replace `src/app/page.tsx`**

```tsx
import { MapSelect } from '@/components/MapSelect';

export default function HomePage() {
  return <MapSelect />;
}
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/MapSelect.tsx src/app/page.tsx
git commit -m "FS-11: map-select page at /"
```

---

### Task 7: Run dispatcher route `/play/[mapId]/[difficulty]`

**Files:**

- Delete: `src/app/play/page.tsx` (the placeholder)
- Create: `src/app/play/[mapId]/[difficulty]/page.tsx`
- Modify: `src/components/PhaserMount.tsx` — accept `{ mapId, difficulty }` props
- Modify: `src/components/GameClient.tsx` — accept and forward props

- [ ] **Step 1: Modify `src/components/GameClient.tsx`**

```tsx
'use client';

import dynamic from 'next/dynamic';
import type { Difficulty } from '@/game/sim/types';

const PhaserMount = dynamic(() => import('./PhaserMount'), { ssr: false });

interface GameClientProps {
  mapId: string;
  difficulty: Difficulty;
}

export default function GameClient({ mapId, difficulty }: GameClientProps) {
  return <PhaserMount mapId={mapId} difficulty={difficulty} />;
}
```

- [ ] **Step 2: Modify `src/components/PhaserMount.tsx`** — add the props and use them:

Replace the function signature and body's content load:

```tsx
interface PhaserMountProps {
  mapId: string;
  difficulty: Difficulty;
}

export default function PhaserMount({ mapId, difficulty }: PhaserMountProps) {
  // ... existing refs / store / bus
```

Inside the effect, after fetching content, replace the `loadedMap` lookup:

```ts
const loadedMap = registry.mapsById.get(mapId);
if (!loadedMap) throw new Error(`Map "${mapId}" missing`);
const ctx = { registry, loadedMap };
const initial = createInitialState({ ctx, difficulty, seed: 1 });
```

Add the `Difficulty` import at the top:

```ts
import type { Difficulty } from '@/game/sim/types';
```

Add `mapId, difficulty` to the effect dependency array `[bus, store, mapId, difficulty]`.

- [ ] **Step 3: Create `src/app/play/[mapId]/[difficulty]/page.tsx`**

```tsx
import { notFound } from 'next/navigation';
import GameClient from '@/components/GameClient';
import type { Difficulty } from '@/game/sim/types';

interface PageProps {
  params: Promise<{ mapId: string; difficulty: string }>;
}

export default async function PlayPage({ params }: PageProps) {
  const { mapId, difficulty } = await params;
  if (difficulty !== 'easy' && difficulty !== 'hard') notFound();
  return <GameClient mapId={mapId} difficulty={difficulty as Difficulty} />;
}
```

- [ ] **Step 4: Delete the old placeholder**

```bash
rm src/app/play/page.tsx
```

- [ ] **Step 5: Typecheck + lint + tests**

```bash
npx tsc --noEmit
npm run lint
npm test
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "FS-11: routed run page /play/[mapId]/[difficulty]"
```

---

## Phase 5 — React: shop, upgrade panel, run-end overlay

### Task 8: Tower shop iterates all towers; expose runner via context

The HUD shop currently hard-codes the `arrow` tower. Make it iterate `registry.towersById`, with cost displayed and an affordability check. To do that, the HUD needs access to the content registry — we'll thread it through a small React context provided by `PhaserMount`.

**Files:**

- Create: `src/components/RunContext.tsx` — a tiny context exposing `{ runner, registry }` for HUD consumers.
- Modify: `src/components/PhaserMount.tsx` — provide the context once the runner is ready.
- Modify: `src/components/Hud.tsx` — consume the context, iterate towers in the shop.

- [ ] **Step 1: Create `src/components/RunContext.tsx`**

```tsx
'use client';

import { createContext, useContext } from 'react';
import type { GameRunner } from '@/game/bridge/runner';
import type { ContentRegistry } from '@/content-loader/registry';

export interface RunContextValue {
  runner: GameRunner;
  registry: ContentRegistry;
}

const RunContext = createContext<RunContextValue | null>(null);

export const RunContextProvider = RunContext.Provider;

export function useRunContext(): RunContextValue {
  const v = useContext(RunContext);
  if (!v) throw new Error('useRunContext must be used inside RunContextProvider');
  return v;
}
```

- [ ] **Step 2: Modify `src/components/PhaserMount.tsx`** — add a piece of state to hold the context value and wrap the HUD with a provider when ready.

Add at the top:

```ts
import { useState } from 'react';
import { RunContextProvider, type RunContextValue } from './RunContext';
```

Inside the component, replace `mountRef` usage with both a ref and React state for the provider value:

```tsx
const [runCtx, setRunCtx] = useState<RunContextValue | null>(null);
```

Inside the effect, after `runner.start()`:

```ts
setRunCtx({ runner, registry });
```

In the cleanup:

```ts
setRunCtx(null);
```

In the JSX:

```tsx
return (
  <div className="play-layout">
    <div ref={parentRef} className="play-canvas" style={{ width: CANVAS_W, height: CANVAS_H }} />
    {runCtx ? (
      <RunContextProvider value={runCtx}>
        <Hud bus={bus} store={store} />
      </RunContextProvider>
    ) : (
      <aside className="play-hud">Loading…</aside>
    )}
  </div>
);
```

- [ ] **Step 3: Modify `src/components/Hud.tsx`** — replace the hard-coded shop button with an iteration:

```tsx
'use client';

import { useSyncExternalStore } from 'react';
import type { GameEventBus } from '@/game/bridge/events';
import type { HudStore } from '@/game/bridge/store';
import { useRunContext } from './RunContext';

interface HudProps {
  bus: GameEventBus;
  store: HudStore;
}

function useHud(store: HudStore) {
  return useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.getState(),
    () => store.getState(),
  );
}

export function Hud({ bus, store }: HudProps) {
  const hud = useHud(store);
  const { registry } = useRunContext();
  const towers = [...registry.towersById.values()];

  return (
    <aside className="play-hud">
      <h2>Firestorm</h2>
      <dl>
        <dt>Cash</dt>
        <dd>${hud.cash}</dd>
        <dt>Lives</dt>
        <dd>{hud.lives}</dd>
        <dt>Round</dt>
        <dd>
          {hud.currentRound + (hud.phase === 'in-round' ? 1 : 0)} / {hud.totalRounds}
        </dd>
        <dt>Phase</dt>
        <dd>{hud.phase}</dd>
      </dl>
      <div className="play-hud__actions">
        <button
          type="button"
          disabled={hud.phase !== 'between-rounds' || hud.result !== 'in-progress'}
          onClick={() => bus.emit('intent:startNextRound', undefined)}
        >
          Start round
        </button>
        <button type="button" onClick={() => bus.emit('intent:setPaused', { paused: !hud.paused })}>
          {hud.paused ? 'Resume' : 'Pause'}
        </button>
        <button
          type="button"
          onClick={() => bus.emit('intent:setSpeed', { speed: hud.speed === 1 ? 2 : 1 })}
        >
          Speed {hud.speed}×
        </button>
      </div>
      <h3>Shop</h3>
      <div className="play-hud__shop">
        {towers.map((t) => {
          const isSelected = hud.selectedDefId === t.id;
          const canAfford = hud.cash >= t.cost;
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={isSelected}
              disabled={!isSelected && !canAfford}
              onClick={() => store.getState().selectDefId(isSelected ? null : t.id)}
            >
              {isSelected ? 'Cancel' : `Buy ${t.name} ($${t.cost})`}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: Typecheck + tests**

```bash
npx tsc --noEmit
npm test
```

- [ ] **Step 5: Commit**

```bash
git add src/components/RunContext.tsx src/components/PhaserMount.tsx src/components/Hud.tsx
git commit -m "FS-11: shop iterates registered towers via run context"
```

---

### Task 9: Upgrade panel

**Files:**

- Create: `src/components/UpgradePanel.tsx`
- Modify: `src/components/Hud.tsx` — render `<UpgradePanel>` when a tower is selected.

- [ ] **Step 1: Write `src/components/UpgradePanel.tsx`**

```tsx
'use client';

import { useSyncExternalStore } from 'react';
import type { GameEventBus } from '@/game/bridge/events';
import type { HudStore } from '@/game/bridge/store';
import type { TargetingPriority } from '@/game/sim/types';
import { useRunContext } from './RunContext';

interface UpgradePanelProps {
  bus: GameEventBus;
  store: HudStore;
}

function useRevision(store: HudStore) {
  return useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.getState().revision,
    () => store.getState().revision,
  );
}

const PRIORITIES: TargetingPriority[] = ['first', 'last', 'strong', 'close'];

export function UpgradePanel({ bus, store }: UpgradePanelProps) {
  // Re-read live sim state on every revision bump.
  useRevision(store);
  const { runner, registry } = useRunContext();
  const ui = store.getState();
  if (ui.selectedTowerId == null) return null;

  const sim = runner.getState();
  const tower = sim.towers.find((t) => t.id === ui.selectedTowerId);
  if (!tower) return null;
  const def = registry.towersById.get(tower.defId);
  if (!def) return null;

  // Effective stats
  let damage = def.baseStats.damage;
  let attackSpeed = def.baseStats.attackSpeed;
  let range = def.baseStats.range;
  for (const upgradeId of tower.upgrades) {
    const u = def.upgrades.find((x) => x.id === upgradeId);
    if (!u) continue;
    if (u.statDeltas.damage !== undefined) damage += u.statDeltas.damage;
    if (u.statDeltas.attackSpeed !== undefined) attackSpeed += u.statDeltas.attackSpeed;
    if (u.statDeltas.range !== undefined) range += u.statDeltas.range;
  }

  // Next available upgrade: first whose prereqs are met and not yet applied
  const next = def.upgrades.find(
    (u) => !tower.upgrades.includes(u.id) && u.requires.every((r) => tower.upgrades.includes(r)),
  );

  // Refund: 70% of total invested
  let invested = def.cost;
  for (const upgradeId of tower.upgrades) {
    const u = def.upgrades.find((x) => x.id === upgradeId);
    if (u) invested += u.cost;
  }
  const refund = Math.round(invested * 0.7);

  return (
    <section className="upgrade-panel">
      <h3>{def.name}</h3>
      <dl>
        <dt>Damage</dt>
        <dd>{damage}</dd>
        <dt>Range</dt>
        <dd>{range}</dd>
        <dt>Attack/s</dt>
        <dd>{attackSpeed}</dd>
      </dl>
      {next ? (
        <button
          type="button"
          disabled={ui.cash < next.cost}
          onClick={() => bus.emit('intent:upgradeTower', { towerId: tower.id, upgradeId: next.id })}
        >
          Upgrade ({fmtDeltas(next.statDeltas)}) — ${next.cost}
        </button>
      ) : (
        <p>Fully upgraded</p>
      )}
      <label className="upgrade-panel__targeting">
        Targeting:
        <select
          value={tower.targeting}
          onChange={(e) =>
            bus.emit('intent:setTargeting', {
              towerId: tower.id,
              priority: e.target.value as TargetingPriority,
            })
          }
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={() => {
          bus.emit('intent:sellTower', { towerId: tower.id });
          store.getState().selectTowerId(null);
        }}
      >
        Sell (${refund})
      </button>
      <button type="button" onClick={() => store.getState().selectTowerId(null)}>
        Deselect
      </button>
    </section>
  );
}

function fmtDeltas(d: { damage?: number; attackSpeed?: number; range?: number }): string {
  const parts: string[] = [];
  if (d.damage) parts.push(`+${d.damage} dmg`);
  if (d.attackSpeed) parts.push(`+${d.attackSpeed} atk/s`);
  if (d.range) parts.push(`+${d.range} range`);
  return parts.join(', ');
}
```

- [ ] **Step 2: Modify `src/components/Hud.tsx`** — render the panel below the shop:

Add the import at the top:

```ts
import { UpgradePanel } from './UpgradePanel';
```

Add at the end of the JSX, after the Shop block (still inside `<aside>`):

```tsx
<UpgradePanel bus={bus} store={store} />
```

- [ ] **Step 3: Typecheck + tests**

```bash
npx tsc --noEmit
npm test
```

- [ ] **Step 4: Commit**

```bash
git add src/components/UpgradePanel.tsx src/components/Hud.tsx
git commit -m "FS-11: upgrade panel for selected tower"
```

---

### Task 10: Run-end overlay

**Files:**

- Create: `src/components/RunEnd.tsx`
- Modify: `src/components/PhaserMount.tsx` — render the overlay when result is terminal.

- [ ] **Step 1: Write `src/components/RunEnd.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import type { HudStore } from '@/game/bridge/store';

interface RunEndProps {
  store: HudStore;
}

function useHud(store: HudStore) {
  return useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.getState(),
    () => store.getState(),
  );
}

export function RunEnd({ store }: RunEndProps) {
  const hud = useHud(store);
  if (hud.result === 'in-progress') return null;
  return (
    <div className="run-end">
      <div className="run-end__inner">
        <h2>{hud.result === 'win' ? 'Victory!' : 'Defeat'}</h2>
        <p>
          Round {hud.currentRound} / {hud.totalRounds} — Lives {hud.lives}
        </p>
        <Link href="/" className="run-end__btn">
          Back to maps
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Modify `src/components/PhaserMount.tsx`** — render `<RunEnd>` overlaid on the canvas:

Add the import:

```ts
import { RunEnd } from './RunEnd';
```

In the JSX, wrap the canvas + overlay in a positioned container:

```tsx
return (
  <div className="play-layout">
    <div className="play-canvas-wrap">
      <div ref={parentRef} className="play-canvas" style={{ width: CANVAS_W, height: CANVAS_H }} />
      <RunEnd store={store} />
    </div>
    {runCtx ? (
      <RunContextProvider value={runCtx}>
        <Hud bus={bus} store={store} />
      </RunContextProvider>
    ) : (
      <aside className="play-hud">Loading…</aside>
    )}
  </div>
);
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/RunEnd.tsx src/components/PhaserMount.tsx
git commit -m "FS-11: run-end overlay with back-to-maps link"
```

---

### Task 11: Styles

**Files:**

- Modify: `src/app/globals.css`

- [ ] **Step 1: Append**

```css
.map-select {
  padding: 32px;
  font-family: system-ui, sans-serif;
  color: #eee;
  max-width: 800px;
  margin: 0 auto;
}

.map-select h1 {
  font-size: 2rem;
  margin: 0 0 8px;
}

.map-select__list {
  list-style: none;
  padding: 0;
  margin: 24px 0 0;
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
}

.map-select__card {
  background: #1f242c;
  border: 1px solid #333;
  padding: 16px;
}

.map-select__diffs {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.map-select__btn {
  background: #2c333d;
  color: #eee;
  border: 1px solid #444;
  padding: 8px 12px;
  cursor: pointer;
  text-decoration: none;
  font: inherit;
  display: inline-block;
}

.map-select__btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.play-canvas-wrap {
  position: relative;
}

.run-end {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #eee;
  font-family: system-ui, sans-serif;
}

.run-end__inner {
  background: #1f242c;
  padding: 24px 32px;
  border: 1px solid #444;
  text-align: center;
}

.run-end__inner h2 {
  margin: 0 0 8px;
  font-size: 1.5rem;
}

.run-end__btn {
  display: inline-block;
  margin-top: 16px;
  background: #f2c14e;
  color: #111;
  padding: 8px 16px;
  text-decoration: none;
  font-weight: bold;
}

.upgrade-panel {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #333;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.upgrade-panel h3 {
  margin: 0 0 4px;
  font-size: 1rem;
}

.upgrade-panel dl {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 2px 12px;
  margin: 0 0 4px;
}

.upgrade-panel dt {
  color: #999;
}

.upgrade-panel dd {
  margin: 0;
}

.upgrade-panel__targeting {
  display: flex;
  align-items: center;
  gap: 8px;
}

.upgrade-panel__targeting select {
  flex: 1;
  background: #2c333d;
  color: #eee;
  border: 1px solid #444;
  padding: 4px 6px;
  font: inherit;
}
```

- [ ] **Step 2: Format check + commit**

```bash
npm run format
npm run format:check
git add src/app/globals.css
git commit -m "FS-11: styles for map-select, upgrade panel, run-end overlay"
```

---

## Phase 6 — Verification

### Task 12: Manual smoke test

This task is not automatable. Run it explicitly.

- [ ] **Step 1: Start dev**

```bash
npm run dev
```

- [ ] **Step 2: Open `http://localhost:3000/`**

Expected: map-select shows "In The Loop" and "Logs" cards, each with an "Easy (N waves)" button (link) and a disabled "Hard" button.

- [ ] **Step 3: Click "Easy" on `In The Loop`.**

Expected: navigate to `/play/in-the-loop/easy`, canvas + HUD load (Cash $650, Lives 100, Round 0 / 2).

- [ ] **Step 4: Try to place a tower on the path.**

Expected: ghost is red, click does nothing (cash unchanged).

- [ ] **Step 5: Place a tower off the path.**

Expected: ghost is white, click places, cash drops.

- [ ] **Step 6: Click the placed tower.**

Expected: tower is highlighted in white. UpgradePanel appears with stats, an Upgrade button, targeting dropdown, Sell button, Deselect button.

- [ ] **Step 7: Click Upgrade. Then Sell.**

Expected: cash deducted then refunded, tower vanishes.

- [ ] **Step 8: Place 4 towers near the path. Click Start round.**

Expected: scouts walk, towers shoot, you survive. After round 1 ends, "Start round" is enabled again.

- [ ] **Step 9: Click Start round again. Survive round 2.**

Expected: when round 2 ends and `currentRound >= totalRounds`, run-end overlay shows **Victory!** with stats and a "Back to maps" link.

- [ ] **Step 10: Click "Back to maps".**

Expected: navigates to `/`, picks a map, fresh run starts.

- [ ] **Step 11: Run a sequence designed to lose** (no towers, click Start round). When lives hit 0:

Expected: overlay shows **Defeat**.

- [ ] **Step 12: Stop the dev server.**

If any step fails, fix it before proceeding.

---

### Task 13: Final sweep

- [ ] **Step 1: Run all checks**

```bash
npm run format
npm run format:check
npm run lint
npx tsc --noEmit
npm test
npm run validate-content
```

All exit 0.

- [ ] **Step 2: Commit any formatting fixups**

```bash
git add -A
git diff --cached --quiet || git commit -m "FS-11: apply formatting"
```

---

## Done check

- `/` shows a map-select with both maps; Easy launches a run, Hard is disabled.
- A run lets the player place / upgrade / sell / retarget towers, with placement validation.
- Win and lose are detected and shown in an overlay with a back-to-maps action.
- Picking a map a second time starts a clean run.
- All Vitest suites pass; lint, format, typecheck, content validation all clean.
- No accounts, no leaderboards, no persistence — those are Plans E/F.
