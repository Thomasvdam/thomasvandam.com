import { movementSpeed } from "./nutrition";
import { distance, Point, segmentDistance } from "./nest";
export type Stone = Point & { id: number; radius: number; lifted?: boolean };
// Short probes and steering only: no actor sees a global route around obstacles.
export function surfaceMove(a: Point & { id: number; angle: number; speed: number; hunger?: number }, target: Point, stones: Stone[], dt: number) {
  const d = distance(a, target); const step = Math.min(d, movementSpeed(a) * dt);
  if (d < .001) return true;
  const heading = Math.atan2(target.y - a.y, target.x - a.x); const side = a.id % 2 ? 1 : -1;
  for (const offset of [0, side * .5, -side * .5, side, -side, side * 1.6, -side * 1.6, Math.PI]) {
    const angle = heading + offset;
    const p = { x: Math.max(16, Math.min(944, a.x + Math.cos(angle) * step)), y: Math.max(108, Math.min(175, a.y + Math.sin(angle) * step)) };
    if (distance(a, p) < .001) continue;
    const blocked = stones.some(o => !o.lifted && segmentDistance(o, a, p) < o.radius + 2 && distance(p, o) <= distance(a, o));
    if (blocked) continue;
    a.angle = Math.atan2(p.y - a.y, p.x - a.x); a.x = p.x; a.y = p.y;
    return distance(a, target) < .1;
  }
  return false;
}
