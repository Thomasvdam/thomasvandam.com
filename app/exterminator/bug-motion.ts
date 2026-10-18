import { BUG_SPECS, type Enemy } from "./bug-types";
import { clamp, type Bounds, type Vector } from "./math";

export function moveBug(enemy: Enemy, direction: Vector, distance: number, bounds: Bounds) {
	const before = { x: enemy.x, y: enemy.y }, radius = BUG_SPECS[enemy.variant].radius;
	enemy.x = clamp(enemy.x + direction.x * distance, radius, bounds.width - radius);
	enemy.y = clamp(enemy.y + direction.y * distance, radius, bounds.height - radius);
	const travel = Math.hypot(enemy.x - before.x, enemy.y - before.y); enemy.walkDistance += travel;
	return travel;
}
export function walkBugTo(enemy: Enemy, target: Vector, dt: number, bounds: Bounds) {
	const dx = target.x - enemy.x, dy = target.y - enemy.y, distance = Math.hypot(dx, dy);
	if (distance === 0) return;
	enemy.angle = Math.atan2(dy, dx);
	moveBug(enemy, { x: dx / distance, y: dy / distance }, Math.min(distance, enemy.speed * dt), bounds);
}
