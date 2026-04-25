import { z } from 'zod';

export const RunSubmissionSchema = z.object({
  mapId: z.string().min(1).max(64),
  difficulty: z.enum(['easy', 'hard']),
  result: z.enum(['win', 'lose']),
  roundsCompleted: z.number().int().min(0).max(200),
  totalRounds: z.number().int().min(1).max(200),
  livesRemaining: z.number().int().min(0).max(1000),
  durationSeconds: z.number().min(0).max(60 * 60 * 4),
  seed: z.number().int(),
});

export type RunSubmission = z.infer<typeof RunSubmissionSchema>;
