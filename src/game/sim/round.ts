import type { SimContext, SimState } from './types';

export function maybeEndRound(state: SimState, _ctx: SimContext): SimState {
  if (state.phase !== 'in-round') return state;
  if (state.spawnQueue.length > 0) return state;
  if (state.creeps.length > 0) return state;
  const currentRound = state.currentRound + 1;
  if (currentRound >= state.totalRounds) {
    return { ...state, phase: 'between-rounds', currentRound, result: 'win' };
  }
  return { ...state, phase: 'between-rounds', currentRound };
}
