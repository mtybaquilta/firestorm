import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadAllContent } from '@/content-loader/load';
import { buildRegistry } from '@/content-loader/registry';
import { positionAtDistance } from '@/game/sim/path';
import { resolveCombat } from '@/game/sim/combat';
import { advanceCreeps } from '@/game/sim/creeps';
import { createInitialState } from '@/game/sim/state';
import { TICK_HZ } from '@/game/sim/types';
import type { SimContext, SimState } from '@/game/sim/types';

async function setup() {
  const content = await loadAllContent(path.resolve(__dirname, '../../../../content'));
  const registry = buildRegistry(content);
  const loadedMap = registry.mapsById.get('in-the-loop')!;
  const ctx = { registry, loadedMap };
  const state = createInitialState({ ctx, difficulty: 'easy', seed: 1 });
  return { ctx, state };
}

function settleProjectiles(state: SimState, ctx: SimContext, maxTicks = 120): SimState {
  let s = state;
  for (let i = 0; i < maxTicks; i++) {
    s = resolveCombat(s, ctx);
    if (s.projectiles.length === 0) return s;
  }
  return s;
}

describe('mortar (splash)', () => {
  it('damages the primary target at full damage and nearby creeps at the splash ratio', async () => {
    const { ctx, state } = await setup();
    const where = positionAtDistance(ctx.loadedMap.map.path, 50);
    state.towers.push({
      id: 1,
      defId: 'mortar',
      x: where.x,
      y: where.y,
      upgrades: [],
      targeting: 'first',
      cooldownRemaining: 0,
    });
    // Two creeps near each other on the path — both should be in splash radius
    // because their path positions are close (within 80px splash radius).
    state.creeps.push({ id: 2, defId: 'tank', hp: 500, shieldHp: 0, distance: 50 });
    state.creeps.push({ id: 3, defId: 'tank', hp: 500, shieldHp: 0, distance: 30 });

    const settled = settleProjectiles(resolveCombat(state, ctx), ctx);
    const primary = settled.creeps.find((c) => c.id === 2)!;
    const secondary = settled.creeps.find((c) => c.id === 3)!;
    // Mortar damage 20 vs tank (heavy resistance class, physical multiplier 0.5):
    // primary takes 20 * 0.5 = 10
    // secondary takes 20 * 0.25 (splashRatio) * 0.5 = 2.5
    expect(500 - primary.hp).toBeCloseTo(10, 6);
    expect(500 - secondary.hp).toBeCloseTo(2.5, 6);
  });

  it('does not splash to creeps outside the splash radius', async () => {
    const { ctx, state } = await setup();
    const where = positionAtDistance(ctx.loadedMap.map.path, 50);
    state.towers.push({
      id: 1,
      defId: 'mortar',
      x: where.x,
      y: where.y,
      upgrades: [],
      targeting: 'first',
      cooldownRemaining: 0,
    });
    // Far creep is way down the path, well outside the 80px splash radius.
    state.creeps.push({ id: 2, defId: 'tank', hp: 500, shieldHp: 0, distance: 50 });
    state.creeps.push({ id: 3, defId: 'tank', hp: 500, shieldHp: 0, distance: 600 });

    const settled = settleProjectiles(resolveCombat(state, ctx), ctx);
    const far = settled.creeps.find((c) => c.id === 3)!;
    expect(far.hp).toBe(500);
  });
});

describe('slow tower (movement debuff)', () => {
  it('hits a creep and applies a movement slow that reduces speed', async () => {
    const { ctx, state } = await setup();
    const where = positionAtDistance(ctx.loadedMap.map.path, 50);
    state.towers.push({
      id: 1,
      defId: 'slow',
      x: where.x,
      y: where.y,
      upgrades: [],
      targeting: 'first',
      cooldownRemaining: 0,
    });
    state.creeps.push({ id: 2, defId: 'scout', hp: 1000, shieldHp: 0, distance: 50 });

    const settled = settleProjectiles(resolveCombat(state, ctx), ctx);
    const slowed = settled.creeps.find((c) => c.id === 2)!;
    expect(slowed.slow).toBeDefined();
    expect(slowed.slow!.multiplier).toBe(0.65);
    expect(slowed.slow!.remainingTicks).toBe(2 * TICK_HZ);
  });

  it('slowed creep moves at the reduced speed', async () => {
    const { ctx, state } = await setup();
    state.creeps.push({
      id: 1,
      defId: 'scout',
      hp: 1000,
      shieldHp: 0,
      distance: 0,
      slow: { multiplier: 0.5, remainingTicks: 60 },
    });
    // Scout speed is 80 px/s; with 0.5 multiplier → 40 px/s.
    // After 1s (60 ticks) the slowed creep should have advanced ~40px.
    let s = state;
    for (let i = 0; i < TICK_HZ; i++) s = advanceCreeps(s, ctx);
    expect(s.creeps[0].distance).toBeCloseTo(40, 1);
  });

  it('slow expires after the configured duration', async () => {
    const { ctx, state } = await setup();
    state.creeps.push({
      id: 1,
      defId: 'scout',
      hp: 1000,
      shieldHp: 0,
      distance: 0,
      slow: { multiplier: 0.5, remainingTicks: 5 },
    });
    let s = state;
    for (let i = 0; i < 5; i++) s = advanceCreeps(s, ctx);
    expect(s.creeps[0].slow).toBeUndefined();
  });

  it('stronger slow overrides a weaker active slow; weaker is ignored', async () => {
    const { ctx, state } = await setup();
    // Pre-existing weak slow (0.9 = -10%) on the creep.
    state.creeps.push({
      id: 1,
      defId: 'scout',
      hp: 1000,
      shieldHp: 0,
      distance: 50,
      slow: { multiplier: 0.9, remainingTicks: 10 },
    });
    const where = positionAtDistance(ctx.loadedMap.map.path, 50);
    // Slow tower applies 0.65 (stronger) — should replace the weak slow.
    state.towers.push({
      id: 2,
      defId: 'slow',
      x: where.x,
      y: where.y,
      upgrades: [],
      targeting: 'first',
      cooldownRemaining: 0,
    });

    const settled = settleProjectiles(resolveCombat(state, ctx), ctx);
    const c = settled.creeps.find((cr) => cr.id === 1)!;
    expect(c.slow!.multiplier).toBe(0.65);
  });

  it('weaker slow does not override a stronger active slow', async () => {
    const { ctx, state } = await setup();
    // Strong active slow already on the creep.
    state.creeps.push({
      id: 1,
      defId: 'scout',
      hp: 1000,
      shieldHp: 0,
      distance: 50,
      slow: { multiplier: 0.4, remainingTicks: 100 },
    });
    const where = positionAtDistance(ctx.loadedMap.map.path, 50);
    state.towers.push({
      id: 2,
      defId: 'slow',
      x: where.x,
      y: where.y,
      upgrades: [],
      targeting: 'first',
      cooldownRemaining: 0,
    });

    const settled = settleProjectiles(resolveCombat(state, ctx), ctx);
    const c = settled.creeps.find((cr) => cr.id === 1)!;
    expect(c.slow!.multiplier).toBe(0.4);
    expect(c.slow!.remainingTicks).toBeGreaterThan(80); // unchanged-ish
  });
});
