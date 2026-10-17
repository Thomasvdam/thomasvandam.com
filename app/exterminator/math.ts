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
