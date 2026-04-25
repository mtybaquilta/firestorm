import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadAllContent } from '@/content-loader/load';
import { buildRegistry } from '@/content-loader/registry';
import { distanceToPolyline, isValidPlacement } from '@/game/sim/placement';
import { createInitialState } from '@/game/sim/state';

async function setup() {
  const content = await loadAllContent(path.resolve(__dirname, '../../../../content'));
  const registry = buildRegistry(content);
  const loadedMap = registry.mapsById.get('in-the-loop')!;
  const ctx = { registry, loadedMap };
  const state = createInitialState({ ctx, difficulty: 'easy', seed: 1 });
  return { ctx, state };
}

describe('distanceToPolyline', () => {
  it('returns the perpendicular distance to the nearest segment', () => {
    const polyline = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    expect(distanceToPolyline({ x: 5, y: 3 }, polyline)).toBeCloseTo(3);
  });

  it('clamps to endpoints for points past the segment', () => {
    const polyline = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    expect(distanceToPolyline({ x: -5, y: 0 }, polyline)).toBeCloseTo(5);
    expect(distanceToPolyline({ x: 15, y: 0 }, polyline)).toBeCloseTo(5);
  });
});

describe('isValidPlacement', () => {
  it('rejects placements too close to the path', async () => {
    const { ctx, state } = await setup();
    expect(isValidPlacement(state, ctx, 50, 105)).toBe(false);
  });

  it('accepts placements far from the path', async () => {
    const { ctx, state } = await setup();
    expect(isValidPlacement(state, ctx, 500, 50)).toBe(true);
  });

  it('rejects placements on top of existing towers', async () => {
    const { ctx, state } = await setup();
    state.towers.push({
      id: 1,
      defId: 'arrow',
      x: 500,
      y: 50,
      upgrades: [],
      targeting: 'first',
      cooldownRemaining: 0,
    });
    expect(isValidPlacement(state, ctx, 500, 50)).toBe(false);
    expect(isValidPlacement(state, ctx, 600, 50)).toBe(true);
  });
});
