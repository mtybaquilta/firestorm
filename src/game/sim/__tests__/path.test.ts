import { describe, expect, it } from 'vitest';
import { computePathLength, positionAtDistance } from '@/game/sim/path';

const path = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 20 },
];

describe('path', () => {
  it('computes total length as sum of segment lengths', () => {
    expect(computePathLength(path)).toBe(30);
  });

  it('positionAtDistance interpolates within a segment', () => {
    expect(positionAtDistance(path, 5)).toEqual({ x: 5, y: 0 });
    expect(positionAtDistance(path, 15)).toEqual({ x: 10, y: 5 });
  });

  it('clamps to endpoints', () => {
    expect(positionAtDistance(path, -1)).toEqual({ x: 0, y: 0 });
    expect(positionAtDistance(path, 9999)).toEqual({ x: 10, y: 20 });
  });
});
