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
    const before = s;
    s = applyInput(s, ctx, { type: 'upgradeTower', towerId, upgradeId: 'arrow-2' });
    expect(s).toEqual(before);
  });

  it('sellTower refunds 70% of cost paid', async () => {
    const { ctx, state } = await setup();
    let s = applyInput(state, ctx, { type: 'placeTower', defId: 'arrow', x: 10, y: 10 });
    s = applyInput(s, ctx, { type: 'upgradeTower', towerId: s.towers[0].id, upgradeId: 'arrow-1' });
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
