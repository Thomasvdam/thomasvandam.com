import { BOSS_ATTACKS } from "./boss-patterns";
import type { Boss } from "./boss-types";
import { MILLIPEDE_SEGMENT_COUNT, MILLIPEDE_SPACING } from "./boss-types";
import { angleDifference, clamp, distanceToSegment, segmentHitTime, type Vector } from "./math";
import { FIELD } from "./game";

const SAMPLE_SPACING = 4;
export function millipedeTrail(head: Vector): Vector[] {
	// Seed a continuous U-shaped history instead of piling a long body against a wall.
	const anchors = [head, { x: 1030, y: 90 }, { x: 90, y: 90 }, { x: 90, y: 630 }, { x: 1030, y: 630 }];
	const points: Vector[] = [{ x: head.x, y: head.y }];
	for (let i = 1; i < anchors.length && points.length * SAMPLE_SPACING <= (MILLIPEDE_SEGMENT_COUNT + 2) * MILLIPEDE_SPACING; i++) {
		const from = anchors[i - 1], to = anchors[i], distance = Math.hypot(to.x - from.x, to.y - from.y), steps = Math.ceil(distance / SAMPLE_SPACING);
		for (let j = 1; j <= steps; j++) points.push({ x: from.x + (to.x - from.x) * j / steps, y: from.y + (to.y - from.y) * j / steps });
	}
	return points;
}
export function followMillipedeTrail(boss: Boss, includeHead = false) {
	const points = boss.trail; if (!points || points.length < 2) return;
	// Treat the live head as a virtual first breadcrumb: no per-step history copy.
	let cursor = includeHead ? 0 : 1, distanceBefore = 0;
	let from: Vector = includeHead ? boss : points[0], to = points[cursor];
	let length = Math.hypot(to.x - from.x, to.y - from.y);
	for (let index = 0; index < boss.segments.length; index++) {
		const targetDistance = (index + 1) * MILLIPEDE_SPACING;
		while (cursor < points.length - 1 && distanceBefore + length < targetDistance) {
			distanceBefore += length; from = to; to = points[++cursor];
			length = Math.hypot(to.x - from.x, to.y - from.y);
		}
		const t = clamp((targetDistance - distanceBefore) / (length || 1), 0, 1);
		boss.segments[index].x = from.x + (to.x - from.x) * t; boss.segments[index].y = from.y + (to.y - from.y) * t;
	}
}
function prepareCrossing(boss: Boss, player: Vector) {
	// Score crossing lanes around the player, while forbidding reversals into our
	// own body. At an edge this produces a broad turn before the next intercept.
	const candidates: Vector[] = [
		{ x: 90, y: 90 }, { x: 560, y: 90 }, { x: 1030, y: 90 },
		{ x: 90, y: 360 }, { x: 1030, y: 360 },
		{ x: 90, y: 630 }, { x: 560, y: 630 }, { x: 1030, y: 630 },
	];
	const dx = player.x - boss.x, dy = player.y - boss.y;
	const wallX = Math.abs(dx) < .00001 ? Infinity : ((dx > 0 ? 1030 : 90) - boss.x) / dx;
	const wallY = Math.abs(dy) < .00001 ? Infinity : ((dy > 0 ? 630 : 90) - boss.y) / dy;
	const reach = Math.min(wallX, wallY);
	if (Number.isFinite(reach)) candidates.push({ x: boss.x + dx * reach, y: boss.y + dy * reach });
	let best = candidates[0], score = Infinity;
	for (const point of candidates) {
		const distance = Math.hypot(point.x - boss.x, point.y - boss.y);
		const turn = Math.abs(angleDifference(Math.atan2(point.y - boss.y, point.x - boss.x), boss.angle));
		if (distance < 220 || turn > Math.PI / 2 + .001) continue;
		const cost = distanceToSegment(player, boss, point) - distance * .08;
		if (cost < score) { score = cost; best = point; }
	}
	boss.target = { ...best };
	boss.phase = "crossingWindup"; boss.remaining = BOSS_ATTACKS.crossing.windup;
}
export function stepMillipede(boss: Boss, dt: number, player: Vector) {
	if (boss.phase === "emerge") { if (!boss.remaining) prepareCrossing(boss, player); return; }
	if (boss.phase === "recover") {
		if (!boss.remaining) prepareCrossing(boss, player);
		return;
	}
	if (boss.phase === "crossingWindup" || boss.phase === "turn") {
		const angle = Math.atan2(boss.target.y - boss.y, boss.target.x - boss.x);
		boss.angle += clamp(angleDifference(angle, boss.angle), -dt * 4, dt * 4);
		if (!boss.remaining) { boss.angle = angle; boss.phase = "crossing"; }
		return;
	}
	// Chosen lanes are committed straight lines. The entire body stops during the tell
	// and recovery, so a player can read the next lane before the fast crossing.
	const target = boss.target;
	const dx = target.x - boss.x, dy = target.y - boss.y, distance = Math.hypot(dx, dy);
	const before = { x: boss.x, y: boss.y }, travel = Math.min(distance, BOSS_ATTACKS.crossing.speed * dt);
	boss.angle = Math.atan2(dy, dx);
	if (distance) { boss.x += dx / distance * travel; boss.y += dy / distance * travel; }
	boss.walkDistance += travel;
	boss.trail ??= millipedeTrail(before);
	const first = boss.trail[0];
	if (Math.hypot(boss.x - first.x, boss.y - first.y) >= SAMPLE_SPACING) boss.trail.unshift({ x: boss.x, y: boss.y });
	followMillipedeTrail(boss, true);
	boss.trail.length = Math.min(boss.trail.length, Math.ceil((MILLIPEDE_SEGMENT_COUNT + 4) * MILLIPEDE_SPACING / SAMPLE_SPACING) + 4);
	if (distance <= travel) { boss.phase = "recover"; boss.remaining = 1.9; }
}

// Preserve head, endpoint, bridge order without constructing temporary capsules.
function capsuleEnd(boss: Boss, index: number): Vector { return index === 0 ? boss : boss.segments[Math.ceil(index / 2) - 1]; }
function capsuleStart(boss: Boss, index: number, end: Vector): Vector {
	return index > 0 && index % 2 === 0 ? index === 2 ? boss : boss.segments[index / 2 - 2] : end;
}

// Sweep the mech against connected body capsules, then resolve body motion into it.
export function resolveMillipedeBarrier(boss: Boss, player: Vector, previous: Vector, radius = 14) {
	if (boss.variant !== "millipede" || boss.health <= 0 || boss.phase === "emerge") return false;
	const count = 1 + boss.segments.length * 2;
	const minX = Math.min(previous.x, player.x), maxX = Math.max(previous.x, player.x);
	const minY = Math.min(previous.y, player.y), maxY = Math.max(previous.y, player.y);
	let contact = false, hit = Infinity;
	for (let i = 0; i < count; i++) {
		const to = capsuleEnd(boss, i), from = capsuleStart(boss, i, to), required = (i ? 18 : 24) + radius;
		if (maxX < Math.min(from.x, to.x) - required || minX > Math.max(from.x, to.x) + required || maxY < Math.min(from.y, to.y) - required || minY > Math.max(from.y, to.y) + required) continue;
		if (distanceToSegment(previous, from, to) <= required + .1) continue;
		hit = Math.min(hit, segmentHitTime(player, previous, from, to, required));
	}
	if (hit <= 1) { const t = Math.max(0, hit - .001); player.x = previous.x + (player.x - previous.x) * t; player.y = previous.y + (player.y - previous.y) * t; contact = true; }
	for (let iteration = 0; iteration < 6; iteration++) {
		let changed = false;
		for (let i = 0; i < count; i++) {
			const to = capsuleEnd(boss, i), from = capsuleStart(boss, i, to), required = (i ? 18 : 24) + radius;
			if (player.x < Math.min(from.x, to.x) - required || player.x > Math.max(from.x, to.x) + required || player.y < Math.min(from.y, to.y) - required || player.y > Math.max(from.y, to.y) + required) continue;
			const dx = to.x - from.x, dy = to.y - from.y, length = dx * dx + dy * dy;
			const t = length ? clamp(((player.x - from.x) * dx + (player.y - from.y) * dy) / length, 0, 1) : 0;
			const x = from.x + dx * t, y = from.y + dy * t, distance = Math.hypot(player.x - x, player.y - y);
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
