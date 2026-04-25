import mitt from 'mitt';
import type { TargetingPriority } from '@/game/sim/types';

export type GameEvents = {
  'intent:placeTower': { defId: string; x: number; y: number };
  'intent:upgradeTower': { towerId: number; upgradeId: string };
  'intent:sellTower': { towerId: number };
  'intent:setTargeting': { towerId: number; priority: TargetingPriority };
  'intent:startNextRound': undefined;
  'intent:setSpeed': { speed: 1 | 2 };
  'intent:setPaused': { paused: boolean };
  'ui:selectDefId': { defId: string | null };
};

export type GameEventBus = ReturnType<typeof createGameEventBus>;

export function createGameEventBus() {
  return mitt<GameEvents>();
}
