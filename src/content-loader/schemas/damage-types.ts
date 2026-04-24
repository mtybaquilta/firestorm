import { z } from 'zod';

export const DamageTypesSchema = z
  .object({
    resistanceClasses: z.array(z.string().min(1)).min(1),
    damageTypes: z.record(z.string(), z.record(z.string(), z.number().min(0))),
  })
  .superRefine((value, ctx) => {
    const classes = new Set(value.resistanceClasses);
    for (const [typeName, row] of Object.entries(value.damageTypes)) {
      for (const cls of classes) {
        if (!(cls in row)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `damage type "${typeName}" is missing entry for resistance class "${cls}"`,
            path: ['damageTypes', typeName, cls],
          });
        }
      }
    }
  });

export type DamageTypes = z.infer<typeof DamageTypesSchema>;
