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
  const state = createInitialState({ ctx, difficulty: 'easy', seed: 1 });
  return { ctx, state };
}

describe('advanceCreeps', () => {
  it('moves creeps along the path by speed * DT', async () => {
    const { ctx, state } = await setup();
    state.creeps.push({ id: 1, defId: 'scout', hp: 50, shieldHp: 0, distance: 0 });
    const next = advanceCreeps(state, ctx);
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
    expect(next.lives).toBe(startLives - 1);
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
