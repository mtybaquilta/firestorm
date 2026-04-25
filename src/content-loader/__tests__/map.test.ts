import { readFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { MapSchema } from '@/content-loader/schemas/map';

function load(file: string) {
  return yaml.load(readFileSync(path.resolve(__dirname, '../../../', file), 'utf8'));
}

describe('MapSchema', () => {
  it.each(['content/maps/in-the-loop/map.yaml', 'content/maps/logs/map.yaml'])(
    'parses %s',
    (file) => {
      const map = MapSchema.parse(load(file));
      expect(map.path.length).toBeGreaterThanOrEqual(2);
      expect(map.difficulty.easy.startLives).toBeGreaterThan(0);
    },
  );

  it('rejects a path with fewer than 2 points', () => {
    expect(() =>
      MapSchema.parse({
        id: 'x',
        name: 'X',
        background: '/x.png',
        placementMask: '/x.png',
        path: [{ x: 0, y: 0 }],
        difficulty: {
          easy: { startCash: 1, startLives: 1, waves: 'waves-easy.yaml' },
          hard: { startCash: 1, startLives: 1, waves: 'waves-hard.yaml' },
        },
      }),
    ).toThrow();
  });
});
