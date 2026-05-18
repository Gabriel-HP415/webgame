import type { MapWaypoint } from '@bto/shared';

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Position along polyline; progress 0..1 */
export function positionOnPath(
  waypoints: MapWaypoint[],
  progress: number,
): { x: number; y: number } {
  if (waypoints.length === 0) return { x: 0, y: 0 };
  if (waypoints.length === 1) return { ...waypoints[0] };

  const segments: number[] = [];
  let total = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const dx = waypoints[i + 1].x - waypoints[i].x;
    const dy = waypoints[i + 1].y - waypoints[i].y;
    const len = Math.hypot(dx, dy);
    segments.push(len);
    total += len;
  }

  let dist = progress * total;
  for (let i = 0; i < segments.length; i++) {
    if (dist <= segments[i] || i === segments.length - 1) {
      const t = segments[i] > 0 ? dist / segments[i] : 0;
      return {
        x: lerp(waypoints[i].x, waypoints[i + 1].x, t),
        y: lerp(waypoints[i].y, waypoints[i + 1].y, t),
      };
    }
    dist -= segments[i];
  }
  return { ...waypoints[waypoints.length - 1] };
}

export function pathLength(waypoints: MapWaypoint[]): number {
  let total = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    total += Math.hypot(
      waypoints[i + 1].x - waypoints[i].x,
      waypoints[i + 1].y - waypoints[i].y,
    );
  }
  return total;
}
