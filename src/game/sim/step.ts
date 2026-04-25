import { resolveCombat } from './combat';
import { advanceCreeps } from './creeps';
import { maybeEndRound } from './round';
import { dequeueDueSpawns } from './waves';
import type { SimContext, SimState } from './types';
import { DT } from './types';

export function step(state: SimState, ctx: SimContext): SimState {
  if (state.paused || state.result !== 'in-progress') return state;

  const tick = state.tick + 1;
  const seconds = tick * DT;
  let next: SimState = { ...state, tick };

  next = dequeueDueSpawns(next, ctx, seconds);
  next = resolveCombat(next, ctx);
  next = advanceCreeps(next, ctx);
  next = maybeEndRound(next);

  return next;
}
