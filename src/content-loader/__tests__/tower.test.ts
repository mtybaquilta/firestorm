import { readFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { TowerSchema } from '@/content-loader/schemas/tower';

function loadFixture() {
  const file = path.resolve(__dirname, '../../../content/towers/sample-arrow.yaml');
  return yaml.load(readFileSync(file, 'utf8'));
}

describe('TowerSchema', () => {
  it('parses the sample-arrow tower', () => {
    const tower = TowerSchema.parse(loadFixture());
    expect(tower.id).toBe('arrow');
    expect(tower.upgrades).toHaveLength(2);
    expect(tower.targetableLayers).toEqual(['ground']);
  });

  it('rejects an upgrade requiring an unknown prereq', () => {
    const bad = {
      ...(loadFixture() as object),
      upgrades: [{ id: 'a', requires: ['nonexistent'], cost: 10, statDeltas: {} }],
    };
    expect(() => TowerSchema.parse(bad)).toThrow();
  });

  it('rejects splash projectile behavior without splash params', () => {
    const fixture = loadFixture() as { baseStats: Record<string, unknown> };
    const bad = {
      ...fixture,
      baseStats: { ...fixture.baseStats, projectileBehavior: 'splash' },
    };
    expect(() => TowerSchema.parse(bad)).toThrow(/splashRadius/);
  });

  it('rejects slow-debuff projectile behavior without slow params', () => {
    const fixture = loadFixture() as { baseStats: Record<string, unknown> };
    const bad = {
      ...fixture,
      baseStats: { ...fixture.baseStats, projectileBehavior: 'slow-debuff' },
    };
    expect(() => TowerSchema.parse(bad)).toThrow(/slowMultiplier/);
  });
});
