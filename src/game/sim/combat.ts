import { positionAtDistance } from './path';
import type {
  CreepInstance,
  CreepSlow,
  ProjectileInstance,
  ProjectilePoison,
  ProjectileSlow,
  ProjectileSplash,
  SimContext,
  SimState,
  TowerInstance,
} from './types';
import { DT, TICK_HZ } from './types';

const DEFAULT_PROJECTILE_SPEED = 600;
const PROJECTILE_HIT_RADIUS = 8;

interface EffectiveTowerStats {
  damage: number;
  attackSpeed: number;
  range: number;
  projectileSpeed: number;
  splash?: ProjectileSplash;
  slow?: ProjectileSlow;
  poison?: ProjectilePoison;
  burnRadius?: number;
}

function effectiveStats(tower: TowerInstance, ctx: SimContext): EffectiveTowerStats {
  const def = ctx.registry.towersById.get(tower.defId);
  if (!def) return { damage: 0, attackSpeed: 1, range: 0, projectileSpeed: DEFAULT_PROJECTILE_SPEED };
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

  let splash: ProjectileSplash | undefined;
  if (
    def.baseStats.projectileBehavior === 'splash' &&
    def.baseStats.splashRadius !== undefined &&
    def.baseStats.splashRatio !== undefined
  ) {
    splash = { radius: def.baseStats.splashRadius, ratio: def.baseStats.splashRatio };
  }

  let slow: ProjectileSlow | undefined;
  if (
    def.baseStats.projectileBehavior === 'slow-debuff' &&
    def.baseStats.slowMultiplier !== undefined &&
    def.baseStats.slowDurationSec !== undefined
  ) {
    slow = {
      multiplier: def.baseStats.slowMultiplier,
      durationTicks: Math.round(def.baseStats.slowDurationSec * TICK_HZ),
    };
  }

  let poison: ProjectilePoison | undefined;
  if (def.baseStats.projectileBehavior === 'dot' && def.baseStats.dotSchedule) {
    poison = { schedule: def.baseStats.dotSchedule };
  }

  return {
    damage,
    attackSpeed,
    range,
    projectileSpeed: def.baseStats.projectileSpeed ?? DEFAULT_PROJECTILE_SPEED,
    splash,
    slow,
    poison,
    burnRadius: def.baseStats.burnRadius,
  };
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
  tick: number,
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
  return { ...creep, shieldHp, hp: creep.hp - remaining, lastHitTick: tick };
}

// Strongest-wins slow stacking. Re-applying same-or-stronger refreshes duration;
// weaker is ignored. (Lower multiplier = stronger debuff.)
function mergeSlow(current: CreepSlow | undefined, incoming: ProjectileSlow): CreepSlow {
  if (!current || incoming.multiplier <= current.multiplier) {
    return { multiplier: incoming.multiplier, remainingTicks: incoming.durationTicks };
  }
  return current;
}

// Apply primary damage, splash damage, slow, and poison from a single projectile impact.
function applyImpact(
  creeps: CreepInstance[],
  proj: ProjectileInstance,
  primaryTarget: CreepInstance,
  ctx: SimContext,
  path: SimContext['loadedMap']['map']['path'],
  tick: number,
): CreepInstance[] {
  let primaryPos: { x: number; y: number } | null = null;
  return creeps.map((c) => {
    let next = c;
    if (c.id === primaryTarget.id) {
      next = applyDamage(next, proj.damage, proj.damageType, ctx, tick);
      if (proj.slow) next = { ...next, slow: mergeSlow(next.slow, proj.slow) };
      if (proj.poison) {
        next = {
          ...next,
          poison: {
            damagesRemaining: [...proj.poison.schedule],
            ticksUntilNext: TICK_HZ,
            damageType: proj.damageType,
          },
        };
      }
      return next;
    }
    if (proj.splash) {
      if (!primaryPos) primaryPos = positionAtDistance(path, primaryTarget.distance);
      const cPos = positionAtDistance(path, c.distance);
      const dist = Math.hypot(cPos.x - primaryPos.x, cPos.y - primaryPos.y);
      if (dist <= proj.splash.radius) {
        next = applyDamage(next, proj.damage * proj.splash.ratio, proj.damageType, ctx, tick);
      }
    }
    return next;
  });
}

// Tick down active poison effects on creeps; apply scheduled damage when due.
// Returns a fresh creep list with damage and poison state updated.
function tickPoison(
  creeps: CreepInstance[],
  ctx: SimContext,
  tick: number,
): CreepInstance[] {
  return creeps.map((c) => {
    if (!c.poison) return c;
    let { damagesRemaining, ticksUntilNext, damageType } = c.poison;
    ticksUntilNext -= 1;
    let next = c;
    if (ticksUntilNext <= 0) {
      const dmg = damagesRemaining[0] ?? 0;
      const remaining = damagesRemaining.slice(1);
      if (dmg > 0) next = applyDamage(next, dmg, damageType, ctx, tick);
      next = {
        ...next,
        poison:
          remaining.length === 0
            ? undefined
            : { damagesRemaining: remaining, ticksUntilNext: TICK_HZ, damageType },
      };
    } else {
      next = { ...next, poison: { damagesRemaining, ticksUntilNext, damageType } };
    }
    return next;
  });
}

export function resolveCombat(state: SimState, ctx: SimContext): SimState {
  let creeps: CreepInstance[] = state.creeps.map((c) => ({ ...c }));
  let nextEntityId = state.nextEntityId;
  const path = ctx.loadedMap.map.path;

  // === Phase 1: advance existing projectiles, apply impact on hit ===
  const survivingProjectiles: ProjectileInstance[] = [];
  for (const proj of state.projectiles) {
    const target = creeps.find((c) => c.id === proj.targetCreepId);
    let tx: number;
    let ty: number;
    if (target) {
      const pos = positionAtDistance(path, target.distance);
      tx = pos.x;
      ty = pos.y;
    } else {
      tx = proj.fallbackX;
      ty = proj.fallbackY;
    }

    const dx = tx - proj.x;
    const dy = ty - proj.y;
    const dist = Math.hypot(dx, dy);
    const stepDist = proj.speed * DT;

    if (dist <= PROJECTILE_HIT_RADIUS || stepDist >= dist) {
      if (target) creeps = applyImpact(creeps, proj, target, ctx, path, state.tick);
      continue; // despawn
    }

    survivingProjectiles.push({
      ...proj,
      x: proj.x + (dx / dist) * stepDist,
      y: proj.y + (dy / dist) * stepDist,
    });
  }

  // === Phase 2: tower fire ===
  // Zone towers (e.g. Fire Turret) damage all creeps in burnRadius each fire tick.
  // All other behaviors spawn a homing projectile that resolves on impact.
  const towers: TowerInstance[] = [];
  const newProjectiles: ProjectileInstance[] = [];
  for (const tower of state.towers) {
    const towerDef = ctx.registry.towersById.get(tower.defId);
    const stats = effectiveStats(tower, ctx);
    let cooldown = tower.cooldownRemaining - DT;
    let lastFiredTick = tower.lastFiredTick;
    let lastTargetId = tower.lastTargetId;

    if (cooldown <= 0 && towerDef) {
      if (towerDef.baseStats.projectileBehavior === 'zone' && stats.burnRadius !== undefined) {
        const radius = stats.burnRadius;
        let anyHit = false;
        creeps = creeps.map((c) => {
          const cPos = positionAtDistance(path, c.distance);
          const d = Math.hypot(cPos.x - tower.x, cPos.y - tower.y);
          if (d <= radius) {
            anyHit = true;
            return applyDamage(c, stats.damage, towerDef.damageType, ctx, state.tick);
          }
          return c;
        });
        if (anyHit) {
          cooldown = stats.attackSpeed > 0 ? 1 / stats.attackSpeed : Infinity;
          lastFiredTick = state.tick;
          lastTargetId = null;
        } else {
          cooldown = 0;
        }
      } else {
        const target = pickTarget(tower, stats.range, creeps, ctx);
        if (target) {
          const targetPos = positionAtDistance(path, target.distance);
          newProjectiles.push({
            id: nextEntityId++,
            towerDefId: tower.defId,
            x: tower.x,
            y: tower.y,
            targetCreepId: target.id,
            fallbackX: targetPos.x,
            fallbackY: targetPos.y,
            damage: stats.damage,
            damageType: towerDef.damageType,
            speed: stats.projectileSpeed,
            splash: stats.splash,
            slow: stats.slow,
            poison: stats.poison,
          });
          cooldown = stats.attackSpeed > 0 ? 1 / stats.attackSpeed : Infinity;
          lastFiredTick = state.tick;
          lastTargetId = target.id;
        } else {
          cooldown = 0;
        }
      }
    }

    towers.push({
      ...tower,
      cooldownRemaining: Math.max(cooldown, 0),
      lastFiredTick,
      lastTargetId,
    });
  }

  // === Phase 2.5: tick active DoT effects on creeps ===
  creeps = tickPoison(creeps, ctx, state.tick);

  // === Phase 3: resolve creep deaths (bounty + spawn-on-death) ===
  const survivors: CreepInstance[] = [];
  let cash = state.cash;
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

  return {
    ...state,
    towers,
    creeps: survivors,
    projectiles: [...survivingProjectiles, ...newProjectiles],
    cash,
    nextEntityId,
  };
}
