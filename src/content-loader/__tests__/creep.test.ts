import { readFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { CreepSchema } from '@/content-loader/schemas/creep';

function loadFixture() {
  const file = path.resolve(__dirname, '../../../content/creeps/sample-scout.yaml');
  return yaml.load(readFileSync(file, 'utf8'));
}

describe('CreepSchema', () => {
  it('parses the sample-scout creep', () => {
    const creep = CreepSchema.parse(loadFixture());
    expect(creep.id).toBe('scout');
    expect(creep.movementLayer).toBe('ground');
    expect(creep.abilities).toEqual([]);
  });

  it('parses a spawnOnDeath ability', () => {
    const data = {
      ...(loadFixture() as object),
      abilities: [{ type: 'spawnOnDeath', spawn: 'tinyScout', count: 3 }],
    };
    const creep = CreepSchema.parse(data);
    const ability = creep.abilities[0];
    if (ability.type !== 'spawnOnDeath') throw new Error('discriminated union broken');
    expect(ability.spawn).toBe('tinyScout');
    expect(ability.count).toBe(3);
  });

  it('rejects an unknown ability type', () => {
    const bad = { ...(loadFixture() as object), abilities: [{ type: 'teleport' }] };
    expect(() => CreepSchema.parse(bad)).toThrow();
  });
});
