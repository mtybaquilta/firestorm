import type { Tower } from '@/content-loader/schemas';
import { enqueueWave } from './waves';
import type { SimContext, SimState, TargetingPriority, TowerInstance } from './types';
import { DT } from './types';

export type SimInput =
  | { type: 'placeTower'; defId: string; x: number; y: number }
  | { type: 'upgradeTower'; towerId: number; upgradeId: string }
  | { type: 'sellTower'; towerId: number }
  | { type: 'setTargeting'; towerId: number; priority: TargetingPriority }
  | { type: 'startNextRound' }
  | { type: 'setSpeed'; speed: 1 | 2 }
  | { type: 'setPaused'; paused: boolean };

function totalInvested(tower: TowerInstance, def: Tower): number {
  let cost = def.cost;
  for (const upgradeId of tower.upgrades) {
    const u = def.upgrades.find((x) => x.id === upgradeId);
    if (u) cost += u.cost;
  }
  return cost;
}

export function applyInput(state: SimState, ctx: SimContext, input: SimInput): SimState {
  if (state.result !== 'in-progress' && input.type !== 'setPaused') return state;

  switch (input.type) {
    case 'placeTower': {
      const def = ctx.registry.towersById.get(input.defId);
      if (!def) return state;
      if (state.cash < def.cost) return state;
      const tower: TowerInstance = {
        id: state.nextEntityId,
        defId: input.defId,
        x: input.x,
        y: input.y,
        upgrades: [],
        targeting: def.targetingDefaults.priority,
        cooldownRemaining: 0,
      };
      return {
        ...state,
        towers: [...state.towers, tower],
        cash: state.cash - def.cost,
        nextEntityId: state.nextEntityId + 1,
      };
    }

    case 'upgradeTower': {
      const tower = state.towers.find((t) => t.id === input.towerId);
      if (!tower) return state;
      const def = ctx.registry.towersById.get(tower.defId);
      if (!def) return state;
      const upgrade = def.upgrades.find((u) => u.id === input.upgradeId);
      if (!upgrade) return state;
      if (tower.upgrades.includes(upgrade.id)) return state;
      for (const req of upgrade.requires) {
        if (!tower.upgrades.includes(req)) return state;
      }
      if (state.cash < upgrade.cost) return state;
      return {
        ...state,
        cash: state.cash - upgrade.cost,
        towers: state.towers.map((t) =>
          t.id === tower.id ? { ...t, upgrades: [...t.upgrades, upgrade.id] } : t,
        ),
      };
    }

    case 'sellTower': {
      const tower = state.towers.find((t) => t.id === input.towerId);
      if (!tower) return state;
      const def = ctx.registry.towersById.get(tower.defId);
      if (!def) return state;
      const refund = Math.floor(totalInvested(tower, def) * 0.7);
      return {
        ...state,
        cash: state.cash + refund,
        towers: state.towers.filter((t) => t.id !== tower.id),
      };
    }

    case 'setTargeting': {
      return {
        ...state,
        towers: state.towers.map((t) =>
          t.id === input.towerId ? { ...t, targeting: input.priority } : t,
        ),
      };
    }

    case 'startNextRound': {
      if (state.phase !== 'between-rounds') return state;
      if (state.currentRound >= state.totalRounds) return state;
      const seconds = state.tick * DT;
      const enqueued = enqueueWave(state, ctx, state.currentRound, seconds);
      return { ...enqueued, phase: 'in-round' };
    }

    case 'setSpeed':
      return { ...state, speed: input.speed };

    case 'setPaused':
      return { ...state, paused: input.paused };
  }
}
