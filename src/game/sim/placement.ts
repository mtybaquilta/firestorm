import type { Point } from './path';
import type { SimContext, SimState } from './types';

export const MIN_DISTANCE_FROM_PATH = 24;
export const TOWER_FOOTPRINT = 24;

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = a.x + t * dx;
  const cy = a.y + t * dy;
  return Math.hypot(p.x - cx, p.y - cy);
}

export function distanceToPolyline(point: Point, polyline: Point[]): number {
  let best = Infinity;
  for (let i = 1; i < polyline.length; i++) {
    const d = distanceToSegment(point, polyline[i - 1], polyline[i]);
    if (d < best) best = d;
  }
  return best;
}

export function isValidPlacement(state: SimState, ctx: SimContext, x: number, y: number): boolean {
  if (distanceToPolyline({ x, y }, ctx.loadedMap.map.path) < MIN_DISTANCE_FROM_PATH) {
    return false;
  }
  for (const tower of state.towers) {
    if (Math.hypot(tower.x - x, tower.y - y) < TOWER_FOOTPRINT) return false;
  }
  return true;
}
