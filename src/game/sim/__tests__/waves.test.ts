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
    const next = enqueueWave(state, ctx, 0, 100);
    expect(next.spawnQueue).toHaveLength(5);
    expect(next.spawnQueue[0].spawnAt).toBe(100);
    expect(next.spawnQueue[1].spawnAt).toBeCloseTo(100.8, 6);
    expect(next.spawnQueue[4].spawnAt).toBeCloseTo(100 + 0.8 * 4, 6);
  });

  it('dequeueDueSpawns spawns creeps whose spawnAt <= currentSeconds', async () => {
    const { ctx, state } = await setup();
    let s = enqueueWave(state, ctx, 0, 0);
    s = dequeueDueSpawns(s, ctx, 0);
    expect(s.creeps).toHaveLength(1);
    expect(s.spawnQueue).toHaveLength(4);

    s = dequeueDueSpawns(s, ctx, 0.8);
    expect(s.creeps).toHaveLength(2);
    expect(s.spawnQueue).toHaveLength(3);
  });
});
