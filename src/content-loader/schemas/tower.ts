import { z } from 'zod';

export const MovementLayerSchema = z.enum(['ground', 'water', 'air']);
export type MovementLayer = z.infer<typeof MovementLayerSchema>;

export const TargetingPrioritySchema = z.enum(['first', 'last', 'strong', 'close']);

export const ProjectileBehaviorSchema = z.enum([
  'single-target',
  'splash',
  'piercing',
  'chain',
  'dot',
  'slow-debuff',
  'support-buff',
  // Zone damage from a stationary tower — no projectile, no target priority.
  // Each fire tick damages all creeps within burnRadius around the tower.
  'zone',
]);

const StatDeltasSchema = z
  .object({
    damage: z.number().optional(),
    attackSpeed: z.number().optional(),
    range: z.number().optional(),
  })
  .strict();

const UpgradeNodeSchema = z.object({
  id: z.string().min(1),
  requires: z.array(z.string()),
  cost: z.number().int().nonnegative(),
  statDeltas: StatDeltasSchema,
});

export const TowerSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    cost: z.number().int().nonnegative(),
    damageType: z.string().min(1),
    targetableLayers: z.array(MovementLayerSchema).default(['ground']),
    baseStats: z.object({
      damage: z.number().nonnegative(),
      attackSpeed: z.number().positive(),
      range: z.number().positive(),
      projectileBehavior: ProjectileBehaviorSchema,
      // Pixels per second. Optional in YAML; sim applies a default if omitted.
      projectileSpeed: z.number().positive().optional(),
      // Splash params: required when projectileBehavior === 'splash'.
      splashRadius: z.number().positive().optional(),
      splashRatio: z.number().min(0).max(1).optional(),
      // Slow-debuff params: required when projectileBehavior === 'slow-debuff'.
      // Multiplier applied to creep speed (e.g. 0.65 means -35% speed).
      slowMultiplier: z.number().positive().lt(1).optional(),
      slowDurationSec: z.number().positive().optional(),
      // DoT params: required when projectileBehavior === 'dot'.
      // Damage values applied at 1-second intervals after impact.
      dotSchedule: z.array(z.number().nonnegative()).min(1).optional(),
      // Zone params: required when projectileBehavior === 'zone'. Damage from
      // baseStats.damage applies to all creeps within burnRadius each fire tick.
      burnRadius: z.number().positive().optional(),
    }),
    targetingDefaults: z.object({
      priority: TargetingPrioritySchema,
    }),
    upgrades: z.array(UpgradeNodeSchema),
  })
  .superRefine((tower, ctx) => {
    const ids = new Set(tower.upgrades.map((u) => u.id));
    for (const upgrade of tower.upgrades) {
      for (const req of upgrade.requires) {
        if (!ids.has(req)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `upgrade "${upgrade.id}" requires unknown upgrade "${req}"`,
            path: ['upgrades'],
          });
        }
      }
    }
    const stats = tower.baseStats;
    if (stats.projectileBehavior === 'splash') {
      if (stats.splashRadius === undefined || stats.splashRatio === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'splash projectileBehavior requires splashRadius and splashRatio',
          path: ['baseStats'],
        });
      }
    }
    if (stats.projectileBehavior === 'slow-debuff') {
      if (stats.slowMultiplier === undefined || stats.slowDurationSec === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'slow-debuff projectileBehavior requires slowMultiplier and slowDurationSec',
          path: ['baseStats'],
        });
      }
    }
    if (stats.projectileBehavior === 'dot') {
      if (stats.dotSchedule === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'dot projectileBehavior requires dotSchedule',
          path: ['baseStats'],
        });
      }
    }
    if (stats.projectileBehavior === 'zone') {
      if (stats.burnRadius === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'zone projectileBehavior requires burnRadius',
          path: ['baseStats'],
        });
      }
    }
  });

export type Tower = z.infer<typeof TowerSchema>;
