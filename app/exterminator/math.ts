export type Vector = { x: number; y: number };
export type Bounds = { width: number; height: number };
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export function limitVector(vector: Vector): Vector {
	const magnitude = Math.hypot(vector.x, vector.y);
	return magnitude > 1 ? { x: vector.x / magnitude, y: vector.y / magnitude } : vector;
}
export const angleDifference = (target: number, current: number) => Math.atan2(Math.sin(target - current), Math.cos(target - current));
export function distanceToSegment(point: Vector, from: Vector, to: Vector) {
	const dx = to.x - from.x, dy = to.y - from.y, length = dx * dx + dy * dy;
	const t = length ? clamp(((point.x - from.x) * dx + (point.y - from.y) * dy) / length, 0, 1) : 0;
	return Math.hypot(point.x - from.x - dx * t, point.y - from.y - dy * t);
}

export function circleHitTime(bullet: Vector, enemy: Vector, enemyRadius: number, previous: Vector, projectileRadius = 4) {
	// First circle intersection along the swept path, independent of enemy array order.
	const dx = bullet.x - previous.x, dy = bullet.y - previous.y;
	const ox = previous.x - enemy.x, oy = previous.y - enemy.y, radius = enemyRadius + projectileRadius;
	const c = ox * ox + oy * oy - radius * radius;
	if (c <= 0) return 0;
	const a = dx * dx + dy * dy, b = ox * dx + oy * dy;
	const discriminant = b * b - a * c;
	if (a === 0 || discriminant < 0) return Infinity;
	const t = (-b - Math.sqrt(discriminant)) / a;
	return t >= 0 && t <= 1 ? t : Infinity;
}

// First swept intersection with a capsule, including parallel/collinear shots.
export function segmentHitTime(end: Vector, previous: Vector, from: Vector, to: Vector, radius: number) {
	let hit = Math.min(circleHitTime(end, from, radius, previous, 0), circleHitTime(end, to, radius, previous, 0));
	const dx = to.x - from.x, dy = to.y - from.y, length = Math.hypot(dx, dy);
	if (!length) return hit;
	const nx = -dy / length, ny = dx / length, ux = dx / length, uy = dy / length;
	const side = (previous.x - from.x) * nx + (previous.y - from.y) * ny;
	const along = (previous.x - from.x) * ux + (previous.y - from.y) * uy;
	const vx = end.x - previous.x, vy = end.y - previous.y, crossing = vx * nx + vy * ny;
	if (Math.abs(side) <= radius && along >= 0 && along <= length) return 0;
	if (Math.abs(crossing) > 1e-10) for (const edge of [-radius, radius]) {
		const t = (edge - side) / crossing, projection = along + (vx * ux + vy * uy) * t;
		if (t >= 0 && t <= 1 && projection >= 0 && projection <= length) hit = Math.min(hit, t);
	}
	return hit;
}
