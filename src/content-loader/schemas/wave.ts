import { z } from 'zod';

export const WaveGroupSchema = z.object({
  creep: z.string().min(1),
  count: z.number().int().positive(),
  spacing: z.number().nonnegative(),
  delay: z.number().nonnegative(),
});

export const WaveSchema = z.object({
  groups: z.array(WaveGroupSchema).min(1),
});

export const WaveFileSchema = z.object({
  waves: z.array(WaveSchema),
});

export type WaveFile = z.infer<typeof WaveFileSchema>;
