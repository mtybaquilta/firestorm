import { computePathLength } from './path';
import { createRng } from './rng';
import type { Difficulty, SimContext, SimState } from './types';

export interface InitialStateInput {
  ctx: SimContext;
  difficulty: Difficulty;
  seed: number;
}

export function createInitialState({ ctx, difficulty, seed }: InitialStateInput): SimState {
  const map = ctx.loadedMap.map;
  const diff = map.difficulty[difficulty];
  const waves = difficulty === 'easy' ? ctx.loadedMap.wavesEasy : ctx.loadedMap.wavesHard;
  return {
    tick: 0,
    rng: createRng(seed),
    mapId: map.id,
    difficulty,
    pathLength: computePathLength(map.path),
    cash: diff.startCash,
    lives: diff.startLives,
    phase: 'between-rounds',
    currentRound: 0,
    totalRounds: waves.waves.length,
    speed: 1,
    paused: false,
    result: 'in-progress',
    towers: [],
    creeps: [],
    spawnQueue: [],
    projectiles: [],
    nextEntityId: 1,
  };
}
