import type { Boss } from "./boss-types";
import { MILLIPEDE_SEGMENT_COUNT, MILLIPEDE_SPACING } from "./boss-types";
import { angleDifference, clamp, distanceToSegment, segmentHitTime, type Vector } from "./math";
import { FIELD } from "./game";

const SAMPLE_SPACING = 4;
// Long sweeps across the interior alternate with roomy turns near the edges.
export const MILLIPEDE_ROUTE: readonly Vector[] = [
	{ x: 90, y: 360 }, { x: 90, y: 120 }, { x: 1030, y: 120 }, { x: 1030, y: 540 },
	{ x: 90, y: 540 }, { x: 90, y: 360 }, { x: 850, y: 360 }, { x: 850, y: 180 },
	{ x: 270, y: 180 }, { x: 270, y: 540 }, { x: 1030, y: 540 }, { x: 1030, y: 360 },
];
export function millipedeTrail(head: Vector): Vector[] {
	// Seed a continuous U-shaped history instead of piling a long body against a wall.
	const anchors = [head, { x: 1030, y: 90 }, { x: 90, y: 90 }, { x: 90, y: 630 }, { x: 1030, y: 630 }];
	const points: Vector[] = [{ ...head }];
	for (let i = 1; i < anchors.length && points.length * SAMPLE_SPACING <= (MILLIPEDE_SEGMENT_COUNT + 2) * MILLIPEDE_SPACING; i++) {
		const from = anchors[i - 1], to = anchors[i], distance = Math.hypot(to.x - from.x, to.y - from.y), steps = Math.ceil(distance / SAMPLE_SPACING);
		for (let j = 1; j <= steps; j++) points.push({ x: from.x + (to.x - from.x) * j / steps, y: from.y + (to.y - from.y) * j / steps });
	}
	return points;
}
export function followMillipedeTrail(boss: Boss) {
	const points = boss.trail; if (!points || points.length < 2) return;
	let cursor = 1, distanceBefore = 0;
	for (let index = 0; index < boss.segments.length; index++) {
		const targetDistance = (index + 1) * MILLIPEDE_SPACING;
		while (cursor < points.length - 1 && distanceBefore + Math.hypot(points[cursor].x - points[cursor - 1].x, points[cursor].y - points[cursor - 1].y) < targetDistance) {
			distanceBefore += Math.hypot(points[cursor].x - points[cursor - 1].x, points[cursor].y - points[cursor - 1].y); cursor++;
		}
		const from = points[cursor - 1], to = points[cursor], length = Math.hypot(to.x - from.x, to.y - from.y), t = clamp((targetDistance - distanceBefore) / (length || 1), 0, 1);
		boss.segments[index].x = from.x + (to.x - from.x) * t; boss.segments[index].y = from.y + (to.y - from.y) * t;
	}
}
export function stepMillipede(boss: Boss, dt: number) {
	if (boss.phase === "emerge") { if (boss.remaining === 0) boss.phase = "crossing"; return; }
	const index = boss.routeIndex ?? 0;
	if (Math.hypot(boss.x - MILLIPEDE_ROUTE[index].x, boss.y - MILLIPEDE_ROUTE[index].y) < 90) boss.routeIndex = (index + 1) % MILLIPEDE_ROUTE.length;
	const target = MILLIPEDE_ROUTE[boss.routeIndex ?? 0], turn = angleDifference(Math.atan2(target.y - boss.y, target.x - boss.x), boss.angle);
	boss.phase = Math.abs(turn) > .35 ? "turn" : "crossing";
	boss.angle += clamp(turn, -dt * 1.5, dt * 1.5);
	const before = { x: boss.x, y: boss.y }, speed = boss.phase === "turn" ? 78 : 105;
	boss.x = clamp(boss.x + Math.cos(boss.angle) * speed * dt, 48, FIELD.width - 48); boss.y = clamp(boss.y + Math.sin(boss.angle) * speed * dt, 48, FIELD.height - 48);
	boss.walkDistance += Math.hypot(boss.x - before.x, boss.y - before.y);
	boss.trail ??= millipedeTrail(before);
	const first = boss.trail[0];
	if (Math.hypot(boss.x - first.x, boss.y - first.y) >= SAMPLE_SPACING) boss.trail.unshift({ x: boss.x, y: boss.y });
	// The current head is transient; fixed-distance breadcrumbs retain a bounded history.
	const history = boss.trail; boss.trail = [{ x: boss.x, y: boss.y }, ...history]; followMillipedeTrail(boss); boss.trail = history;
	boss.trail.length = Math.min(boss.trail.length, Math.ceil((MILLIPEDE_SEGMENT_COUNT + 4) * MILLIPEDE_SPACING / SAMPLE_SPACING) + 4);
}

// Sweep the mech against connected body capsules, then resolve body motion into it.
export function resolveMillipedeBarrier(boss: Boss, player: Vector, previous: Vector, radius = 14) {
	if (boss.variant !== "millipede" || boss.health <= 0 || boss.phase === "emerge") return false;
	const points = [boss, ...boss.segments];
	const capsules: { from: Vector; to: Vector; radius: number }[] = [];
	capsules.push({ from: boss, to: boss, radius: 24 });
	for (let i = 1; i < points.length; i++) {
		capsules.push({ from: points[i], to: points[i], radius: 18 });
		capsules.push({ from: points[i - 1], to: points[i], radius: 18 });
	}
	let contact = false, hit = Infinity;
	for (const c of capsules) {
		if (distanceToSegment(previous, c.from, c.to) <= c.radius + radius + .1) continue;
		hit = Math.min(hit, segmentHitTime(player, previous, c.from, c.to, c.radius + radius));
	}
	if (hit <= 1) { const t = Math.max(0, hit - .001); player.x = previous.x + (player.x - previous.x) * t; player.y = previous.y + (player.y - previous.y) * t; contact = true; }
	for (let iteration = 0; iteration < 6; iteration++) {
		let changed = false;
		for (const c of capsules) {
			const dx = c.to.x - c.from.x, dy = c.to.y - c.from.y, length = dx * dx + dy * dy;
			const t = length ? clamp(((player.x - c.from.x) * dx + (player.y - c.from.y) * dy) / length, 0, 1) : 0;
			const x = c.from.x + dx * t, y = c.from.y + dy * t, distance = Math.hypot(player.x - x, player.y - y), required = c.radius + radius;
			if (distance >= required) continue;
			let nx = player.x - x, ny = player.y - y;
			if (distance < .001) { nx = previous.x - x; ny = previous.y - y; if (Math.hypot(nx, ny) < .001) { nx = -dy || 1; ny = dx; } }
			const normal = Math.hypot(nx, ny); player.x = x + nx / normal * (required + .05); player.y = y + ny / normal * (required + .05); changed = true; contact = true;
		}
		player.x = clamp(player.x, radius, FIELD.width - radius); player.y = clamp(player.y, radius, FIELD.height - radius);
		if (!changed) break;
	}
	return contact;
}
