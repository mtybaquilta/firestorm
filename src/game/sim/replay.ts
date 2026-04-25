import { applyInput, type SimInput } from './inputs';
import { step } from './step';
import type { SimContext, SimState } from './types';

export interface ScriptedAction {
  atTick: number;
  input: SimInput;
}

export interface RunScript {
  initial: SimState;
  ctx: SimContext;
  actions: ScriptedAction[];
  maxTicks: number;
}

export function runScript(script: RunScript): SimState {
  let state = script.initial;
  let actionIdx = 0;
  const actions = [...script.actions].sort((a, b) => a.atTick - b.atTick);

  while (state.tick < script.maxTicks && state.result === 'in-progress') {
    while (actionIdx < actions.length && actions[actionIdx].atTick <= state.tick) {
      state = applyInput(state, script.ctx, actions[actionIdx].input);
      actionIdx++;
    }
    state = step(state, script.ctx);
  }
  return state;
}
