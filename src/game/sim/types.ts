import type { ContentRegistry } from '@/content-loader/registry';
import type { LoadedMap } from '@/content-loader/load';
import type { TargetingPrioritySchema } from '@/content-loader/schemas/tower';
import type { z } from 'zod';
import type { RngState } from './rng';

export type Difficulty = 'easy' | 'hard';
export type SimResult = 'in-progress' | 'win' | 'lose';
export type SimPhase = 'between-rounds' | 'in-round';
export type TargetingPriority = z.infer<typeof TargetingPrioritySchema>;

export interface TowerInstance {
  id: number;
  defId: string;
  x: number;
  y: number;
  upgrades: string[];
  targeting: TargetingPriority;
  cooldownRemaining: number;
}

export interface CreepInstance {
  id: number;
  defId: string;
  hp: number;
  shieldHp: number;
  distance: number;
}

export interface PendingSpawn {
  defId: string;
  spawnAt: number;
  startDistance: number;
}

export interface SimState {
  tick: number;
  rng: RngState;
  mapId: string;
  difficulty: Difficulty;
  pathLength: number;
  cash: number;
  lives: number;
  phase: SimPhase;
  currentRound: number;
  totalRounds: number;
  speed: 1 | 2;
  paused: boolean;
  result: SimResult;
  towers: TowerInstance[];
  creeps: CreepInstance[];
  spawnQueue: PendingSpawn[];
  nextEntityId: number;
}

export interface SimContext {
  registry: ContentRegistry;
  loadedMap: LoadedMap;
}

export const TICK_HZ = 60;
export const DT = 1 / TICK_HZ;
