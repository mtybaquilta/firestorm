import type { CreepInstance, CreepSlow, SimContext, SimState } from './types';
import { DT } from './types';

function tickSlow(slow: CreepSlow | undefined): CreepSlow | undefined {
  if (!slow) return undefined;
  const remaining = slow.remainingTicks - 1;
  if (remaining <= 0) return undefined;
  return { ...slow, remainingTicks: remaining };
}

export function advanceCreeps(state: SimState, ctx: SimContext): SimState {
  const surviving: CreepInstance[] = [];
  let lives = state.lives;
  let result = state.result;

  for (const creep of state.creeps) {
    const def = ctx.registry.creepsById.get(creep.defId);
    if (!def) continue;
    const speedMultiplier = creep.slow?.multiplier ?? 1;
    const distance = creep.distance + def.speed * speedMultiplier * DT;
    if (distance >= state.pathLength) {
      lives -= def.leakDamage;
      if (lives <= 0) {
        lives = 0;
        result = 'lose';
      }
      continue;
    }
    surviving.push({ ...creep, distance, slow: tickSlow(creep.slow) });
  }

  return { ...state, creeps: surviving, lives, result };
}
