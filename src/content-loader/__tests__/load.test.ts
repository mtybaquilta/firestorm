import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadAllContent } from '@/content-loader/load';

const CONTENT_ROOT = path.resolve(__dirname, '../../../content');

describe('loadAllContent', () => {
  it('loads damage types, towers, creeps, and maps from the repo content directory', async () => {
    const content = await loadAllContent(CONTENT_ROOT);

    expect(content.damageTypes.damageTypes.physical).toBeDefined();
    expect(content.towers.find((t) => t.id === 'arrow')).toBeDefined();
    expect(content.creeps.find((c) => c.id === 'scout')).toBeDefined();

    const inTheLoop = content.maps.find((m) => m.map.id === 'in-the-loop');
    expect(inTheLoop).toBeDefined();
    expect(inTheLoop!.wavesEasy.waves.length).toBeGreaterThan(0);
    expect(inTheLoop!.wavesHard.waves).toEqual([]);
  });
});
