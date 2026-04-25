# Plan C — Phaser Render Layer + Bridge + Minimal Run UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Firestorm playable in a browser. Render the sim from Plan B with Phaser 3, wire React UI through a typed event bus + Zustand store, drive the sim from a fixed-timestep loop in `requestAnimationFrame`, and let the player click to place and run a single round on the `in-the-loop` map with placeholder art.

**Architecture:**

- `src/game/sim/` (Plan B): pure simulation, untouched.
- `src/game/bridge/` (new): the contract between React and Phaser. Two pieces — a typed `mitt` event bus for _intents_ (React → game), and a Zustand store for _HUD-relevant state_ (game → React). Plus a `GameRunner` class that owns the live sim state, the fixed-timestep accumulator, and applies bridge intents to the sim.
- `src/game/render/` (new): Phaser scene that reads sim state every tick and draws map / path / towers / creeps. No game logic here, no DOM here. Captures pointer events, dispatches intents to the bridge.
- `src/components/` (new files): React wrappers — `GameContainer` (mounts Phaser), `Hud` (reads store, dispatches intents), wired into `src/app/play/page.tsx`.

**Tech Stack:** Phaser 3, Zustand, mitt, React 19, Next.js App Router. Phaser is browser-only — must be loaded with `next/dynamic({ ssr: false })`.

**Branch:** `FS-9`. Each commit prefixed `FS-9: `.

---

## Design notes

### Why a `GameRunner` between bridge and sim

The sim is pure: `(state, ctx) → state'`. Something has to _own_ the live state, drive it forward in real time at the chosen game speed, queue up intents from the event bus, and push HUD slices to the store. That something is `GameRunner`. Keeping it as a class (not a hook) means it lives outside React's render cycle — Phaser's loop drives it, not React's.

### Tick driving

`requestAnimationFrame` gives wall-clock dt. `GameRunner` accumulates dt and runs `step()` while accumulator ≥ `DT`. Game speed multiplies how fast the accumulator fills (i.e. `accumulator += dt × speed`). This keeps the sim deterministic per-tick while honoring the user's speed setting. Cap `dt` at e.g. 100ms to avoid spirals after tab focus.

### What's in the store vs. what's in the sim

The Zustand store contains _only_ what React needs to render the HUD or wire input UI. Concretely:

```ts
interface HudState {
  cash: number;
  lives: number;
  currentRound: number;
  totalRounds: number;
  phase: 'between-rounds' | 'in-round';
  result: 'in-progress' | 'win' | 'lose';
  speed: 1 | 2;
  paused: boolean;
  selectedDefId: string | null; // tower selected in shop, null = none
}
```

Critical: this is a _projection_ of sim state, not the sim state itself. `GameRunner` rebuilds it after every tick by calling `set(deriveHudState(simState, ui))`. React reads via `useStore`. React never mutates the sim.

There's also UI-only state (`selectedDefId`) that lives only in the store. The bridge events handle the rest.

### Event bus surface

```ts
type GameEvents = {
  'intent:placeTower': { defId: string; x: number; y: number };
  'intent:upgradeTower': { towerId: number; upgradeId: string };
  'intent:sellTower': { towerId: number };
  'intent:setTargeting': { towerId: number; priority: TargetingPriority };
  'intent:startNextRound': undefined;
  'intent:setSpeed': { speed: 1 | 2 };
  'intent:setPaused': { paused: boolean };
};
```

Both React (HUD buttons) and Phaser (placement clicks) emit intents. `GameRunner` is the single subscriber — it queues intents and applies them on the next tick boundary.

### Why Phaser is loaded via `next/dynamic({ ssr: false })`

Importing `phaser` from server code crashes — it touches `window`. The standard fix is a small `'use client'` component that itself does `dynamic(() => import('./PhaserCanvas'), { ssr: false })`. Everything Phaser-touching lives behind this boundary.

### What the MVP slice of this plan ships

- `/play` loads the `in-the-loop` map.
- Background drawn as a colored rectangle (no real art yet — that's the parallel content stream).
- Path drawn as a thick polyline.
- HUD shows cash, lives, round, phase, result.
- "Buy Arrow Tower" button selects placement mode; clicking on canvas places a tower (snaps to wherever clicked — no placement-mask validation yet, that's Plan D).
- "Start round" button advances to in-round.
- "Pause", speed toggle (1×/2×) work.
- Towers render as squares with a faint range circle. Creeps render as colored circles, color by resistance class.
- No upgrade panel, no sell, no targeting picker — those are Plan D.

### File map

**Created:**

- `src/game/bridge/events.ts` — typed mitt instance + types.
- `src/game/bridge/store.ts` — Zustand store + types.
- `src/game/bridge/runner.ts` — `GameRunner` class.
- `src/game/bridge/__tests__/events.test.ts`
- `src/game/bridge/__tests__/store.test.ts`
- `src/game/bridge/__tests__/runner.test.ts` — uses fake clock + sim, no Phaser.
- `src/game/render/PhaserGame.ts` — `Phaser.Game` factory.
- `src/game/render/scenes/GameScene.ts` — the main scene.
- `src/components/GameClient.tsx` — `'use client'` boundary; dynamic import of Phaser.
- `src/components/PhaserMount.tsx` — actual Phaser mount + GameRunner lifecycle.
- `src/components/Hud.tsx` — HUD UI.
- `src/app/play/page.tsx` — replace placeholder.

**Modified:**

- `src/app/globals.css` — small additions for the play layout (game canvas + HUD column).

---

## Phase 1 — Bridge

### Task 1: Typed event bus

**Files:**

- Create: `src/game/bridge/events.ts`, `src/game/bridge/__tests__/events.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { createGameEventBus } from '@/game/bridge/events';

describe('GameEventBus', () => {
  it('delivers a typed event to a subscriber', () => {
    const bus = createGameEventBus();
    const handler = vi.fn();
    bus.on('intent:placeTower', handler);
    bus.emit('intent:placeTower', { defId: 'arrow', x: 10, y: 20 });
    expect(handler).toHaveBeenCalledWith({ defId: 'arrow', x: 10, y: 20 });
  });

  it('off removes the listener', () => {
    const bus = createGameEventBus();
    const handler = vi.fn();
    bus.on('intent:startNextRound', handler);
    bus.off('intent:startNextRound', handler);
    bus.emit('intent:startNextRound', undefined);
    expect(handler).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Confirm fail**

```bash
npm test -- bridge/events
```

- [ ] **Step 3: Implement `src/game/bridge/events.ts`**

```ts
import mitt from 'mitt';
import type { TargetingPriority } from '@/game/sim/types';

export type GameEvents = {
  'intent:placeTower': { defId: string; x: number; y: number };
  'intent:upgradeTower': { towerId: number; upgradeId: string };
  'intent:sellTower': { towerId: number };
  'intent:setTargeting': { towerId: number; priority: TargetingPriority };
  'intent:startNextRound': undefined;
  'intent:setSpeed': { speed: 1 | 2 };
  'intent:setPaused': { paused: boolean };
  'ui:selectDefId': { defId: string | null };
};

export type GameEventBus = ReturnType<typeof createGameEventBus>;

export function createGameEventBus() {
  return mitt<GameEvents>();
}
```

- [ ] **Step 4: Pass + commit**

```bash
npm test -- bridge/events
git add src/game/bridge/events.ts src/game/bridge/__tests__/events.test.ts
git commit -m "FS-9: typed game event bus"
```

---

### Task 2: HUD store

**Files:**

- Create: `src/game/bridge/store.ts`, `src/game/bridge/__tests__/store.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, expect, it } from 'vitest';
import { createHudStore } from '@/game/bridge/store';

describe('HudStore', () => {
  it('initializes with sensible defaults', () => {
    const store = createHudStore();
    const s = store.getState();
    expect(s.cash).toBe(0);
    expect(s.lives).toBe(0);
    expect(s.currentRound).toBe(0);
    expect(s.totalRounds).toBe(0);
    expect(s.phase).toBe('between-rounds');
    expect(s.result).toBe('in-progress');
    expect(s.speed).toBe(1);
    expect(s.paused).toBe(false);
    expect(s.selectedDefId).toBeNull();
  });

  it('setHud merges a partial update and notifies subscribers', () => {
    const store = createHudStore();
    let last = store.getState();
    const unsub = store.subscribe((s) => {
      last = s;
    });
    store.getState().setHud({ cash: 100, lives: 50 });
    expect(last.cash).toBe(100);
    expect(last.lives).toBe(50);
    unsub();
  });

  it('selectDefId toggles selection', () => {
    const store = createHudStore();
    store.getState().selectDefId('arrow');
    expect(store.getState().selectedDefId).toBe('arrow');
    store.getState().selectDefId(null);
    expect(store.getState().selectedDefId).toBeNull();
  });
});
```

- [ ] **Step 2: Confirm fail**

```bash
npm test -- bridge/store
```

- [ ] **Step 3: Implement `src/game/bridge/store.ts`**

```ts
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { SimPhase, SimResult } from '@/game/sim/types';

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
}

export interface HudActions {
  setHud: (patch: Partial<HudFields>) => void;
  selectDefId: (defId: string | null) => void;
}

export type HudState = HudFields & HudActions;

export type HudStore = StoreApi<HudState>;

export function createHudStore(): HudStore {
  return createStore<HudState>((set) => ({
    cash: 0,
    lives: 0,
    currentRound: 0,
    totalRounds: 0,
    phase: 'between-rounds',
    result: 'in-progress',
    speed: 1,
    paused: false,
    selectedDefId: null,
    setHud: (patch) => set(patch),
    selectDefId: (defId) => set({ selectedDefId: defId }),
  }));
}
```

- [ ] **Step 4: Pass + commit**

```bash
npm test -- bridge/store
git add src/game/bridge/store.ts src/game/bridge/__tests__/store.test.ts
git commit -m "FS-9: HUD Zustand store (vanilla)"
```

---

### Task 3: GameRunner

**Files:**

- Create: `src/game/bridge/runner.ts`, `src/game/bridge/__tests__/runner.test.ts`

The `GameRunner` owns the live `SimState`, an intent queue (filled by event bus subscribers), and a fixed-timestep accumulator. It does NOT touch Phaser or the DOM. It exposes:

- `start()` / `stop()` — lifecycle
- `tick(dtSeconds)` — advance the sim by real-time dt, applying queued intents at tick boundaries
- `getState()` — current `SimState` (for the renderer)

Real-time driving (rAF) is left to the caller; tests drive `tick()` manually.

- [ ] **Step 1: Write failing test**

```ts
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadAllContent } from '@/content-loader/load';
import { buildRegistry } from '@/content-loader/registry';
import { createGameEventBus } from '@/game/bridge/events';
import { GameRunner } from '@/game/bridge/runner';
import { createHudStore } from '@/game/bridge/store';
import { createInitialState } from '@/game/sim/state';
import { DT } from '@/game/sim/types';

async function setup() {
  const content = await loadAllContent(path.resolve(__dirname, '../../../../content'));
  const registry = buildRegistry(content);
  const loadedMap = registry.mapsById.get('in-the-loop')!;
  const ctx = { registry, loadedMap };
  const initial = createInitialState({ ctx, difficulty: 'easy', seed: 1 });
  const bus = createGameEventBus();
  const store = createHudStore();
  const runner = new GameRunner({ ctx, initialState: initial, bus, store });
  return { runner, ctx, bus, store };
}

describe('GameRunner', () => {
  it('mirrors initial sim state into the HUD store on construct', async () => {
    const { store, ctx } = await setup();
    const easy = ctx.loadedMap.map.difficulty.easy;
    expect(store.getState().cash).toBe(easy.startCash);
    expect(store.getState().lives).toBe(easy.startLives);
    expect(store.getState().totalRounds).toBe(ctx.loadedMap.wavesEasy.waves.length);
  });

  it('tick(DT) advances exactly one sim tick', async () => {
    const { runner } = await setup();
    runner.start();
    runner.tick(DT);
    expect(runner.getState().tick).toBe(1);
  });

  it('does not run ticks while stopped', async () => {
    const { runner } = await setup();
    runner.tick(DT * 10);
    expect(runner.getState().tick).toBe(0);
  });

  it('applies a placeTower intent before the next tick', async () => {
    const { runner, store, bus } = await setup();
    runner.start();
    bus.emit('intent:placeTower', { defId: 'arrow', x: 100, y: 100 });
    runner.tick(DT);
    expect(runner.getState().towers).toHaveLength(1);
    expect(store.getState().cash).toBe(runner.getState().cash);
  });

  it('respects game speed by running multiple ticks per real second', async () => {
    const { runner, bus } = await setup();
    runner.start();
    bus.emit('intent:setSpeed', { speed: 2 });
    // 1s of real time at 2x = 120 sim ticks
    runner.tick(1);
    expect(runner.getState().tick).toBe(120);
  });

  it('does not advance while paused', async () => {
    const { runner, bus } = await setup();
    runner.start();
    bus.emit('intent:setPaused', { paused: true });
    runner.tick(1);
    expect(runner.getState().tick).toBe(0);
  });
});
```

- [ ] **Step 2: Confirm fail**

```bash
npm test -- bridge/runner
```

- [ ] **Step 3: Implement `src/game/bridge/runner.ts`**

```ts
import { applyInput, type SimInput } from '@/game/sim/inputs';
import { step } from '@/game/sim/step';
import type { SimContext, SimState } from '@/game/sim/types';
import { DT } from '@/game/sim/types';
import type { GameEventBus, GameEvents } from './events';
import type { HudFields, HudStore } from './store';

const MAX_DT = 0.1; // s — clamp to avoid spirals after tab focus

export interface GameRunnerOptions {
  ctx: SimContext;
  initialState: SimState;
  bus: GameEventBus;
  store: HudStore;
}

function project(state: SimState, prev: HudFields): HudFields {
  return {
    ...prev,
    cash: state.cash,
    lives: state.lives,
    currentRound: state.currentRound,
    totalRounds: state.totalRounds,
    phase: state.phase,
    result: state.result,
    speed: state.speed,
    paused: state.paused,
  };
}

export class GameRunner {
  private state: SimState;
  private readonly ctx: SimContext;
  private readonly bus: GameEventBus;
  private readonly store: HudStore;
  private accumulator = 0;
  private running = false;
  private queued: SimInput[] = [];
  private subscriptions: Array<() => void> = [];

  constructor({ ctx, initialState, bus, store }: GameRunnerOptions) {
    this.ctx = ctx;
    this.state = initialState;
    this.bus = bus;
    this.store = store;
    this.pushHud();
    this.wireBus();
  }

  private wireBus() {
    const on = <K extends keyof GameEvents>(key: K, handler: (payload: GameEvents[K]) => void) => {
      this.bus.on(key, handler);
      this.subscriptions.push(() => this.bus.off(key, handler));
    };

    on('intent:placeTower', (p) => this.queued.push({ type: 'placeTower', ...p }));
    on('intent:upgradeTower', (p) => this.queued.push({ type: 'upgradeTower', ...p }));
    on('intent:sellTower', (p) => this.queued.push({ type: 'sellTower', ...p }));
    on('intent:setTargeting', (p) => this.queued.push({ type: 'setTargeting', ...p }));
    on('intent:startNextRound', () => this.queued.push({ type: 'startNextRound' }));
    on('intent:setSpeed', (p) => this.queued.push({ type: 'setSpeed', ...p }));
    on('intent:setPaused', (p) => this.queued.push({ type: 'setPaused', ...p }));
  }

  start() {
    this.running = true;
  }

  stop() {
    this.running = false;
  }

  destroy() {
    this.stop();
    for (const off of this.subscriptions) off();
    this.subscriptions = [];
  }

  getState(): SimState {
    return this.state;
  }

  tick(dtSeconds: number) {
    if (!this.running) return;
    this.drainQueue();
    if (this.state.paused) {
      this.pushHud();
      return;
    }
    const dt = Math.min(dtSeconds, MAX_DT) * this.state.speed;
    this.accumulator += dt;
    while (this.accumulator >= DT) {
      this.state = step(this.state, this.ctx);
      this.accumulator -= DT;
      this.drainQueue();
      if (this.state.result !== 'in-progress') break;
    }
    this.pushHud();
  }

  private drainQueue() {
    if (this.queued.length === 0) return;
    const queue = this.queued;
    this.queued = [];
    for (const input of queue) {
      this.state = applyInput(this.state, this.ctx, input);
    }
  }

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
  }
}
```

- [ ] **Step 4: Pass + commit**

```bash
npm test -- bridge/runner
git add src/game/bridge/runner.ts src/game/bridge/__tests__/runner.test.ts
git commit -m "FS-9: GameRunner driving sim from intents and dt"
```

---

## Phase 2 — Phaser render

These tasks are _not_ unit-tested (Phaser depends on browser globals not present in Node-Vitest). They're validated by the manual smoke check at the end of the plan.

### Task 4: Phaser game factory

**Files:**

- Create: `src/game/render/PhaserGame.ts`

- [ ] **Step 1: Implement**

```ts
import Phaser from 'phaser';
import { GameScene, type GameSceneInit } from './scenes/GameScene';

export interface CreatePhaserGameOptions {
  parent: HTMLElement;
  width: number;
  height: number;
  sceneInit: GameSceneInit;
}

export function createPhaserGame(opts: CreatePhaserGameOptions): Phaser.Game {
  const scene = new GameScene(opts.sceneInit);
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent: opts.parent,
    width: opts.width,
    height: opts.height,
    backgroundColor: '#1a1a1a',
    scene,
    physics: { default: 'arcade' },
    scale: { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.NO_CENTER },
  });
}
```

- [ ] **Step 2: Typecheck (no test yet — depends on GameScene which lands in Task 5)**

Skip typecheck until Task 5 lands. Just commit the file structure.

- [ ] **Step 3: Commit**

```bash
git add src/game/render/PhaserGame.ts
git commit -m "FS-9: Phaser game factory"
```

---

### Task 5: GameScene

**Files:**

- Create: `src/game/render/scenes/GameScene.ts`

The scene's job is purely visual: every `update()` it reads `runner.getState()` and reconciles its drawn objects to match. It also subscribes to pointer events to dispatch `intent:placeTower` when a tower is selected.

- [ ] **Step 1: Implement**

```ts
import Phaser from 'phaser';
import type { GameRunner } from '@/game/bridge/runner';
import type { GameEventBus } from '@/game/bridge/events';
import type { HudStore } from '@/game/bridge/store';
import { positionAtDistance } from '@/game/sim/path';

export interface GameSceneInit {
  runner: GameRunner;
  bus: GameEventBus;
  store: HudStore;
}

const COLOR_BG = 0x222831;
const COLOR_PATH = 0x3f4a5c;
const COLOR_TOWER = 0xf2c14e;
const COLOR_RANGE = 0xf2c14e;
const COLOR_CREEP_LIGHT = 0x6ec964;
const COLOR_CREEP_HEAVY = 0xc96464;
const COLOR_CREEP_MAGICAL = 0x6492c9;
const COLOR_GHOST_VALID = 0xffffff;

export class GameScene extends Phaser.Scene {
  private readonly runner: GameRunner;
  private readonly bus: GameEventBus;
  private readonly store: HudStore;

  private graphics!: Phaser.GameObjects.Graphics;
  private ghost!: Phaser.GameObjects.Graphics;

  constructor(init: GameSceneInit) {
    super('GameScene');
    this.runner = init.runner;
    this.bus = init.bus;
    this.store = init.store;
  }

  create() {
    this.graphics = this.add.graphics();
    this.ghost = this.add.graphics();
    this.drawBackground();

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const selected = this.store.getState().selectedDefId;
      if (!selected) return;
      this.bus.emit('intent:placeTower', { defId: selected, x: p.worldX, y: p.worldY });
      this.store.getState().selectDefId(null);
    });
  }

  update() {
    this.draw();
  }

  private drawBackground() {
    const path = this.runner.getState();
    void path;
  }

  private draw() {
    const state = this.runner.getState();
    const ctx = this.runner['ctx' as keyof typeof this.runner] as unknown as {
      loadedMap: { map: { path: { x: number; y: number }[] } };
    };
    const path = ctx.loadedMap.map.path;
    const g = this.graphics;
    g.clear();

    // Background fill
    g.fillStyle(COLOR_BG, 1);
    g.fillRect(0, 0, Number(this.game.config.width), Number(this.game.config.height));

    // Path
    g.lineStyle(40, COLOR_PATH, 1);
    g.beginPath();
    g.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) g.lineTo(path[i].x, path[i].y);
    g.strokePath();

    // Towers
    for (const tower of state.towers) {
      g.lineStyle(1, COLOR_RANGE, 0.25);
      g.strokeCircle(tower.x, tower.y, 150); // TODO: real range from def
      g.fillStyle(COLOR_TOWER, 1);
      g.fillRect(tower.x - 12, tower.y - 12, 24, 24);
    }

    // Creeps
    for (const creep of state.creeps) {
      const pos = positionAtDistance(path, creep.distance);
      const color = colorForCreep(creep.defId);
      g.fillStyle(color, 1);
      g.fillCircle(pos.x, pos.y, 10);
    }

    // Ghost
    this.ghost.clear();
    const selected = this.store.getState().selectedDefId;
    if (selected && this.input.activePointer.active) {
      const p = this.input.activePointer;
      this.ghost.lineStyle(1, COLOR_GHOST_VALID, 0.7);
      this.ghost.strokeCircle(p.worldX, p.worldY, 150);
      this.ghost.fillStyle(COLOR_GHOST_VALID, 0.5);
      this.ghost.fillRect(p.worldX - 12, p.worldY - 12, 24, 24);
    }
  }
}

function colorForCreep(defId: string): number {
  // Simple defId → color map; will be replaced when real sprites land.
  if (defId === 'tank') return COLOR_CREEP_HEAVY;
  if (defId === 'scout') return COLOR_CREEP_LIGHT;
  return COLOR_CREEP_MAGICAL;
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Must exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/game/render/scenes/GameScene.ts
git commit -m "FS-9: GameScene reading sim state and dispatching placement intents"
```

---

## Phase 3 — React UI

### Task 6: PhaserMount + GameClient

`PhaserMount` is the actual Phaser owner: it constructs `GameRunner`, the event bus, the store; mounts the Phaser game; runs the rAF loop; and tears everything down on unmount. `GameClient` is a `'use client'` thin wrapper that dynamic-imports `PhaserMount` (so Next.js never tries to SSR Phaser).

**Files:**

- Create: `src/components/PhaserMount.tsx`, `src/components/GameClient.tsx`

- [ ] **Step 1: Write `src/components/PhaserMount.tsx`**

```tsx
'use client';

import { useEffect, useMemo, useRef } from 'react';
import { loadAllContent } from '@/content-loader/load';
import { buildRegistry } from '@/content-loader/registry';
import { createGameEventBus, type GameEventBus } from '@/game/bridge/events';
import { GameRunner } from '@/game/bridge/runner';
import { createHudStore, type HudStore } from '@/game/bridge/store';
import { createInitialState } from '@/game/sim/state';
import { Hud } from './Hud';

const CANVAS_W = 800;
const CANVAS_H = 600;

interface MountState {
  bus: GameEventBus;
  store: HudStore;
  runner: GameRunner;
}

export default function PhaserMount() {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const mountRef = useRef<MountState | null>(null);

  // The store is needed by both Phaser and the HUD; keep one instance.
  const store = useMemo(() => createHudStore(), []);
  const bus = useMemo(() => createGameEventBus(), []);

  useEffect(() => {
    let cancelled = false;
    let rafId = 0;
    let phaserGame: import('phaser').Game | null = null;
    let runner: GameRunner | null = null;
    let lastTs = 0;

    (async () => {
      // Load content from the static endpoint shipped in /api/content (added in this task).
      const res = await fetch('/api/content');
      if (!res.ok) throw new Error(`Failed to load content: ${res.status}`);
      const content = await res.json();
      const registry = buildRegistry(content);
      const loadedMap = registry.mapsById.get('in-the-loop');
      if (!loadedMap) throw new Error('in-the-loop map missing');
      const ctx = { registry, loadedMap };
      const initial = createInitialState({ ctx, difficulty: 'easy', seed: 1 });
      runner = new GameRunner({ ctx, initialState: initial, bus, store });
      runner.start();

      const { createPhaserGame } = await import('@/game/render/PhaserGame');
      if (cancelled || !parentRef.current) return;
      phaserGame = createPhaserGame({
        parent: parentRef.current,
        width: CANVAS_W,
        height: CANVAS_H,
        sceneInit: { runner, bus, store },
      });

      mountRef.current = { bus, store, runner };

      const loop = (ts: number) => {
        const dt = lastTs ? (ts - lastTs) / 1000 : 0;
        lastTs = ts;
        runner?.tick(dt);
        rafId = requestAnimationFrame(loop);
      };
      rafId = requestAnimationFrame(loop);
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      runner?.destroy();
      phaserGame?.destroy(true);
      mountRef.current = null;
    };
  }, [bus, store]);

  return (
    <div className="play-layout">
      <div ref={parentRef} className="play-canvas" style={{ width: CANVAS_W, height: CANVAS_H }} />
      <Hud bus={bus} store={store} />
    </div>
  );
}
```

- [ ] **Step 2: Write `src/components/GameClient.tsx`**

```tsx
'use client';

import dynamic from 'next/dynamic';

const PhaserMount = dynamic(() => import('./PhaserMount'), { ssr: false });

export default function GameClient() {
  return <PhaserMount />;
}
```

- [ ] **Step 3: Add a content API route — `src/app/api/content/route.ts`**

We need to ship the YAML-loaded content to the browser. A small server route reads via the existing loader.

```ts
import path from 'node:path';
import { NextResponse } from 'next/server';
import { loadAllContent } from '@/content-loader/load';

export const dynamic = 'force-static';

export async function GET() {
  const content = await loadAllContent(path.resolve(process.cwd(), 'content'));
  return NextResponse.json(content);
}
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```

Must exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/PhaserMount.tsx src/components/GameClient.tsx \
  src/app/api/content/route.ts
git commit -m "FS-9: PhaserMount + GameClient + content API route"
```

---

### Task 7: Hud component

**Files:**

- Create: `src/components/Hud.tsx`

- [ ] **Step 1: Implement**

```tsx
'use client';

import { useSyncExternalStore } from 'react';
import type { GameEventBus } from '@/game/bridge/events';
import type { HudStore } from '@/game/bridge/store';

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
        <dt>Result</dt>
        <dd>{hud.result}</dd>
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
        <button
          type="button"
          aria-pressed={hud.selectedDefId === 'arrow'}
          onClick={() =>
            store.getState().selectDefId(hud.selectedDefId === 'arrow' ? null : 'arrow')
          }
        >
          {hud.selectedDefId === 'arrow' ? 'Cancel' : 'Buy Arrow ($100)'}
        </button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Hud.tsx
git commit -m "FS-9: Hud component subscribed to store"
```

---

### Task 8: Wire `/play` page + minimal styles

**Files:**

- Modify: `src/app/play/page.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Replace `src/app/play/page.tsx`**

```tsx
import GameClient from '@/components/GameClient';

export default function PlayPage() {
  return <GameClient />;
}
```

- [ ] **Step 2: Append to `src/app/globals.css`**

```css
.play-layout {
  display: flex;
  gap: 16px;
  padding: 16px;
  align-items: flex-start;
}

.play-canvas {
  border: 1px solid #333;
  background: #000;
}

.play-hud {
  min-width: 240px;
  font-family: system-ui, sans-serif;
  color: #eee;
  background: #1f242c;
  padding: 16px;
  border: 1px solid #333;
}

.play-hud h2 {
  margin: 0 0 8px;
  font-size: 1.2rem;
}

.play-hud h3 {
  margin: 16px 0 8px;
  font-size: 1rem;
}

.play-hud dl {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 12px;
  margin: 0 0 12px;
}

.play-hud dt {
  color: #999;
}

.play-hud dd {
  margin: 0;
}

.play-hud__actions,
.play-hud__shop {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.play-hud button {
  background: #2c333d;
  color: #eee;
  border: 1px solid #444;
  padding: 6px 10px;
  cursor: pointer;
  font: inherit;
}

.play-hud button:disabled {
  opacity: 0.5;
  cursor: default;
}

.play-hud button[aria-pressed='true'] {
  background: #f2c14e;
  color: #111;
}
```

- [ ] **Step 3: Typecheck + lint + tests**

```bash
npx tsc --noEmit
npm run lint
npm test
```

All must pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/play/page.tsx src/app/globals.css
git commit -m "FS-9: wire /play to GameClient with minimal HUD layout"
```

---

## Phase 4 — Manual smoke + final checks

### Task 9: Manual browser smoke test

This task is not automatable. Run it explicitly and confirm each item.

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Open `http://localhost:3000/play` in a browser.**

Expected:

- Canvas (800×600) shows the dark background and a thick gray polyline (the path).
- HUD shows: Cash $650, Lives 100, Round 0 / 2, Phase between-rounds, Result in-progress.

- [ ] **Step 3: Click "Buy Arrow ($100)"**

Expected: button reads "Cancel". A white square + range circle follows the cursor over the canvas.

- [ ] **Step 4: Click on the canvas to place the tower**

Expected: square stays where clicked, range circle stays around it. HUD cash drops to $550.

- [ ] **Step 5: Place 3 more towers near the path. Click "Start round"**

Expected: HUD shows Round 1 / 2, Phase in-round. Green circles (scouts) walk along the path. Towers fire (instantly — no projectile FX yet); creeps disappear when killed; cash goes up.

- [ ] **Step 6: Click "Speed 1×"**

Expected: button reads "Speed 2×". Game runs visibly faster.

- [ ] **Step 7: Click "Pause"**

Expected: button reads "Resume". Creeps stop moving.

- [ ] **Step 8: Stop server.**

If any step fails, fix it before proceeding.

---

### Task 10: Final lint/format/test/validate sweep

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
git diff --cached --quiet || git commit -m "FS-9: apply formatting"
```

---

## Done check

- `/play` renders a working canvas with a HUD next to it.
- A user can place towers, start a round, watch combat, pause, change speed.
- All previous Vitest suites still pass; no Phaser code is imported in a server context.
- Bridge modules (`events`, `store`, `runner`) are unit-tested.
- No automated tests for `GameScene` / Phaser code — validated by Task 9 only.
