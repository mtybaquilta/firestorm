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
    expect(next.tick).toBe(0);
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
