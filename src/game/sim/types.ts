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
  // Render-side hooks for firing animation / projectile spawning.
  // Default to 0 / null on tower creation; updated by combat when the tower fires.
  lastFiredTick?: number;
  lastTargetId?: number | null;
}

// Active movement debuff. Strongest wins (lowest multiplier overrides higher);
// reapplying same-or-stronger refreshes duration. Decremented in advanceCreeps.
export interface CreepSlow {
  multiplier: number; // 0..1, applied to base speed (e.g. 0.65 = -35% speed)
  remainingTicks: number;
}

export interface CreepInstance {
  id: number;
  defId: string;
  hp: number;
  shieldHp: number;
  distance: number;
  // Render hook: tick on which the creep last took damage. Renderer flashes briefly.
  lastHitTick?: number;
  slow?: CreepSlow;
}

export interface PendingSpawn {
  defId: string;
  spawnAt: number;
  startDistance: number;
}

export interface ProjectileSplash {
  radius: number;
  ratio: number; // fraction of damage applied to non-primary creeps in radius
}

export interface ProjectileSlow {
  multiplier: number;
  durationTicks: number;
}

export interface ProjectileInstance {
  id: number;
  towerDefId: string;
  x: number;
  y: number;
  // Target the projectile is homing on. If the creep is gone, projectile flies
  // to fallback position and despawns without damage.
  targetCreepId: number;
  fallbackX: number;
  fallbackY: number;
  damage: number;
  damageType: string;
  speed: number;
  // Optional impact effects, captured at fire time so mid-flight stat changes
  // don't retroactively affect resolution.
  splash?: ProjectileSplash;
  slow?: ProjectileSlow;
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
  projectiles: ProjectileInstance[];
  nextEntityId: number;
}

export interface SimContext {
  registry: ContentRegistry;
  loadedMap: LoadedMap;
}

export const TICK_HZ = 60;
export const DT = 1 / TICK_HZ;
