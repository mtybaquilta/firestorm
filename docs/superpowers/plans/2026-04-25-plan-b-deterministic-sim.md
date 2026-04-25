# Plan B — Deterministic Sim Core

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a pure-TypeScript, headless, deterministic tower defense simulation in `src/game/sim/`. Drive a complete scripted run end-to-end in Vitest with no Phaser, no DOM, no `Date.now`, no `Math.random`.

**Architecture:** Pure functional core. State is a plain object; `step(state, dt) → state'` advances by a fixed timestep (1/60s). All non-determinism is funnelled through a seeded RNG carried in the state. Player intents are values (`SimInput`) applied via `applyInput(state, input) → state'`. The whole sim can be replayed exactly given `(seed, content, ordered inputs)`.

**Tech Stack:** TypeScript, Vitest. No Phaser, no React, no Node-specific APIs beyond what Vitest needs to run.

**Branch:** `FS-7`. Each commit prefixed `FS-7: `.

---

## Design notes (read first)

### State shape

```ts
interface SimState {
  tick: number; // integer, increments by 1 per step
  rng: RngState; // seeded RNG state (mulberry32-style number)
  mapId: string;
  difficulty: 'easy' | 'hard';
  pathLength: number; // precomputed
  cash: number;
  lives: number;
  phase: 'between-rounds' | 'in-round';
  currentRound: number; // 0-indexed; next round to start = currentRound
  totalRounds: number;
  speed: 1 | 2;
  paused: boolean;
  result: 'in-progress' | 'win' | 'lose';
  towers: TowerInstance[];
  creeps: CreepInstance[];
  spawnQueue: PendingSpawn[]; // queued creeps for the active wave
  nextEntityId: number; // monotonic id counter
}

interface TowerInstance {
  id: number;
  defId: string; // e.g. "arrow"
  x: number;
  y: number;
  upgrades: string[]; // applied upgrade node ids
  targeting: TargetingPriority;
  cooldownRemaining: number; // seconds until next shot
}

interface CreepInstance {
  id: number;
  defId: string;
  hp: number;
  shieldHp: number; // 0 if no shield ability
  distance: number; // distance traveled along path, in pixels
}

interface PendingSpawn {
  defId: string;
  spawnAt: number; // absolute sim seconds when this creep enters
}
```

### Time

- `TICK_HZ = 60` → `DT = 1/60`. `step()` advances exactly one tick.
- `state.tick * DT` gives current sim seconds. Helpers convert.
- `state.speed` is a _playback_ concern — applied by the harness (call `step` twice as often). The sim itself always advances by `DT` per `step` call. Keeps the sim purely deterministic regardless of speed.

### RNG

Mulberry32. Pure function `(state) → [next, value01]`. Carried in `state.rng`. Used for: nothing yet at MVP (combat is deterministic), but plumbed through so future ability rolls (e.g. critical hits) work.

### Inputs

```ts
type SimInput =
  | { type: 'placeTower'; defId: string; x: number; y: number }
  | { type: 'upgradeTower'; towerId: number; upgradeId: string }
  | { type: 'sellTower'; towerId: number }
  | { type: 'setTargeting'; towerId: number; priority: TargetingPriority }
  | { type: 'startNextRound' }
  | { type: 'setSpeed'; speed: 1 | 2 }
  | { type: 'setPaused'; paused: boolean };
```

`applyInput(state, input) → state'` returns the same state if the input is invalid (e.g. not enough cash, unknown tower id, can't upgrade because prereq missing). It does NOT throw — invalid inputs are silently ignored. This is what lets us replay logs that include rejected clicks.

### Combat resolution

Each step, for each tower:

1. Decrement `cooldownRemaining` by `DT`.
2. If `cooldownRemaining <= 0` and there's a creep in range matching the tower's targeting priority, fire: damage that creep using `effectiveDamage = damage × damageMatrix[damageType][creep.resistanceClass]`. Reset cooldown to `1 / attackSpeed`.

For MVP, projectiles are instant (single-target). Splash/piercing/chain are stubbed: they fire as single-target. Adding real projectile types is a later expansion.

Damage application order: shield hp first, then hp. When `creep.hp <= 0`: award bounty, remove. If creep had `spawnOnDeath`, enqueue N copies of the spawn creep at the dying creep's `distance` position (immediate spawn — they appear at that distance and continue along the path).

### Creep movement

Each step, for each creep: `creep.distance += creepDef.speed × DT`. If `creep.distance >= state.pathLength`: leak. Subtract `creepDef.leakDamage` from `state.lives`, remove the creep. If `state.lives <= 0`: `state.result = 'lose'`.

### Wave / round flow

- `phase = 'between-rounds'` initially. Sim doesn't spawn creeps. Player can act freely.
- `applyInput({type: 'startNextRound'})`: if `phase === 'between-rounds'` and `currentRound < totalRounds`, populate `spawnQueue` from `wavesEasy.waves[currentRound]` (or hard), set `phase = 'in-round'`. Creep `spawnAt` is computed from group `delay` + intra-group `spacing` × index, all relative to the _sim time at which startNextRound was applied_.
- Each step in `in-round`: peek at `spawnQueue`; while head's `spawnAt <= currentSeconds`, dequeue and spawn that creep at `distance: 0`.
- When `spawnQueue` is empty AND no live creeps remain: round ends. Increment `currentRound`. If `currentRound >= totalRounds`: `result = 'win'`. Else: `phase = 'between-rounds'`.

(There is intentionally no "start next round early" cash bonus in this plan — UI concern, deferred.)

### File map

**Created:**

- `src/game/sim/types.ts` — all interfaces and type unions (state, instances, inputs, content refs).
- `src/game/sim/rng.ts` — mulberry32 wrapped in pure helpers.
- `src/game/sim/path.ts` — path length + `positionAtDistance(path, d)`.
- `src/game/sim/state.ts` — `createInitialState({ map, difficulty, contentRegistry, seed })`.
- `src/game/sim/inputs.ts` — `applyInput(state, input)` dispatcher + per-input handlers.
- `src/game/sim/combat.ts` — tower targeting and damage application.
- `src/game/sim/creeps.ts` — creep movement + leak detection + death handling.
- `src/game/sim/waves.ts` — wave-to-spawnQueue conversion + per-step spawn dequeue.
- `src/game/sim/round.ts` — round-end detection + transition.
- `src/game/sim/step.ts` — top-level `step(state, ctx)` orchestrating combat → creeps → waves → round.
- `src/game/sim/replay.ts` — `runScript({ initial, ctx, script, maxTicks })` helper for tests + future replay.
- `src/game/sim/__tests__/*.test.ts` — one test file per module + an `e2e.test.ts`.

**Modified:**

- `content/creeps/sample-scout.yaml` — keep as-is, used in tests.
- A second creep (`tank.yaml`) added to enable multi-creep tests.

`SimContext` is a small bag of references the sim needs but doesn't mutate — typically the `ContentRegistry` from Plan A. We pass it explicitly to `step` and `applyInput` rather than embedding it in state, because it's content (immutable, comes from disk) not run state.

```ts
interface SimContext {
  registry: ContentRegistry;
  loadedMap: LoadedMap; // includes path + waves
}
```

---

## Phase 1 — Primitives

### Task 1: RNG

**Files:**

- Create: `src/game/sim/rng.ts`, `src/game/sim/__tests__/rng.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, expect, it } from 'vitest';
import { createRng, nextFloat, nextInt } from '@/game/sim/rng';

describe('rng', () => {
  it('is deterministic from a seed', () => {
    const a = createRng(12345);
    const b = createRng(12345);
    const [, va1] = nextFloat(a);
    const [, vb1] = nextFloat(b);
    expect(va1).toBe(vb1);
  });

  it('produces different sequences for different seeds', () => {
    const [, va] = nextFloat(createRng(1));
    const [, vb] = nextFloat(createRng(2));
    expect(va).not.toBe(vb);
  });

  it('nextInt is bounded', () => {
    let rng = createRng(7);
    for (let i = 0; i < 100; i++) {
      const [next, value] = nextInt(rng, 10);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(10);
      rng = next;
    }
  });
});
```

- [ ] **Step 2: Confirm fail**

```bash
npm test -- rng
```

- [ ] **Step 3: Implement**

```ts
// src/game/sim/rng.ts
export type RngState = number;

export function createRng(seed: number): RngState {
  // Coerce to 32-bit positive integer
  return seed >>> 0 || 1;
}

export function nextFloat(rng: RngState): [RngState, number] {
  let t = (rng + 0x6d2b79f5) >>> 0;
  let r = Math.imul(t ^ (t >>> 15), 1 | t);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  const value = ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  return [t, value];
}

export function nextInt(rng: RngState, exclusiveMax: number): [RngState, number] {
  const [next, value] = nextFloat(rng);
  return [next, Math.floor(value * exclusiveMax)];
}
```

- [ ] **Step 4: Pass + commit**

```bash
npm test -- rng
git add src/game/sim/rng.ts src/game/sim/__tests__/rng.test.ts
git commit -m "FS-7: deterministic RNG"
```

---

### Task 2: Path geometry

**Files:**

- Create: `src/game/sim/path.ts`, `src/game/sim/__tests__/path.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, expect, it } from 'vitest';
import { computePathLength, positionAtDistance } from '@/game/sim/path';

const path = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 20 },
];

describe('path', () => {
  it('computes total length as sum of segment lengths', () => {
    expect(computePathLength(path)).toBe(30);
  });

  it('positionAtDistance interpolates within a segment', () => {
    expect(positionAtDistance(path, 5)).toEqual({ x: 5, y: 0 });
    expect(positionAtDistance(path, 15)).toEqual({ x: 10, y: 5 });
  });

  it('clamps to endpoints', () => {
    expect(positionAtDistance(path, -1)).toEqual({ x: 0, y: 0 });
    expect(positionAtDistance(path, 9999)).toEqual({ x: 10, y: 20 });
  });
});
```

- [ ] **Step 2: Confirm fail**

```bash
npm test -- path
```

- [ ] **Step 3: Implement**

```ts
// src/game/sim/path.ts
export interface Point {
  x: number;
  y: number;
}

export function computePathLength(path: Point[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const dx = path[i].x - path[i - 1].x;
    const dy = path[i].y - path[i - 1].y;
    total += Math.hypot(dx, dy);
  }
  return total;
}

export function positionAtDistance(path: Point[], distance: number): Point {
  if (distance <= 0) return { x: path[0].x, y: path[0].y };
  let remaining = distance;
  for (let i = 1; i < path.length; i++) {
    const dx = path[i].x - path[i - 1].x;
    const dy = path[i].y - path[i - 1].y;
    const segLen = Math.hypot(dx, dy);
    if (remaining <= segLen) {
      const t = segLen === 0 ? 0 : remaining / segLen;
      return { x: path[i - 1].x + dx * t, y: path[i - 1].y + dy * t };
    }
    remaining -= segLen;
  }
  const last = path[path.length - 1];
  return { x: last.x, y: last.y };
}
```

- [ ] **Step 4: Pass + commit**

```bash
npm test -- path
git add src/game/sim/path.ts src/game/sim/__tests__/path.test.ts
git commit -m "FS-7: path length and position helpers"
```

---

## Phase 2 — Core types and state

### Task 3: Types + initial state factory

**Files:**

- Create: `src/game/sim/types.ts`, `src/game/sim/state.ts`, `src/game/sim/__tests__/state.test.ts`

- [ ] **Step 1: Write `src/game/sim/types.ts`**

```ts
import type { ContentRegistry, LoadedMap } from '@/content-loader/registry';
import type { TargetingPrioritySchema } from '@/content-loader/schemas/tower';
import type { z } from 'zod';
import type { RngState } from './rng';

export type Difficulty = 'easy' | 'hard';
export type SimResult = 'in-progress' | 'win' | 'lose';
export type SimPhase = 'between-rounds' | 'in-round';
export type TargetingPriority = z.infer<typeof TargetingPrioritySchema>;

export interface TowerInstance {
  id: number;
  defId: string;
  x: number;
  y: number;
  upgrades: string[];
  targeting: TargetingPriority;
  cooldownRemaining: number;
}

export interface CreepInstance {
  id: number;
  defId: string;
  hp: number;
  shieldHp: number;
  distance: number;
}

export interface PendingSpawn {
  defId: string;
  spawnAt: number; // sim seconds, absolute
  startDistance: number; // 0 for normal spawns; nonzero for spawnOnDeath children
}

export interface SimState {
  tick: number;
  rng: RngState;
  mapId: string;
  difficulty: Difficulty;
  pathLength: number;
  cash: number;
  lives: number;
  phase: SimPhase;
  currentRound: number;
  totalRounds: number;
  speed: 1 | 2;
  paused: boolean;
  result: SimResult;
  towers: TowerInstance[];
  creeps: CreepInstance[];
  spawnQueue: PendingSpawn[];
  nextEntityId: number;
}

export interface SimContext {
  registry: ContentRegistry;
  loadedMap: LoadedMap;
}

export const TICK_HZ = 60;
export const DT = 1 / TICK_HZ;
```

- [ ] **Step 2: Write failing test `src/game/sim/__tests__/state.test.ts`**

```ts
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadAllContent } from '@/content-loader/load';
import { buildRegistry } from '@/content-loader/registry';
import { createInitialState } from '@/game/sim/state';

const CONTENT_ROOT = path.resolve(__dirname, '../../../../content');

async function ctx() {
  const content = await loadAllContent(CONTENT_ROOT);
  const registry = buildRegistry(content);
  const loadedMap = registry.mapsById.get('in-the-loop')!;
  return { registry, loadedMap };
}

describe('createInitialState', () => {
  it('initializes state from a loaded map and difficulty', async () => {
    const c = await ctx();
    const s = createInitialState({ ctx: c, difficulty: 'easy', seed: 42 });
    expect(s.cash).toBe(c.loadedMap.map.difficulty.easy.startCash);
    expect(s.lives).toBe(c.loadedMap.map.difficulty.easy.startLives);
    expect(s.phase).toBe('between-rounds');
    expect(s.totalRounds).toBe(c.loadedMap.wavesEasy.waves.length);
    expect(s.pathLength).toBeGreaterThan(0);
    expect(s.tick).toBe(0);
  });
});
```

- [ ] **Step 3: Confirm fail**

```bash
npm test -- state
```

- [ ] **Step 4: Implement `src/game/sim/state.ts`**

```ts
import { computePathLength } from './path';
import { createRng } from './rng';
import type { Difficulty, SimContext, SimState } from './types';

export interface InitialStateInput {
  ctx: SimContext;
  difficulty: Difficulty;
  seed: number;
}

export function createInitialState({ ctx, difficulty, seed }: InitialStateInput): SimState {
  const map = ctx.loadedMap.map;
  const diff = map.difficulty[difficulty];
  const waves = difficulty === 'easy' ? ctx.loadedMap.wavesEasy : ctx.loadedMap.wavesHard;
  return {
    tick: 0,
    rng: createRng(seed),
    mapId: map.id,
    difficulty,
    pathLength: computePathLength(map.path),
    cash: diff.startCash,
    lives: diff.startLives,
    phase: 'between-rounds',
    currentRound: 0,
    totalRounds: waves.waves.length,
    speed: 1,
    paused: false,
    result: 'in-progress',
    towers: [],
    creeps: [],
    spawnQueue: [],
    nextEntityId: 1,
  };
}
```

- [ ] **Step 5: Pass + commit**

```bash
npm test -- state
git add src/game/sim/types.ts src/game/sim/state.ts src/game/sim/__tests__/state.test.ts
git commit -m "FS-7: sim types and initial state factory"
```

---

## Phase 3 — Movement, combat, waves

### Task 4: Creep movement + leak

**Files:**

- Create: `src/game/sim/creeps.ts`, `src/game/sim/__tests__/creeps.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadAllContent } from '@/content-loader/load';
import { buildRegistry } from '@/content-loader/registry';
import { advanceCreeps } from '@/game/sim/creeps';
import { createInitialState } from '@/game/sim/state';
import { DT } from '@/game/sim/types';

async function setup() {
  const content = await loadAllContent(path.resolve(__dirname, '../../../../content'));
  const registry = buildRegistry(content);
  const loadedMap = registry.mapsById.get('in-the-loop')!;
  const ctx = { registry, loadedMap };
  let state = createInitialState({ ctx, difficulty: 'easy', seed: 1 });
  return { ctx, state };
}

describe('advanceCreeps', () => {
  it('moves creeps along the path by speed * DT', async () => {
    const { ctx, state } = await setup();
    state.creeps.push({ id: 1, defId: 'scout', hp: 50, shieldHp: 0, distance: 0 });
    const next = advanceCreeps(state, ctx);
    // scout speed is 80 px/s
    expect(next.creeps[0].distance).toBeCloseTo(80 * DT, 6);
  });

  it('removes leaked creeps and deducts lives', async () => {
    const { ctx, state } = await setup();
    state.creeps.push({
      id: 1,
      defId: 'scout',
      hp: 50,
      shieldHp: 0,
      distance: state.pathLength - 0.0001,
    });
    const startLives = state.lives;
    const next = advanceCreeps(state, ctx);
    expect(next.creeps).toHaveLength(0);
    expect(next.lives).toBe(startLives - 1); // scout leakDamage = 1
  });

  it('sets result to lose when lives reach 0', async () => {
    const { ctx, state } = await setup();
    state.lives = 1;
    state.creeps.push({
      id: 1,
      defId: 'scout',
      hp: 50,
      shieldHp: 0,
      distance: state.pathLength,
    });
    const next = advanceCreeps(state, ctx);
    expect(next.lives).toBe(0);
    expect(next.result).toBe('lose');
  });
});
```

- [ ] **Step 2: Confirm fail**

```bash
npm test -- creeps
```

- [ ] **Step 3: Implement `src/game/sim/creeps.ts`**

```ts
import type { CreepInstance, SimContext, SimState } from './types';
import { DT } from './types';

export function advanceCreeps(state: SimState, ctx: SimContext): SimState {
  const surviving: CreepInstance[] = [];
  let lives = state.lives;
  let result = state.result;

  for (const creep of state.creeps) {
    const def = ctx.registry.creepsById.get(creep.defId);
    if (!def) continue; // defensive — should be impossible after validation
    const distance = creep.distance + def.speed * DT;
    if (distance >= state.pathLength) {
      lives -= def.leakDamage;
      if (lives <= 0) {
        lives = 0;
        result = 'lose';
      }
      continue;
    }
    surviving.push({ ...creep, distance });
  }

  return { ...state, creeps: surviving, lives, result };
}
```

- [ ] **Step 4: Pass + commit**

```bash
npm test -- creeps
git add src/game/sim/creeps.ts src/game/sim/__tests__/creeps.test.ts
git commit -m "FS-7: creep movement and leak detection"
```

---

### Task 5: Combat (tower targeting + damage)

**Files:**

- Create: `src/game/sim/combat.ts`, `src/game/sim/__tests__/combat.test.ts`
- Create: `content/creeps/sample-tank.yaml` (heavy resistance class — to validate matrix lookup)

- [ ] **Step 1: Write `content/creeps/sample-tank.yaml`**

```yaml
id: tank
name: Tank
hp: 200
speed: 30
movementLayer: ground
resistanceClass: heavy
bounty: 25
leakDamage: 5
abilities: []
```

- [ ] **Step 2: Write failing test**

```ts
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadAllContent } from '@/content-loader/load';
import { buildRegistry } from '@/content-loader/registry';
import { positionAtDistance } from '@/game/sim/path';
import { resolveCombat } from '@/game/sim/combat';
import { createInitialState } from '@/game/sim/state';

async function setup() {
  const content = await loadAllContent(path.resolve(__dirname, '../../../../content'));
  const registry = buildRegistry(content);
  const loadedMap = registry.mapsById.get('in-the-loop')!;
  const ctx = { registry, loadedMap };
  const state = createInitialState({ ctx, difficulty: 'easy', seed: 1 });
  return { ctx, state };
}

describe('resolveCombat', () => {
  it('a ready tower in range fires once per call and resets cooldown', async () => {
    const { ctx, state } = await setup();
    const where = positionAtDistance(ctx.loadedMap.map.path, 50);
    state.towers.push({
      id: 1,
      defId: 'arrow',
      x: where.x,
      y: where.y,
      upgrades: [],
      targeting: 'first',
      cooldownRemaining: 0,
    });
    state.creeps.push({ id: 2, defId: 'scout', hp: 50, shieldHp: 0, distance: 50 });

    const next = resolveCombat(state, ctx);
    // arrow base damage 10, physical vs light = 1.0 → scout hp 50 -> 40
    expect(next.creeps[0].hp).toBe(40);
    // attackSpeed 1.0 → cooldown reset to 1.0
    expect(next.towers[0].cooldownRemaining).toBeCloseTo(1.0, 6);
  });

  it('damage is multiplied by the type matrix (physical vs heavy = 0.5)', async () => {
    const { ctx, state } = await setup();
    const where = positionAtDistance(ctx.loadedMap.map.path, 50);
    state.towers.push({
      id: 1,
      defId: 'arrow',
      x: where.x,
      y: where.y,
      upgrades: [],
      targeting: 'first',
      cooldownRemaining: 0,
    });
    state.creeps.push({ id: 2, defId: 'tank', hp: 200, shieldHp: 0, distance: 50 });

    const next = resolveCombat(state, ctx);
    expect(next.creeps[0].hp).toBe(195); // 200 - (10 * 0.5)
  });

  it('a creep killed grants bounty cash and is removed', async () => {
    const { ctx, state } = await setup();
    const where = positionAtDistance(ctx.loadedMap.map.path, 50);
    state.towers.push({
      id: 1,
      defId: 'arrow',
      x: where.x,
      y: where.y,
      upgrades: [],
      targeting: 'first',
      cooldownRemaining: 0,
    });
    state.creeps.push({ id: 2, defId: 'scout', hp: 5, shieldHp: 0, distance: 50 });
    const startCash = state.cash;

    const next = resolveCombat(state, ctx);
    expect(next.creeps).toHaveLength(0);
    expect(next.cash).toBe(startCash + 5); // scout bounty
  });

  it('cooldown decrements when no target in range', async () => {
    const { ctx, state } = await setup();
    state.towers.push({
      id: 1,
      defId: 'arrow',
      x: 9999,
      y: 9999,
      upgrades: [],
      targeting: 'first',
      cooldownRemaining: 0.5,
    });
    const next = resolveCombat(state, ctx);
    expect(next.towers[0].cooldownRemaining).toBeLessThan(0.5);
  });
});
```

- [ ] **Step 3: Confirm fail**

```bash
npm test -- combat
```

- [ ] **Step 4: Implement `src/game/sim/combat.ts`**

```ts
import { positionAtDistance } from './path';
import type { CreepInstance, SimContext, SimState, TowerInstance } from './types';
import { DT } from './types';

interface EffectiveTowerStats {
  damage: number;
  attackSpeed: number;
  range: number;
}

function effectiveStats(tower: TowerInstance, ctx: SimContext): EffectiveTowerStats {
  const def = ctx.registry.towersById.get(tower.defId);
  if (!def) return { damage: 0, attackSpeed: 1, range: 0 };
  let damage = def.baseStats.damage;
  let attackSpeed = def.baseStats.attackSpeed;
  let range = def.baseStats.range;
  for (const upgradeId of tower.upgrades) {
    const upgrade = def.upgrades.find((u) => u.id === upgradeId);
    if (!upgrade) continue;
    if (upgrade.statDeltas.damage !== undefined) damage += upgrade.statDeltas.damage;
    if (upgrade.statDeltas.attackSpeed !== undefined) attackSpeed += upgrade.statDeltas.attackSpeed;
    if (upgrade.statDeltas.range !== undefined) range += upgrade.statDeltas.range;
  }
  return { damage, attackSpeed, range };
}

function pickTarget(
  tower: TowerInstance,
  range: number,
  creeps: CreepInstance[],
  ctx: SimContext,
): CreepInstance | null {
  const inRange: CreepInstance[] = [];
  for (const creep of creeps) {
    const def = ctx.registry.creepsById.get(creep.defId);
    if (!def) continue;
    const towerDef = ctx.registry.towersById.get(tower.defId);
    if (!towerDef || !towerDef.targetableLayers.includes(def.movementLayer)) continue;
    const pos = positionAtDistance(ctx.loadedMap.map.path, creep.distance);
    const dx = pos.x - tower.x;
    const dy = pos.y - tower.y;
    if (Math.hypot(dx, dy) <= range) inRange.push(creep);
  }
  if (inRange.length === 0) return null;
  switch (tower.targeting) {
    case 'first':
      return inRange.reduce((a, b) => (a.distance >= b.distance ? a : b));
    case 'last':
      return inRange.reduce((a, b) => (a.distance <= b.distance ? a : b));
    case 'strong':
      return inRange.reduce((a, b) => (a.hp + a.shieldHp >= b.hp + b.shieldHp ? a : b));
    case 'close': {
      let best = inRange[0];
      let bestDist = Infinity;
      for (const c of inRange) {
        const pos = positionAtDistance(ctx.loadedMap.map.path, c.distance);
        const d = Math.hypot(pos.x - tower.x, pos.y - tower.y);
        if (d < bestDist) {
          best = c;
          bestDist = d;
        }
      }
      return best;
    }
  }
}

function applyDamage(
  creep: CreepInstance,
  rawDamage: number,
  damageType: string,
  ctx: SimContext,
): CreepInstance {
  const def = ctx.registry.creepsById.get(creep.defId);
  if (!def) return creep;
  const matrix = ctx.registry.damageTypes.damageTypes[damageType];
  const multiplier = matrix?.[def.resistanceClass] ?? 1;
  let remaining = rawDamage * multiplier;
  let shieldHp = creep.shieldHp;
  if (shieldHp > 0) {
    const absorbed = Math.min(shieldHp, remaining);
    shieldHp -= absorbed;
    remaining -= absorbed;
  }
  return { ...creep, shieldHp, hp: creep.hp - remaining };
}

export function resolveCombat(state: SimState, ctx: SimContext): SimState {
  // Mutable copies for in-place evolution within this step
  let creeps: CreepInstance[] = state.creeps.map((c) => ({ ...c }));
  const towers: TowerInstance[] = [];
  let cash = state.cash;

  for (const tower of state.towers) {
    const towerDef = ctx.registry.towersById.get(tower.defId);
    const stats = effectiveStats(tower, ctx);
    let cooldown = tower.cooldownRemaining - DT;

    if (cooldown <= 0 && towerDef) {
      const target = pickTarget(tower, stats.range, creeps, ctx);
      if (target) {
        creeps = creeps.map((c) =>
          c.id === target.id ? applyDamage(c, stats.damage, towerDef.damageType, ctx) : c,
        );
        cooldown = stats.attackSpeed > 0 ? 1 / stats.attackSpeed : Infinity;
      } else {
        cooldown = 0; // ready, just no target
      }
    }

    towers.push({ ...tower, cooldownRemaining: Math.max(cooldown, 0) });
  }

  // Resolve deaths
  const survivors: CreepInstance[] = [];
  for (const creep of creeps) {
    if (creep.hp <= 0) {
      const def = ctx.registry.creepsById.get(creep.defId);
      if (def) cash += def.bounty;
      // spawnOnDeath handled in waves.ts via a post-pass; deferred until Task 8
      continue;
    }
    survivors.push(creep);
  }

  return { ...state, towers, creeps: survivors, cash };
}
```

- [ ] **Step 5: Pass + commit**

```bash
npm test -- combat
git add src/game/sim/combat.ts content/creeps/sample-tank.yaml src/game/sim/__tests__/combat.test.ts
git commit -m "FS-7: tower targeting and damage resolution"
```

---

### Task 6: Wave spawner

**Files:**

- Create: `src/game/sim/waves.ts`, `src/game/sim/__tests__/waves.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadAllContent } from '@/content-loader/load';
import { buildRegistry } from '@/content-loader/registry';
import { createInitialState } from '@/game/sim/state';
import { dequeueDueSpawns, enqueueWave } from '@/game/sim/waves';

async function setup() {
  const content = await loadAllContent(path.resolve(__dirname, '../../../../content'));
  const registry = buildRegistry(content);
  const loadedMap = registry.mapsById.get('in-the-loop')!;
  const ctx = { registry, loadedMap };
  const state = createInitialState({ ctx, difficulty: 'easy', seed: 1 });
  return { ctx, state };
}

describe('waves', () => {
  it('enqueueWave converts a wave into pending spawns at correct times', async () => {
    const { ctx, state } = await setup();
    // first wave easy: { creep: scout, count: 5, spacing: 0.8, delay: 0 }
    const next = enqueueWave(state, ctx, 0, 100); // currentSeconds = 100
    expect(next.spawnQueue).toHaveLength(5);
    expect(next.spawnQueue[0].spawnAt).toBe(100);
    expect(next.spawnQueue[1].spawnAt).toBeCloseTo(100.8, 6);
    expect(next.spawnQueue[4].spawnAt).toBeCloseTo(100 + 0.8 * 4, 6);
  });

  it('dequeueDueSpawns spawns creeps whose spawnAt <= currentSeconds', async () => {
    const { ctx, state } = await setup();
    let s = enqueueWave(state, ctx, 0, 0);
    s = dequeueDueSpawns(s, ctx, 0); // only the delay-0 one fires
    expect(s.creeps).toHaveLength(1);
    expect(s.spawnQueue).toHaveLength(4);

    s = dequeueDueSpawns(s, ctx, 0.8); // next one due
    expect(s.creeps).toHaveLength(2);
    expect(s.spawnQueue).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Confirm fail**

```bash
npm test -- waves
```

- [ ] **Step 3: Implement `src/game/sim/waves.ts`**

```ts
import type { CreepInstance, PendingSpawn, SimContext, SimState } from './types';

export function enqueueWave(
  state: SimState,
  ctx: SimContext,
  waveIndex: number,
  currentSeconds: number,
): SimState {
  const file = state.difficulty === 'easy' ? ctx.loadedMap.wavesEasy : ctx.loadedMap.wavesHard;
  const wave = file.waves[waveIndex];
  if (!wave) return state;

  const queue: PendingSpawn[] = [...state.spawnQueue];
  for (const group of wave.groups) {
    for (let i = 0; i < group.count; i++) {
      queue.push({
        defId: group.creep,
        spawnAt: currentSeconds + group.delay + group.spacing * i,
        startDistance: 0,
      });
    }
  }
  queue.sort((a, b) => a.spawnAt - b.spawnAt);
  return { ...state, spawnQueue: queue };
}

export function dequeueDueSpawns(
  state: SimState,
  ctx: SimContext,
  currentSeconds: number,
): SimState {
  const queue = state.spawnQueue;
  const remaining: PendingSpawn[] = [];
  const newCreeps: CreepInstance[] = [];
  let nextEntityId = state.nextEntityId;

  for (const pending of queue) {
    if (pending.spawnAt > currentSeconds) {
      remaining.push(pending);
      continue;
    }
    const def = ctx.registry.creepsById.get(pending.defId);
    if (!def) continue;
    const shieldAbility = def.abilities.find((a) => a.type === 'shield');
    newCreeps.push({
      id: nextEntityId++,
      defId: pending.defId,
      hp: def.hp,
      shieldHp: shieldAbility?.type === 'shield' ? shieldAbility.hp : 0,
      distance: pending.startDistance,
    });
  }

  return {
    ...state,
    creeps: [...state.creeps, ...newCreeps],
    spawnQueue: remaining,
    nextEntityId,
  };
}
```

- [ ] **Step 4: Pass + commit**

```bash
npm test -- waves
git add src/game/sim/waves.ts src/game/sim/__tests__/waves.test.ts
git commit -m "FS-7: wave spawn queue"
```

---

### Task 7: Round transitions + step orchestration

**Files:**

- Create: `src/game/sim/round.ts`, `src/game/sim/step.ts`, `src/game/sim/__tests__/step.test.ts`

- [ ] **Step 1: Write failing test (drives round resolution + the orchestrator)**

```ts
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadAllContent } from '@/content-loader/load';
import { buildRegistry } from '@/content-loader/registry';
import { createInitialState } from '@/game/sim/state';
import { step } from '@/game/sim/step';

async function setup() {
  const content = await loadAllContent(path.resolve(__dirname, '../../../../content'));
  const registry = buildRegistry(content);
  const loadedMap = registry.mapsById.get('in-the-loop')!;
  const ctx = { registry, loadedMap };
  const state = createInitialState({ ctx, difficulty: 'easy', seed: 1 });
  return { ctx, state };
}

describe('step', () => {
  it('does not advance creeps while paused', async () => {
    const { ctx, state } = await setup();
    state.creeps.push({ id: 1, defId: 'scout', hp: 50, shieldHp: 0, distance: 0 });
    state.paused = true;
    const next = step(state, ctx);
    expect(next.creeps[0].distance).toBe(0);
    expect(next.tick).toBe(0); // tick does not advance while paused
  });

  it('between rounds with no creeps does not transition', async () => {
    const { ctx, state } = await setup();
    const next = step(state, ctx);
    expect(next.phase).toBe('between-rounds');
    expect(next.currentRound).toBe(0);
  });

  it('in-round transitions to between-rounds when wave is empty and creeps cleared', async () => {
    const { ctx, state } = await setup();
    const s = { ...state, phase: 'in-round' as const };
    const next = step(s, ctx);
    expect(next.phase).toBe('between-rounds');
    expect(next.currentRound).toBe(1);
    expect(next.result).toBe('in-progress');
  });
});
```

- [ ] **Step 2: Confirm fail**

```bash
npm test -- step
```

- [ ] **Step 3: Implement `src/game/sim/round.ts`**

```ts
import type { SimContext, SimState } from './types';

export function maybeEndRound(state: SimState, _ctx: SimContext): SimState {
  if (state.phase !== 'in-round') return state;
  if (state.spawnQueue.length > 0) return state;
  if (state.creeps.length > 0) return state;
  const currentRound = state.currentRound + 1;
  if (currentRound >= state.totalRounds) {
    return { ...state, phase: 'between-rounds', currentRound, result: 'win' };
  }
  return { ...state, phase: 'between-rounds', currentRound };
}
```

- [ ] **Step 4: Implement `src/game/sim/step.ts`**

```ts
import { resolveCombat } from './combat';
import { advanceCreeps } from './creeps';
import { maybeEndRound } from './round';
import { dequeueDueSpawns } from './waves';
import type { SimContext, SimState } from './types';
import { DT } from './types';

export function step(state: SimState, ctx: SimContext): SimState {
  if (state.paused || state.result !== 'in-progress') return state;

  const tick = state.tick + 1;
  const seconds = tick * DT;
  let next: SimState = { ...state, tick };

  next = dequeueDueSpawns(next, ctx, seconds);
  next = resolveCombat(next, ctx);
  next = advanceCreeps(next, ctx);
  next = maybeEndRound(next, ctx);

  return next;
}
```

- [ ] **Step 5: Pass + commit**

```bash
npm test -- step
git add src/game/sim/round.ts src/game/sim/step.ts src/game/sim/__tests__/step.test.ts
git commit -m "FS-7: round transitions and step orchestrator"
```

---

## Phase 4 — Inputs

### Task 8: Inputs (place / upgrade / sell / targeting / startRound / speed / pause)

**Files:**

- Create: `src/game/sim/inputs.ts`, `src/game/sim/__tests__/inputs.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadAllContent } from '@/content-loader/load';
import { buildRegistry } from '@/content-loader/registry';
import { applyInput } from '@/game/sim/inputs';
import { createInitialState } from '@/game/sim/state';

async function setup() {
  const content = await loadAllContent(path.resolve(__dirname, '../../../../content'));
  const registry = buildRegistry(content);
  const loadedMap = registry.mapsById.get('in-the-loop')!;
  const ctx = { registry, loadedMap };
  const state = createInitialState({ ctx, difficulty: 'easy', seed: 1 });
  return { ctx, state };
}

describe('applyInput', () => {
  it('placeTower deducts cost and creates a tower', async () => {
    const { ctx, state } = await setup();
    const next = applyInput(state, ctx, { type: 'placeTower', defId: 'arrow', x: 10, y: 10 });
    expect(next.towers).toHaveLength(1);
    expect(next.cash).toBe(state.cash - 100);
  });

  it('placeTower with insufficient cash is ignored', async () => {
    const { ctx, state } = await setup();
    const broke = { ...state, cash: 0 };
    const next = applyInput(broke, ctx, { type: 'placeTower', defId: 'arrow', x: 10, y: 10 });
    expect(next).toEqual(broke);
  });

  it('upgradeTower applies the upgrade and deducts cost', async () => {
    const { ctx, state } = await setup();
    let s = applyInput(state, ctx, { type: 'placeTower', defId: 'arrow', x: 10, y: 10 });
    const towerId = s.towers[0].id;
    s = applyInput(s, ctx, { type: 'upgradeTower', towerId, upgradeId: 'arrow-1' });
    expect(s.towers[0].upgrades).toEqual(['arrow-1']);
    expect(s.cash).toBe(state.cash - 100 - 80);
  });

  it('upgradeTower respects prerequisites', async () => {
    const { ctx, state } = await setup();
    let s = applyInput(state, ctx, { type: 'placeTower', defId: 'arrow', x: 10, y: 10 });
    const towerId = s.towers[0].id;
    // arrow-2 requires arrow-1
    const before = s;
    s = applyInput(s, ctx, { type: 'upgradeTower', towerId, upgradeId: 'arrow-2' });
    expect(s).toEqual(before);
  });

  it('sellTower refunds 70% of cost paid', async () => {
    const { ctx, state } = await setup();
    let s = applyInput(state, ctx, { type: 'placeTower', defId: 'arrow', x: 10, y: 10 });
    s = applyInput(s, ctx, { type: 'upgradeTower', towerId: s.towers[0].id, upgradeId: 'arrow-1' });
    // total invested = 180; 70% refund = 126
    const beforeCash = s.cash;
    s = applyInput(s, ctx, { type: 'sellTower', towerId: s.towers[0].id });
    expect(s.towers).toHaveLength(0);
    expect(s.cash).toBe(beforeCash + 126);
  });

  it('startNextRound enqueues the next wave and switches phase', async () => {
    const { ctx, state } = await setup();
    const next = applyInput(state, ctx, { type: 'startNextRound' });
    expect(next.phase).toBe('in-round');
    expect(next.spawnQueue.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Confirm fail**

```bash
npm test -- inputs
```

- [ ] **Step 3: Implement `src/game/sim/inputs.ts`**

```ts
import type { Tower } from '@/content-loader/schemas';
import { enqueueWave } from './waves';
import type { SimContext, SimState, TargetingPriority, TowerInstance } from './types';
import { DT } from './types';

export type SimInput =
  | { type: 'placeTower'; defId: string; x: number; y: number }
  | { type: 'upgradeTower'; towerId: number; upgradeId: string }
  | { type: 'sellTower'; towerId: number }
  | { type: 'setTargeting'; towerId: number; priority: TargetingPriority }
  | { type: 'startNextRound' }
  | { type: 'setSpeed'; speed: 1 | 2 }
  | { type: 'setPaused'; paused: boolean };

function totalInvested(tower: TowerInstance, def: Tower): number {
  let cost = def.cost;
  for (const upgradeId of tower.upgrades) {
    const u = def.upgrades.find((x) => x.id === upgradeId);
    if (u) cost += u.cost;
  }
  return cost;
}

export function applyInput(state: SimState, ctx: SimContext, input: SimInput): SimState {
  if (state.result !== 'in-progress' && input.type !== 'setPaused') return state;

  switch (input.type) {
    case 'placeTower': {
      const def = ctx.registry.towersById.get(input.defId);
      if (!def) return state;
      if (state.cash < def.cost) return state;
      const tower: TowerInstance = {
        id: state.nextEntityId,
        defId: input.defId,
        x: input.x,
        y: input.y,
        upgrades: [],
        targeting: def.targetingDefaults.priority,
        cooldownRemaining: 0,
      };
      return {
        ...state,
        towers: [...state.towers, tower],
        cash: state.cash - def.cost,
        nextEntityId: state.nextEntityId + 1,
      };
    }

    case 'upgradeTower': {
      const tower = state.towers.find((t) => t.id === input.towerId);
      if (!tower) return state;
      const def = ctx.registry.towersById.get(tower.defId);
      if (!def) return state;
      const upgrade = def.upgrades.find((u) => u.id === input.upgradeId);
      if (!upgrade) return state;
      if (tower.upgrades.includes(upgrade.id)) return state;
      for (const req of upgrade.requires) {
        if (!tower.upgrades.includes(req)) return state;
      }
      if (state.cash < upgrade.cost) return state;
      return {
        ...state,
        cash: state.cash - upgrade.cost,
        towers: state.towers.map((t) =>
          t.id === tower.id ? { ...t, upgrades: [...t.upgrades, upgrade.id] } : t,
        ),
      };
    }

    case 'sellTower': {
      const tower = state.towers.find((t) => t.id === input.towerId);
      if (!tower) return state;
      const def = ctx.registry.towersById.get(tower.defId);
      if (!def) return state;
      const refund = Math.floor(totalInvested(tower, def) * 0.7);
      return {
        ...state,
        cash: state.cash + refund,
        towers: state.towers.filter((t) => t.id !== tower.id),
      };
    }

    case 'setTargeting': {
      return {
        ...state,
        towers: state.towers.map((t) =>
          t.id === input.towerId ? { ...t, targeting: input.priority } : t,
        ),
      };
    }

    case 'startNextRound': {
      if (state.phase !== 'between-rounds') return state;
      if (state.currentRound >= state.totalRounds) return state;
      const seconds = state.tick * DT;
      const enqueued = enqueueWave(state, ctx, state.currentRound, seconds);
      return { ...enqueued, phase: 'in-round' };
    }

    case 'setSpeed':
      return { ...state, speed: input.speed };

    case 'setPaused':
      return { ...state, paused: input.paused };
  }
}
```

- [ ] **Step 4: Pass + commit**

```bash
npm test -- inputs
git add src/game/sim/inputs.ts src/game/sim/__tests__/inputs.test.ts
git commit -m "FS-7: SimInput dispatcher"
```

---

## Phase 5 — Replay harness + end-to-end

### Task 9: spawnOnDeath wired into combat death pass

**Files:**

- Modify: `src/game/sim/combat.ts`
- Create: `src/game/sim/__tests__/spawn-on-death.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadAllContent } from '@/content-loader/load';
import { buildRegistry } from '@/content-loader/registry';
import { resolveCombat } from '@/game/sim/combat';
import { createInitialState } from '@/game/sim/state';

describe('spawnOnDeath', () => {
  it('spawns child creeps at the dying creep distance', async () => {
    // Synthesize an in-memory creep registry with a spawnOnDeath ability.
    const content = await loadAllContent(path.resolve(__dirname, '../../../../content'));
    const scoutDef = content.creeps.find((c) => c.id === 'scout')!;
    const bossDef = {
      ...scoutDef,
      id: 'boss',
      hp: 1,
      abilities: [{ type: 'spawnOnDeath' as const, spawn: 'scout', count: 2 }],
    };
    content.creeps.push(bossDef);
    const registry = buildRegistry(content);
    const loadedMap = registry.mapsById.get('in-the-loop')!;
    const ctx = { registry, loadedMap };
    const state = createInitialState({ ctx, difficulty: 'easy', seed: 1 });

    state.towers.push({
      id: 1,
      defId: 'arrow',
      x: 0,
      y: 100,
      upgrades: [],
      targeting: 'first',
      cooldownRemaining: 0,
    });
    state.creeps.push({ id: 2, defId: 'boss', hp: 1, shieldHp: 0, distance: 50 });

    const next = resolveCombat(state, ctx);
    const spawned = next.creeps.filter((c) => c.defId === 'scout');
    expect(spawned).toHaveLength(2);
    for (const c of spawned) expect(c.distance).toBe(50);
  });
});
```

- [ ] **Step 2: Modify the death pass in `src/game/sim/combat.ts`** — replace the existing `// Resolve deaths` block with:

```ts
// Resolve deaths
const survivors: CreepInstance[] = [];
let nextEntityId = state.nextEntityId;
for (const creep of creeps) {
  if (creep.hp > 0) {
    survivors.push(creep);
    continue;
  }
  const def = ctx.registry.creepsById.get(creep.defId);
  if (def) {
    cash += def.bounty;
    for (const ability of def.abilities) {
      if (ability.type === 'spawnOnDeath') {
        const childDef = ctx.registry.creepsById.get(ability.spawn);
        if (!childDef) continue;
        const shieldAbility = childDef.abilities.find((a) => a.type === 'shield');
        for (let i = 0; i < ability.count; i++) {
          survivors.push({
            id: nextEntityId++,
            defId: ability.spawn,
            hp: childDef.hp,
            shieldHp: shieldAbility?.type === 'shield' ? shieldAbility.hp : 0,
            distance: creep.distance,
          });
        }
      }
    }
  }
}

return { ...state, towers, creeps: survivors, cash, nextEntityId };
```

- [ ] **Step 3: Pass tests**

```bash
npm test -- spawn-on-death combat
```

Both must be green.

- [ ] **Step 4: Commit**

```bash
git add src/game/sim/combat.ts src/game/sim/__tests__/spawn-on-death.test.ts
git commit -m "FS-7: spawnOnDeath in death pass"
```

---

### Task 10: Replay harness + end-to-end test

**Files:**

- Create: `src/game/sim/replay.ts`, `src/game/sim/__tests__/e2e.test.ts`

- [ ] **Step 1: Implement `src/game/sim/replay.ts`**

```ts
import { applyInput, type SimInput } from './inputs';
import { step } from './step';
import type { SimContext, SimState } from './types';

export interface ScriptedAction {
  atTick: number;
  input: SimInput;
}

export interface RunScript {
  initial: SimState;
  ctx: SimContext;
  actions: ScriptedAction[];
  maxTicks: number;
}

export function runScript(script: RunScript): SimState {
  let state = script.initial;
  let actionIdx = 0;
  const actions = [...script.actions].sort((a, b) => a.atTick - b.atTick);

  while (state.tick < script.maxTicks && state.result === 'in-progress') {
    while (actionIdx < actions.length && actions[actionIdx].atTick <= state.tick) {
      state = applyInput(state, script.ctx, actions[actionIdx].input);
      actionIdx++;
    }
    state = step(state, script.ctx);
  }
  return state;
}
```

- [ ] **Step 2: Write the end-to-end test**

```ts
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadAllContent } from '@/content-loader/load';
import { buildRegistry } from '@/content-loader/registry';
import { runScript } from '@/game/sim/replay';
import { createInitialState } from '@/game/sim/state';

async function setup() {
  const content = await loadAllContent(path.resolve(__dirname, '../../../../content'));
  const registry = buildRegistry(content);
  const loadedMap = registry.mapsById.get('in-the-loop')!;
  const ctx = { registry, loadedMap };
  const initial = createInitialState({ ctx, difficulty: 'easy', seed: 1 });
  return { ctx, initial };
}

describe('e2e: scripted single-round run', () => {
  it('a tower placed near the path defends round 1 and lives are preserved', async () => {
    const { ctx, initial } = await setup();

    // Place tower right on the path so it kills creeps fast.
    const result = runScript({
      initial,
      ctx,
      actions: [
        { atTick: 0, input: { type: 'placeTower', defId: 'arrow', x: 100, y: 100 } },
        { atTick: 0, input: { type: 'startNextRound' } },
      ],
      maxTicks: 60 * 60, // up to 60 sim seconds
    });

    expect(result.lives).toBe(initial.lives);
    expect(result.currentRound).toBe(1);
    expect(result.phase).toBe('between-rounds');
  });

  it('with no defenses, creeps leak and lives drop', async () => {
    const { ctx, initial } = await setup();
    const result = runScript({
      initial,
      ctx,
      actions: [{ atTick: 0, input: { type: 'startNextRound' } }],
      maxTicks: 60 * 120,
    });
    expect(result.lives).toBeLessThan(initial.lives);
  });

  it('two runs from the same seed and script produce identical end states', async () => {
    const { ctx, initial } = await setup();
    const script = {
      ctx,
      maxTicks: 60 * 60,
      actions: [
        { atTick: 0, input: { type: 'placeTower' as const, defId: 'arrow', x: 100, y: 100 } },
        { atTick: 5, input: { type: 'startNextRound' as const } },
      ],
    };
    const a = runScript({ ...script, initial });
    const b = runScript({ ...script, initial });
    expect(a).toEqual(b);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
npm test
```

All tests must be green.

- [ ] **Step 4: Commit**

```bash
git add src/game/sim/replay.ts src/game/sim/__tests__/e2e.test.ts
git commit -m "FS-7: replay harness and end-to-end run"
```

---

### Task 11: Final verification + lint/format/CI checks

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
git diff --cached --quiet || git commit -m "FS-7: apply formatting"
```

---

## Done check

After all tasks:

- `src/game/sim/` has no Phaser, no React, no DOM, no Node-specific imports outside Vitest tests.
- A scripted run with one tower defends round 1 of `in-the-loop` Easy without losing a life.
- A scripted run with no towers leaks lives.
- Two identical scripts from the same seed produce byte-identical end states (`expect(a).toEqual(b)`).
- All previous tests still pass; CI script chain stays green.
- No game _render_ and no input log persistence yet — both deferred.
