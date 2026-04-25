import type { CreepInstance, SimContext, SimState } from './types';
import { DT } from './types';

export function advanceCreeps(state: SimState, ctx: SimContext): SimState {
  const surviving: CreepInstance[] = [];
  let lives = state.lives;
  let result = state.result;

  for (const creep of state.creeps) {
    const def = ctx.registry.creepsById.get(creep.defId);
    if (!def) continue;
    const distance = creep.distance + def.speed * DT;
    if (distance >= state.pathLength) {
      lives -= def.leakDamage;
      if (lives <= 0) {
        lives = 0;
        result = 'lose';
      }
      continue;
    }
    surviving.push({ ...creep, distance });
  }

  return { ...state, creeps: surviving, lives, result };
}
