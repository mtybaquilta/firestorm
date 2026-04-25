export interface Point {
  x: number;
  y: number;
}

export function computePathLength(path: Point[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const dx = path[i].x - path[i - 1].x;
    const dy = path[i].y - path[i - 1].y;
    total += Math.hypot(dx, dy);
  }
  return total;
}

export function positionAtDistance(path: Point[], distance: number): Point {
  if (distance <= 0) return { x: path[0].x, y: path[0].y };
  let remaining = distance;
  for (let i = 1; i < path.length; i++) {
    const dx = path[i].x - path[i - 1].x;
    const dy = path[i].y - path[i - 1].y;
    const segLen = Math.hypot(dx, dy);
    if (remaining <= segLen) {
      const t = segLen === 0 ? 0 : remaining / segLen;
      return { x: path[i - 1].x + dx * t, y: path[i - 1].y + dy * t };
    }
    remaining -= segLen;
  }
  const last = path[path.length - 1];
  return { x: last.x, y: last.y };
}
