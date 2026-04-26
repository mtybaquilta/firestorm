import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadAllContent } from '@/content-loader/load';
import { buildRegistry } from '@/content-loader/registry';
import { positionAtDistance } from '@/game/sim/path';
import { resolveCombat } from '@/game/sim/combat';
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

describe('poison tower (DoT)', () => {
  it('applies the DoT schedule on impact and damages over time', async () => {
    const { ctx, state } = await setup();
    const where = positionAtDistance(ctx.loadedMap.map.path, 50);
    state.towers.push({
      id: 1,
      defId: 'poison',
      x: where.x,
      y: where.y,
      upgrades: [],
      targeting: 'first',
      cooldownRemaining: 0,
    });
    // Use a heavy tank so the 1 dmg impact doesn't kill it; physical vs heavy = 0.5x
    state.creeps.push({ id: 2, defId: 'tank', hp: 1000, shieldHp: 0, distance: 50 });

    // Settle the projectile so it lands and applies poison.
    let s = settleProjectiles(resolveCombat(state, ctx), ctx);
    const initial = s.creeps.find((c) => c.id === 2)!;
    expect(initial.poison).toBeDefined();
    expect(initial.poison!.damagesRemaining).toEqual([10, 10, 10, 10, 10, 8, 6, 4, 2, 0]);
    const hpAfterImpact = initial.hp;

    // Tick exactly TICK_HZ more ticks — first DoT damage of 10 should fire.
    // Note: the projectile's tower will keep firing each second, so isolate by
    // removing the tower after impact so we measure pure DoT progression.
    s = { ...s, towers: [] };
    for (let i = 0; i < TICK_HZ; i++) s = resolveCombat(s, ctx);
    const afterFirstTick = s.creeps.find((c) => c.id === 2)!;
    // 10 dmg vs heavy = 5 hp lost
    expect(hpAfterImpact - afterFirstTick.hp).toBeCloseTo(5, 6);
    expect(afterFirstTick.poison!.damagesRemaining).toEqual([10, 10, 10, 10, 8, 6, 4, 2, 0]);

    // Run the rest of the schedule out (9 more seconds).
    for (let i = 0; i < 9 * TICK_HZ; i++) s = resolveCombat(s, ctx);
    const final = s.creeps.find((c) => c.id === 2)!;
    expect(final.poison).toBeUndefined();
    // Total scheduled DoT = 10+10+10+10+10+8+6+4+2+0 = 70, halved by heavy resistance = 35.
    expect(hpAfterImpact - final.hp).toBeCloseTo(35, 6);
  });

  it('re-application by a poison tower resets the schedule (no magnitude stacking)', async () => {
    const { ctx, state } = await setup();
    state.creeps.push({
      id: 1,
      defId: 'tank',
      hp: 1000,
      shieldHp: 0,
      distance: 50,
      poison: {
        damagesRemaining: [2, 0], // mid-decay, almost spent
        ticksUntilNext: 30,
        damageType: 'physical',
      },
    });
    const where = positionAtDistance(ctx.loadedMap.map.path, 50);
    state.towers.push({
      id: 2,
      defId: 'poison',
      x: where.x,
      y: where.y,
      upgrades: [],
      targeting: 'first',
      cooldownRemaining: 0,
    });

    const settled = settleProjectiles(resolveCombat(state, ctx), ctx);
    const c = settled.creeps.find((cr) => cr.id === 1)!;
    // Schedule resets to fresh 10-step curve; previous mid-decay state replaced.
    expect(c.poison!.damagesRemaining.length).toBe(10);
    expect(c.poison!.damagesRemaining[0]).toBe(10);
  });
});

describe('fire turret (zone damage)', () => {
  it('damages all creeps inside burn radius each fire tick, no projectile spawned', async () => {
    const { ctx, state } = await setup();
    const where = positionAtDistance(ctx.loadedMap.map.path, 50);
    state.towers.push({
      id: 1,
      defId: 'fire-turret',
      x: where.x,
      y: where.y,
      upgrades: [],
      targeting: 'first',
      cooldownRemaining: 0,
    });
    // Creep at the same path point as tower → in zone
    state.creeps.push({ id: 2, defId: 'tank', hp: 1000, shieldHp: 0, distance: 50 });

    const next = resolveCombat(state, ctx);
    expect(next.projectiles).toHaveLength(0);
    // 8 dmg vs heavy = 4 hp lost
    expect(1000 - next.creeps[0].hp).toBeCloseTo(4, 6);
    // 2/s attackSpeed → cooldown 0.5s
    expect(next.towers[0].cooldownRemaining).toBeCloseTo(0.5, 6);
    expect(next.towers[0].lastFiredTick).toBe(state.tick);
  });

  it('does not damage creeps outside burn radius', async () => {
    const { ctx, state } = await setup();
    const where = positionAtDistance(ctx.loadedMap.map.path, 50);
    state.towers.push({
      id: 1,
      defId: 'fire-turret',
      x: where.x,
      y: where.y,
      upgrades: [],
      targeting: 'first',
      cooldownRemaining: 0,
    });
    // Far creep way past the 60px burn radius
    state.creeps.push({ id: 2, defId: 'tank', hp: 1000, shieldHp: 0, distance: 600 });

    const next = resolveCombat(state, ctx);
    expect(next.creeps[0].hp).toBe(1000);
    // No creep in zone → cooldown stays at 0 (does not commit to a fire cycle)
    expect(next.towers[0].cooldownRemaining).toBe(0);
  });
});

describe('sniper (long range single-target)', () => {
  it('hits hard and reaches creeps far outside arrow tower range', async () => {
    const { ctx, state } = await setup();
    const where = positionAtDistance(ctx.loadedMap.map.path, 50);
    state.towers.push({
      id: 1,
      defId: 'sniper',
      x: where.x,
      y: where.y,
      upgrades: [],
      targeting: 'first',
      cooldownRemaining: 0,
    });
    // Way beyond arrow tower's 150 range, comfortably inside sniper's 800 range
    state.creeps.push({ id: 2, defId: 'scout', hp: 1000, shieldHp: 0, distance: 350 });

    const settled = settleProjectiles(resolveCombat(state, ctx), ctx);
    // 150 dmg vs scout (light) at physical multiplier (assumed 1.0 for light)
    expect(1000 - settled.creeps[0].hp).toBeGreaterThan(0);
    expect(1000 - settled.creeps[0].hp).toBeLessThanOrEqual(150);
  });
});
