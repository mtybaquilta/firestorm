import { readFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { WaveFileSchema } from '@/content-loader/schemas/wave';

function load(file: string) {
  return yaml.load(readFileSync(path.resolve(__dirname, '../../../', file), 'utf8'));
}

describe('WaveFileSchema', () => {
  it('parses in-the-loop easy waves', () => {
    const data = WaveFileSchema.parse(load('content/maps/in-the-loop/waves-easy.yaml'));
    expect(data.waves.length).toBeGreaterThanOrEqual(2);
    expect(data.waves[0].groups[0].creep).toBe('scout');
  });

  it('accepts an empty wave list (stubbed difficulty)', () => {
    const data = WaveFileSchema.parse(load('content/maps/in-the-loop/waves-hard.yaml'));
    expect(data.waves).toEqual([]);
  });

  it('rejects negative spacing', () => {
    expect(() =>
      WaveFileSchema.parse({
        waves: [{ groups: [{ creep: 'scout', count: 1, spacing: -1, delay: 0 }] }],
      }),
    ).toThrow();
  });
});
