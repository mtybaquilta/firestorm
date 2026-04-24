import { readFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { DamageTypesSchema } from '@/content-loader/schemas/damage-types';

function loadFixture() {
  const file = path.resolve(__dirname, '../../../content/damage-types.yaml');
  return yaml.load(readFileSync(file, 'utf8'));
}

describe('DamageTypesSchema', () => {
  it('parses the bundled damage-types.yaml', () => {
    const parsed = DamageTypesSchema.parse(loadFixture());
    expect(parsed.resistanceClasses).toContain('light');
    expect(parsed.damageTypes.physical.heavy).toBe(0.5);
  });

  it('rejects a damage type missing a resistance class entry', () => {
    const bad = {
      resistanceClasses: ['light', 'heavy'],
      damageTypes: { physical: { light: 1 } },
    };
    expect(() => DamageTypesSchema.parse(bad)).toThrow();
  });
});
