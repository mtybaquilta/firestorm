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
    // Below MAX_DT so the dt isn't clamped: 0.05s × 2× speed = 0.1s sim → 6 ticks.
    bus.emit('intent:setSpeed', { speed: 2 });
    runner.tick(0.05);
    expect(runner.getState().tick).toBe(6);
  });

  it('does not advance while paused', async () => {
    const { runner, bus } = await setup();
    runner.start();
    bus.emit('intent:setPaused', { paused: true });
    runner.tick(1);
    expect(runner.getState().tick).toBe(0);
  });
});
