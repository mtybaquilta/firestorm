import { describe, expect, it } from 'vitest';
import { createRng, nextFloat, nextInt } from '@/game/sim/rng';

describe('rng', () => {
  it('is deterministic from a seed', () => {
    const a = createRng(12345);
    const b = createRng(12345);
    const [, va1] = nextFloat(a);
    const [, vb1] = nextFloat(b);
    expect(va1).toBe(vb1);
  });

  it('produces different sequences for different seeds', () => {
    const [, va] = nextFloat(createRng(1));
    const [, vb] = nextFloat(createRng(2));
    expect(va).not.toBe(vb);
  });

  it('nextInt is bounded', () => {
    let rng = createRng(7);
    for (let i = 0; i < 100; i++) {
      const [next, value] = nextInt(rng, 10);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(10);
      rng = next;
    }
  });
});
