import { describe, expect, it } from 'vitest';
import { RunSubmissionSchema } from '../schema';

const valid = {
  mapId: 'in-the-loop',
  difficulty: 'easy' as const,
  result: 'win' as const,
  roundsCompleted: 40,
  totalRounds: 40,
  livesRemaining: 100,
  durationSeconds: 600,
  seed: 1,
};

describe('RunSubmissionSchema', () => {
  it('accepts a valid submission', () => {
    expect(RunSubmissionSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects unknown difficulty', () => {
    expect(RunSubmissionSchema.safeParse({ ...valid, difficulty: 'medium' }).success).toBe(false);
  });

  it('rejects negative lives', () => {
    expect(RunSubmissionSchema.safeParse({ ...valid, livesRemaining: -1 }).success).toBe(false);
  });

  it('rejects absurdly long duration', () => {
    expect(RunSubmissionSchema.safeParse({ ...valid, durationSeconds: 60 * 60 * 5 }).success).toBe(
      false,
    );
  });

  it('rejects empty mapId', () => {
    expect(RunSubmissionSchema.safeParse({ ...valid, mapId: '' }).success).toBe(false);
  });
});
