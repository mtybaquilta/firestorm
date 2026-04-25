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
    expect(next.creeps[0].hp).toBe(40);
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
    expect(next.creeps[0].hp).toBe(195);
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
    expect(next.cash).toBe(startCash + 5);
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
