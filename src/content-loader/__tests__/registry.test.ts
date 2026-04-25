import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadAllContent } from '@/content-loader/load';
import { buildRegistry } from '@/content-loader/registry';

const CONTENT_ROOT = path.resolve(__dirname, '../../../content');

describe('buildRegistry', () => {
  it('indexes loaded content and resolves cross-references', async () => {
    const content = await loadAllContent(CONTENT_ROOT);
    const registry = buildRegistry(content);

    expect(registry.towersById.get('arrow')?.name).toBe('Arrow Tower');
    expect(registry.creepsById.get('scout')?.hp).toBeGreaterThan(0);
    expect(registry.mapsById.get('in-the-loop')?.map.name).toBe('In The Loop');
  });

  it('throws when a tower references an unknown damage type', async () => {
    const content = await loadAllContent(CONTENT_ROOT);
    content.towers.push({
      ...content.towers[0],
      id: 'broken',
      damageType: 'nonexistent',
    });
    expect(() => buildRegistry(content)).toThrow(/damageType/);
  });

  it('throws when a wave references an unknown creep', async () => {
    const content = await loadAllContent(CONTENT_ROOT);
    const map = content.maps[0];
    map.wavesEasy.waves.push({
      groups: [{ creep: 'ghost-creep-id', count: 1, spacing: 1, delay: 0 }],
    });
    expect(() => buildRegistry(content)).toThrow(/ghost-creep-id/);
  });
});
