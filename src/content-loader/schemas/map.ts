import { z } from 'zod';

const PointSchema = z.object({ x: z.number(), y: z.number() });

const DifficultySchema = z.object({
  startCash: z.number().int().nonnegative(),
  startLives: z.number().int().positive(),
  waves: z.string().min(1),
});

export const MapSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  background: z.string().min(1),
  placementMask: z.string().min(1),
  path: z.array(PointSchema).min(2),
  waterPath: z.array(PointSchema).optional(),
  difficulty: z.object({
    easy: DifficultySchema,
    hard: DifficultySchema,
  }),
});

export type GameMap = z.infer<typeof MapSchema>;
