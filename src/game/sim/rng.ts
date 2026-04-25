export type RngState = number;

export function createRng(seed: number): RngState {
  return seed >>> 0 || 1;
}

export function nextFloat(rng: RngState): [RngState, number] {
  const t = (rng + 0x6d2b79f5) >>> 0;
  let r = Math.imul(t ^ (t >>> 15), 1 | t);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  const value = ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  return [t, value];
}

export function nextInt(rng: RngState, exclusiveMax: number): [RngState, number] {
  const [next, value] = nextFloat(rng);
  return [next, Math.floor(value * exclusiveMax)];
}
