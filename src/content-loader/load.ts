import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';
import {
  CreepSchema,
  DamageTypesSchema,
  MapSchema,
  TowerSchema,
  WaveFileSchema,
  type Creep,
  type DamageTypes,
  type GameMap,
  type Tower,
  type WaveFile,
} from './schemas';

export interface LoadedMap {
  map: GameMap;
  wavesEasy: WaveFile;
  wavesHard: WaveFile;
}

export interface LoadedContent {
  damageTypes: DamageTypes;
  towers: Tower[];
  creeps: Creep[];
  maps: LoadedMap[];
}

async function readYaml(file: string): Promise<unknown> {
  return yaml.load(await readFile(file, 'utf8'));
}

async function readDirYaml<T>(
  dir: string,
  parse: (raw: unknown, file: string) => T,
): Promise<T[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile() && e.name.endsWith('.yaml'))
    .map((e) => path.join(dir, e.name));
  return Promise.all(
    files.map(async (file) => {
      try {
        return parse(await readYaml(file), file);
      } catch (err) {
        throw new Error(`Failed to load ${file}: ${(err as Error).message}`);
      }
    }),
  );
}

export async function loadAllContent(contentRoot: string): Promise<LoadedContent> {
  const damageTypes = DamageTypesSchema.parse(
    await readYaml(path.join(contentRoot, 'damage-types.yaml')),
  );

  const towers = await readDirYaml(path.join(contentRoot, 'towers'), (raw) =>
    TowerSchema.parse(raw),
  );

  const creeps = await readDirYaml(path.join(contentRoot, 'creeps'), (raw) =>
    CreepSchema.parse(raw),
  );

  const mapsDir = path.join(contentRoot, 'maps');
  const mapDirs = (await readdir(mapsDir, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => path.join(mapsDir, e.name));

  const maps = await Promise.all(
    mapDirs.map(async (dir): Promise<LoadedMap> => {
      const map = MapSchema.parse(await readYaml(path.join(dir, 'map.yaml')));
      const wavesEasy = WaveFileSchema.parse(
        await readYaml(path.join(dir, map.difficulty.easy.waves)),
      );
      const wavesHard = WaveFileSchema.parse(
        await readYaml(path.join(dir, map.difficulty.hard.waves)),
      );
      return { map, wavesEasy, wavesHard };
    }),
  );

  return { damageTypes, towers, creeps, maps };
}
