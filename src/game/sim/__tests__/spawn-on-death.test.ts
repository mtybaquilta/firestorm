import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadAllContent } from '@/content-loader/load';
import { buildRegistry } from '@/content-loader/registry';
import { resolveCombat } from '@/game/sim/combat';
import { createInitialState } from '@/game/sim/state';

describe('spawnOnDeath', () => {
  it('spawns child creeps at the dying creep distance', async () => {
    const content = await loadAllContent(path.resolve(__dirname, '../../../../content'));
    const scoutDef = content.creeps.find((c) => c.id === 'scout')!;
    const bossDef = {
      ...scoutDef,
      id: 'boss',
      hp: 1,
      abilities: [{ type: 'spawnOnDeath' as const, spawn: 'scout', count: 2 }],
    };
    content.creeps.push(bossDef);
    const registry = buildRegistry(content);
    const loadedMap = registry.mapsById.get('in-the-loop')!;
    const ctx = { registry, loadedMap };
    const state = createInitialState({ ctx, difficulty: 'easy', seed: 1 });

    state.towers.push({
      id: 1,
      defId: 'arrow',
      x: 0,
      y: 100,
      upgrades: [],
      targeting: 'first',
      cooldownRemaining: 0,
    });
    state.creeps.push({ id: 2, defId: 'boss', hp: 1, shieldHp: 0, distance: 50 });

    // Damage now applies on projectile impact, not on fire — step until settled.
    let next = resolveCombat(state, ctx);
    for (let i = 0; i < 60 && next.projectiles.length > 0; i++) {
      next = resolveCombat(next, ctx);
    }
    const spawned = next.creeps.filter((c) => c.defId === 'scout');
    expect(spawned).toHaveLength(2);
    for (const c of spawned) expect(c.distance).toBe(50);
  });
});
