import { positionAtDistance } from './path';
import type { CreepInstance, SimContext, SimState, TowerInstance } from './types';
import { DT } from './types';

interface EffectiveTowerStats {
  damage: number;
  attackSpeed: number;
  range: number;
}

function effectiveStats(tower: TowerInstance, ctx: SimContext): EffectiveTowerStats {
  const def = ctx.registry.towersById.get(tower.defId);
  if (!def) return { damage: 0, attackSpeed: 1, range: 0 };
  let damage = def.baseStats.damage;
  let attackSpeed = def.baseStats.attackSpeed;
  let range = def.baseStats.range;
  for (const upgradeId of tower.upgrades) {
    const upgrade = def.upgrades.find((u) => u.id === upgradeId);
    if (!upgrade) continue;
    if (upgrade.statDeltas.damage !== undefined) damage += upgrade.statDeltas.damage;
    if (upgrade.statDeltas.attackSpeed !== undefined) attackSpeed += upgrade.statDeltas.attackSpeed;
    if (upgrade.statDeltas.range !== undefined) range += upgrade.statDeltas.range;
  }
  return { damage, attackSpeed, range };
}

function pickTarget(
  tower: TowerInstance,
  range: number,
  creeps: CreepInstance[],
  ctx: SimContext,
): CreepInstance | null {
  const inRange: CreepInstance[] = [];
  for (const creep of creeps) {
    const def = ctx.registry.creepsById.get(creep.defId);
    if (!def) continue;
    const towerDef = ctx.registry.towersById.get(tower.defId);
    if (!towerDef || !towerDef.targetableLayers.includes(def.movementLayer)) continue;
    const pos = positionAtDistance(ctx.loadedMap.map.path, creep.distance);
    const dx = pos.x - tower.x;
    const dy = pos.y - tower.y;
    if (Math.hypot(dx, dy) <= range) inRange.push(creep);
  }
  if (inRange.length === 0) return null;
  switch (tower.targeting) {
    case 'first':
      return inRange.reduce((a, b) => (a.distance >= b.distance ? a : b));
    case 'last':
      return inRange.reduce((a, b) => (a.distance <= b.distance ? a : b));
    case 'strong':
      return inRange.reduce((a, b) => (a.hp + a.shieldHp >= b.hp + b.shieldHp ? a : b));
    case 'close': {
      let best = inRange[0];
      let bestDist = Infinity;
      for (const c of inRange) {
        const pos = positionAtDistance(ctx.loadedMap.map.path, c.distance);
        const d = Math.hypot(pos.x - tower.x, pos.y - tower.y);
        if (d < bestDist) {
          best = c;
          bestDist = d;
        }
      }
      return best;
    }
  }
}

function applyDamage(
  creep: CreepInstance,
  rawDamage: number,
  damageType: string,
  ctx: SimContext,
): CreepInstance {
  const def = ctx.registry.creepsById.get(creep.defId);
  if (!def) return creep;
  const matrix = ctx.registry.damageTypes.damageTypes[damageType];
  const multiplier = matrix?.[def.resistanceClass] ?? 1;
  let remaining = rawDamage * multiplier;
  let shieldHp = creep.shieldHp;
  if (shieldHp > 0) {
    const absorbed = Math.min(shieldHp, remaining);
    shieldHp -= absorbed;
    remaining -= absorbed;
  }
  return { ...creep, shieldHp, hp: creep.hp - remaining };
}

export function resolveCombat(state: SimState, ctx: SimContext): SimState {
  let creeps: CreepInstance[] = state.creeps.map((c) => ({ ...c }));
  const towers: TowerInstance[] = [];
  let cash = state.cash;

  for (const tower of state.towers) {
    const towerDef = ctx.registry.towersById.get(tower.defId);
    const stats = effectiveStats(tower, ctx);
    let cooldown = tower.cooldownRemaining - DT;

    if (cooldown <= 0 && towerDef) {
      const target = pickTarget(tower, stats.range, creeps, ctx);
      if (target) {
        creeps = creeps.map((c) =>
          c.id === target.id ? applyDamage(c, stats.damage, towerDef.damageType, ctx) : c,
        );
        cooldown = stats.attackSpeed > 0 ? 1 / stats.attackSpeed : Infinity;
      } else {
        cooldown = 0;
      }
    }

    towers.push({ ...tower, cooldownRemaining: Math.max(cooldown, 0) });
  }

  const survivors: CreepInstance[] = [];
  let nextEntityId = state.nextEntityId;
  for (const creep of creeps) {
    if (creep.hp > 0) {
      survivors.push(creep);
      continue;
    }
    const def = ctx.registry.creepsById.get(creep.defId);
    if (!def) continue;
    cash += def.bounty;
    for (const ability of def.abilities) {
      if (ability.type !== 'spawnOnDeath') continue;
      const childDef = ctx.registry.creepsById.get(ability.spawn);
      if (!childDef) continue;
      const shieldAbility = childDef.abilities.find((a) => a.type === 'shield');
      for (let i = 0; i < ability.count; i++) {
        survivors.push({
          id: nextEntityId++,
          defId: ability.spawn,
          hp: childDef.hp,
          shieldHp: shieldAbility?.type === 'shield' ? shieldAbility.hp : 0,
          distance: creep.distance,
        });
      }
    }
  }

  return { ...state, towers, creeps: survivors, cash, nextEntityId };
}
