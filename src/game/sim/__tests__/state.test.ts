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
