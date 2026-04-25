import type { LoadedContent, LoadedMap } from './load';
import type { Creep, Tower } from './schemas';

export interface ContentRegistry {
  damageTypes: LoadedContent['damageTypes'];
  towersById: Map<string, Tower>;
  creepsById: Map<string, Creep>;
  mapsById: Map<string, LoadedMap>;
}

function indexById<T extends { id: string }>(items: T[], kind: string): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    if (map.has(item.id)) {
      throw new Error(`Duplicate ${kind} id: ${item.id}`);
    }
    map.set(item.id, item);
  }
  return map;
}

export function buildRegistry(content: LoadedContent): ContentRegistry {
  const towersById = indexById(content.towers, 'tower');
  const creepsById = indexById(content.creeps, 'creep');

  const mapsById = new Map<string, LoadedMap>();
  for (const loaded of content.maps) {
    if (mapsById.has(loaded.map.id)) {
      throw new Error(`Duplicate map id: ${loaded.map.id}`);
    }
    mapsById.set(loaded.map.id, loaded);
  }

  const damageTypeNames = new Set(Object.keys(content.damageTypes.damageTypes));
  const resistanceClasses = new Set(content.damageTypes.resistanceClasses);

  for (const tower of towersById.values()) {
    if (!damageTypeNames.has(tower.damageType)) {
      throw new Error(`Tower "${tower.id}" damageType "${tower.damageType}" is not defined`);
    }
  }

  for (const creep of creepsById.values()) {
    if (!resistanceClasses.has(creep.resistanceClass)) {
      throw new Error(
        `Creep "${creep.id}" resistanceClass "${creep.resistanceClass}" is not defined`,
      );
    }
    for (const ability of creep.abilities) {
      if (ability.type === 'spawnOnDeath' && !creepsById.has(ability.spawn)) {
        throw new Error(
          `Creep "${creep.id}" spawnOnDeath references unknown creep "${ability.spawn}"`,
        );
      }
    }
  }

  for (const loadedMap of mapsById.values()) {
    for (const file of [loadedMap.wavesEasy, loadedMap.wavesHard]) {
      for (const wave of file.waves) {
        for (const group of wave.groups) {
          if (!creepsById.has(group.creep)) {
            throw new Error(
              `Map "${loadedMap.map.id}" wave references unknown creep "${group.creep}"`,
            );
          }
        }
      }
    }
  }

  return { damageTypes: content.damageTypes, towersById, creepsById, mapsById };
}
