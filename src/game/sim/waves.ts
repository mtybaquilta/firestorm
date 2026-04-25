import type { CreepInstance, PendingSpawn, SimContext, SimState } from './types';

export function enqueueWave(
  state: SimState,
  ctx: SimContext,
  waveIndex: number,
  currentSeconds: number,
): SimState {
  const file = state.difficulty === 'easy' ? ctx.loadedMap.wavesEasy : ctx.loadedMap.wavesHard;
  const wave = file.waves[waveIndex];
  if (!wave) return state;

  const queue: PendingSpawn[] = [...state.spawnQueue];
  for (const group of wave.groups) {
    for (let i = 0; i < group.count; i++) {
      queue.push({
        defId: group.creep,
        spawnAt: currentSeconds + group.delay + group.spacing * i,
        startDistance: 0,
      });
    }
  }
  queue.sort((a, b) => a.spawnAt - b.spawnAt);
  return { ...state, spawnQueue: queue };
}

export function dequeueDueSpawns(
  state: SimState,
  ctx: SimContext,
  currentSeconds: number,
): SimState {
  const remaining: PendingSpawn[] = [];
  const newCreeps: CreepInstance[] = [];
  let nextEntityId = state.nextEntityId;

  for (const pending of state.spawnQueue) {
    if (pending.spawnAt > currentSeconds) {
      remaining.push(pending);
      continue;
    }
    const def = ctx.registry.creepsById.get(pending.defId);
    if (!def) continue;
    const shieldAbility = def.abilities.find((a) => a.type === 'shield');
    newCreeps.push({
      id: nextEntityId++,
      defId: pending.defId,
      hp: def.hp,
      shieldHp: shieldAbility?.type === 'shield' ? shieldAbility.hp : 0,
      distance: pending.startDistance,
    });
  }

  return {
    ...state,
    creeps: [...state.creeps, ...newCreeps],
    spawnQueue: remaining,
    nextEntityId,
  };
}
