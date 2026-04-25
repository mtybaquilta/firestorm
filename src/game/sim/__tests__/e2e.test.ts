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

    const result = runScript({
      initial,
      ctx,
      actions: [
        { atTick: 0, input: { type: 'placeTower', defId: 'arrow', x: 100, y: 100 } },
        { atTick: 0, input: { type: 'placeTower', defId: 'arrow', x: 200, y: 200 } },
        { atTick: 0, input: { type: 'placeTower', defId: 'arrow', x: 500, y: 300 } },
        { atTick: 0, input: { type: 'placeTower', defId: 'arrow', x: 700, y: 300 } },
        { atTick: 0, input: { type: 'startNextRound' } },
      ],
      maxTicks: 60 * 60,
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
    const baseScript = {
      ctx,
      maxTicks: 60 * 60,
      actions: [
        { atTick: 0, input: { type: 'placeTower' as const, defId: 'arrow', x: 100, y: 100 } },
        { atTick: 5, input: { type: 'startNextRound' as const } },
      ],
    };
    const a = runScript({ ...baseScript, initial });
    const b = runScript({ ...baseScript, initial });
    expect(a).toEqual(b);
  });
});
