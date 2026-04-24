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
  });

export type Tower = z.infer<typeof TowerSchema>;
