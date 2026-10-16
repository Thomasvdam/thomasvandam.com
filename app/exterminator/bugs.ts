import { stepAcidSpitter } from "./acid";
import type { Bullet, Game, Vector } from "./game";

export type BugVariant = "burrower" | "flyer" | "lunger" | "evader" | "centipede" | "armoured" | "beetle" | "spitter";
export const BUG_SPECS: Record<BugVariant, { health: number; speed: number; radius: number }> = {
	burrower: { health: 1, speed: 60, radius: 15 }, flyer: { health: 1, speed: 60, radius: 15 },
	lunger: { health: 3, speed: 68, radius: 15 }, evader: { health: 2, speed: 76, radius: 13 },
	centipede: { health: 7, speed: 104, radius: 12 }, armoured: { health: 5, speed: 54, radius: 18 },
	beetle: { health: 3, speed: 88, radius: 16 }, spitter: { health: 3, speed: 100, radius: 15 },
};
export const BEETLE_ROLL_TIME = .95;
export const BEETLE_FLIGHT_TIME = .9;
export const BEETLE_BLAST_RADIUS = 38;
export const LUNGE_TRIGGER = 180;
export const LUNGE_DISTANCE = 310;
export const LUNGE_WINDUP = 1.15;
export const LUNGE_SPEED = 680;
export const LUNGE_WINDUP_TURN_RATE = .15;
export const ARMOUR_HALF_ANGLE = Math.PI * .39;
export const FRONT_FLAME_MULTIPLIER = .15;
export const SEGMENT_SPACING = 18;
export const SEGMENT_COUNT = 8;
export const BUG_CLEARANCE = 6;
type Bounds = { width: number; height: number };
type EnemyBase = Vector & { id: number; health: number; maxHealth: number; speed: number; angle: number; walkDistance: number; bornAt: number; hitAt: number; blockedAt: number };
export type Enemy = EnemyBase & (
	{ variant: "burrower" | "flyer"; state: { phase: "chase" } } |
	{ variant: "lunger"; state: { phase: "approach" | "windup" | "lunge" | "recover"; remaining: number; direction: number; distance: number } } |
	{ variant: "evader"; state: { phase: "chase" | "dodge"; remaining: number; cooldown: number; direction: Vector } } |
	{ variant: "centipede"; state: { segments: Vector[] } } |
	{ variant: "armoured"; state: { phase: "chase" } } |
	{ variant: "beetle"; state: { phase: "roll" | "ready"; remaining: number } } |
	{ variant: "spitter"; state: { phase: "cover" | "peek" | "windup"; remaining: number; coverId: number | null; side: number; target: Vector } }
);
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export const angleDifference = (target: number, current: number) => Math.atan2(Math.sin(target - current), Math.cos(target - current));

export function bugForSpawn(cleared: number, wave: number, index: number): BugVariant {
	if (index % 3 !== 2) return index % 2 === 0 ? "burrower" : "flyer";
	const specialists: BugVariant[] = ["lunger"];
	if (cleared >= 1) specialists.push("evader");
	if (cleared >= 2) specialists.push("armoured", "beetle");
	if (cleared >= 3) specialists.push("centipede");
	if (cleared >= 4) specialists.push("spitter");
	return specialists[(Math.floor(index / 3) + wave - 1) % specialists.length];
}
export function createBug(options: { variant: BugVariant; id: number; position: Vector; player: Vector; threat: number; wave: number; time: number; bounds: Bounds }): Enemy {
	const { variant, id, position, player, threat, wave, time, bounds } = options, spec = BUG_SPECS[variant];
	const angle = Math.atan2(player.y - position.y, player.x - position.x);
	const health = spec.health * (1 + Math.floor((threat - 1) / 2));
	const base = { x: clamp(position.x, spec.radius, bounds.width - spec.radius), y: clamp(position.y, spec.radius, bounds.height - spec.radius), id, health, maxHealth: health, speed: Math.min(variant === "armoured" ? 85 : 160, spec.speed + threat * (variant === "armoured" ? 2 : 5) + wave * 3), angle, walkDistance: 12, bornAt: time, hitAt: -10, blockedAt: -10 };
	if (variant === "spitter") return { ...base, variant, state: { phase: "cover", remaining: .6, coverId: null, side: id % 2 ? 1 : -1, target: { ...player } } };
	if (variant === "beetle") return { ...base, variant, state: { phase: "roll", remaining: BEETLE_ROLL_TIME } };
	if (variant === "lunger") return { ...base, variant, state: { phase: "approach", remaining: 0, direction: angle, distance: 0 } };
	if (variant === "evader") return { ...base, variant, state: { phase: "chase", remaining: 0, cooldown: 0, direction: { x: 0, y: 0 } } };
	if (variant === "centipede") return { ...base, variant, state: { segments: Array.from({ length: SEGMENT_COUNT - 1 }, (_, i) => ({
		x: clamp(position.x + Math.cos(angle + Math.PI + i * .8) * (10 + i * 2.5), spec.radius, bounds.width - spec.radius),
		y: clamp(position.y + Math.sin(angle + Math.PI + i * .8) * (10 + i * 2.5), spec.radius, bounds.height - spec.radius),
	})) } };
	if (variant === "armoured") return { ...base, variant, state: { phase: "chase" } };
	return { ...base, variant, state: { phase: "chase" } };
}
export function enemyCircles(enemy: Enemy): (Vector & { radius: number })[] {
	const radius = BUG_SPECS[enemy.variant].radius;
	return [{ x: enemy.x, y: enemy.y, radius }, ...(enemy.variant === "centipede" ? enemy.state.segments.map(segment => ({ ...segment, radius })) : [])];
}
export function distanceToSegment(point: Vector, from: Vector, to: Vector) {
	const dx = to.x - from.x, dy = to.y - from.y, length = dx * dx + dy * dy;
	const t = length ? clamp(((point.x - from.x) * dx + (point.y - from.y) * dy) / length, 0, 1) : 0;
	return Math.hypot(point.x - from.x - dx * t, point.y - from.y - dy * t);
}
export function frontArmour(enemy: Enemy, source: Vector) {
	return enemy.variant === "armoured" && Math.abs(angleDifference(Math.atan2(source.y - enemy.y, source.x - enemy.x), enemy.angle)) <= ARMOUR_HALF_ANGLE;
}
function move(enemy: Enemy, direction: Vector, distance: number, bounds: Bounds) {
	const before = { x: enemy.x, y: enemy.y }, radius = BUG_SPECS[enemy.variant].radius;
	enemy.x = clamp(enemy.x + direction.x * distance, radius, bounds.width - radius);
	enemy.y = clamp(enemy.y + direction.y * distance, radius, bounds.height - radius);
	const travel = Math.hypot(enemy.x - before.x, enemy.y - before.y); enemy.walkDistance += travel;
	return travel;
}
function incomingProjectile(enemy: Enemy, bullets: Bullet[]) {
	let closest: Bullet | null = null, earliest = Infinity;
	for (const bullet of bullets) {
		const speedSquared = bullet.vx * bullet.vx + bullet.vy * bullet.vy;
		if (!speedSquared) continue;
		const t = ((enemy.x - bullet.x) * bullet.vx + (enemy.y - bullet.y) * bullet.vy) / speedSquared;
		if (t < 0 || t > Math.min(.35, bullet.life) || t >= earliest) continue;
		if (Math.hypot(bullet.x + bullet.vx * t - enemy.x, bullet.y + bullet.vy * t - enemy.y) > 29) continue;
		earliest = t; closest = bullet;
	}
	return closest;
}
export function stepBugs(game: Game, dt: number, bounds: Bounds, playerRadius: number): Set<number> {
	const lungeContacts = new Set<number>(), player = game.player;
	for (const enemy of game.enemies) {
		if (enemy.health <= 0) continue;
		const dx = player.x - enemy.x, dy = player.y - enemy.y, distance = Math.hypot(dx, dy), desired = Math.atan2(dy, dx);
		const toward = { x: distance ? dx / distance : 0, y: distance ? dy / distance : 0 };
		if (enemy.variant === "spitter") {
			stepAcidSpitter(game, enemy, dt, bounds);
		} else if (enemy.variant === "lunger") {
			const state = enemy.state;
			if (state.phase === "approach") {
				enemy.angle = desired;
				if (distance <= LUNGE_TRIGGER) { state.phase = "windup"; state.remaining = LUNGE_WINDUP; state.direction = desired; }
				else move(enemy, toward, Math.min(distance - LUNGE_TRIGGER, enemy.speed * dt), bounds);
			} else if (state.phase === "windup") {
				state.direction += clamp(angleDifference(desired, state.direction), -LUNGE_WINDUP_TURN_RATE * dt, LUNGE_WINDUP_TURN_RATE * dt); enemy.angle = state.direction;
				state.remaining = Math.max(0, state.remaining - dt);
				if (state.remaining === 0) { state.phase = "lunge"; state.distance = LUNGE_DISTANCE; }
			} else if (state.phase === "lunge") {
				const before = { x: enemy.x, y: enemy.y }, travel = Math.min(state.distance, LUNGE_SPEED * dt);
				const moved = move(enemy, { x: Math.cos(state.direction), y: Math.sin(state.direction) }, travel, bounds);
				state.distance = Math.max(0, state.distance - travel);
				if (distanceToSegment(player, before, enemy) <= playerRadius + BUG_SPECS.lunger.radius) lungeContacts.add(enemy.id);
				if (state.distance === 0 || moved < travel * .5) { state.phase = "recover"; state.remaining = .65; }
			} else {
				state.remaining = Math.max(0, state.remaining - dt);
				if (state.remaining === 0) state.phase = "approach";
			}
		} else if (enemy.variant === "evader") {
			const state = enemy.state;
			state.cooldown = Math.max(0, state.cooldown - dt);
			if (state.phase === "dodge") {
				move(enemy, state.direction, 220 * dt, bounds); enemy.angle = Math.atan2(state.direction.y, state.direction.x);
				state.remaining = Math.max(0, state.remaining - dt);
				if (state.remaining === 0) state.phase = "chase";
			} else {
				const bullet = state.cooldown === 0 ? incomingProjectile(enemy, game.bullets) : null;
				if (bullet) {
					const speed = Math.hypot(bullet.vx, bullet.vy), perpendicular = { x: -bullet.vy / speed, y: bullet.vx / speed };
					const side = Math.sign((enemy.x - bullet.x) * perpendicular.x + (enemy.y - bullet.y) * perpendicular.y) || (enemy.id % 2 ? 1 : -1);
					const clearance = (sign: number) => Math.min(enemy.x + perpendicular.x * sign * 60, bounds.width - enemy.x - perpendicular.x * sign * 60, enemy.y + perpendicular.y * sign * 60, bounds.height - enemy.y - perpendicular.y * sign * 60);
					const sign = clearance(side) >= clearance(-side) ? side : -side;
					state.direction = { x: perpendicular.x * sign, y: perpendicular.y * sign }; state.phase = "dodge"; state.remaining = .24; state.cooldown = .65;
				} else { move(enemy, toward, Math.min(distance, enemy.speed * dt), bounds); enemy.angle = desired; }
			}
		} else if (enemy.variant === "beetle") {
			const state = enemy.state;
			enemy.angle = desired;
			state.remaining = Math.max(0, state.remaining - dt);
			const direction = distance < 240 ? -1 : distance > 340 ? 1 : 0;
			move(enemy, { x: toward.x * direction, y: toward.y * direction }, enemy.speed * dt, bounds);
			if (state.remaining === 0) state.phase = "ready";
			if (state.phase === "ready" && distance <= 380 && game.lobs.length < 64) {
				game.lobs.push({ id: game.nextId++, x: enemy.x + toward.x * 22, y: enemy.y + toward.y * 22, target: { x: player.x, y: player.y }, age: 0 });
				state.phase = "roll"; state.remaining = BEETLE_ROLL_TIME;
			}
		} else if (enemy.variant === "armoured") {
			const error = angleDifference(desired, enemy.angle);
			enemy.angle += clamp(error, -.7 * dt, .7 * dt);
			const alignment = Math.abs(angleDifference(desired, enemy.angle));
			const pace = alignment > .3 ? .55 : 1;
			move(enemy, { x: Math.cos(enemy.angle), y: Math.sin(enemy.angle) }, Math.min(distance, enemy.speed * pace * dt), bounds);
		} else if (enemy.variant === "centipede") {
			// Circle the mech, laying a moving barrier rather than chasing into contact.
			const side = enemy.id % 2 ? 1 : -1, radial = clamp((distance - 130) / 65, -1, 1);
			const vx = toward.x * radial - toward.y * side, vy = toward.y * radial + toward.x * side;
			const target = Math.atan2(vy, vx); enemy.angle += clamp(angleDifference(target, enemy.angle), -2.4 * dt, 2.4 * dt);
			move(enemy, { x: Math.cos(enemy.angle), y: Math.sin(enemy.angle) }, enemy.speed * dt, bounds);
			let leader: Vector = enemy;
			for (const segment of enemy.state.segments) {
				const sx = leader.x - segment.x, sy = leader.y - segment.y, length = Math.hypot(sx, sy);
				if (length > SEGMENT_SPACING) { segment.x = leader.x - sx / length * SEGMENT_SPACING; segment.y = leader.y - sy / length * SEGMENT_SPACING; }
				leader = segment;
			}
		} else { move(enemy, toward, Math.min(distance, enemy.speed * dt), bounds); enemy.angle = desired; }
	}
	return lungeContacts;
}
function separateFromCircle(player: Vector, circle: Vector, radius: number, fallback: number, playerRadius: number, bounds: Bounds) {
	const dx = player.x - circle.x, dy = player.y - circle.y, distance = Math.hypot(dx, dy);
	const nx = distance > .0001 ? dx / distance : Math.cos(fallback), ny = distance > .0001 ? dy / distance : Math.sin(fallback);
	const projected = { x: clamp(circle.x + nx * radius, playerRadius, bounds.width - playerRadius), y: clamp(circle.y + ny * radius, playerRadius, bounds.height - playerRadius) };
	if (Math.hypot(projected.x - circle.x, projected.y - circle.y) >= radius - .001) return projected;
	// When a moving body pins the mech against a wall, separate along that wall.
	const candidates: Vector[] = [];
	for (const x of [playerRadius, bounds.width - playerRadius]) {
		const squared = radius * radius - (x - circle.x) ** 2;
		if (squared >= 0) for (const sign of [-1, 1]) candidates.push({ x, y: circle.y + sign * Math.sqrt(squared) });
	}
	for (const y of [playerRadius, bounds.height - playerRadius]) {
		const squared = radius * radius - (y - circle.y) ** 2;
		if (squared >= 0) for (const sign of [-1, 1]) candidates.push({ x: circle.x + sign * Math.sqrt(squared), y });
	}
	return candidates.filter(point => point.x >= playerRadius && point.x <= bounds.width - playerRadius && point.y >= playerRadius && point.y <= bounds.height - playerRadius)
		.sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y))[0] ?? projected;
}
export function resolveBarriers(player: Vector, enemies: Enemy[], playerRadius: number, bounds: Bounds) {
	const barriers = enemies.filter(enemy => enemy.variant === "centipede" && enemy.health > 0).flatMap(enemy => enemyCircles(enemy).map(circle => ({ ...circle, angle: enemy.angle })));
	for (let pass = 0; pass < 12; pass++) {
		let adjusted = false;
		for (const circle of barriers) {
			const distance = Math.hypot(player.x - circle.x, player.y - circle.y), radius = playerRadius + circle.radius;
			if (distance >= radius - .001) continue;
			Object.assign(player, separateFromCircle(player, circle, radius, circle.angle + Math.PI / 2, playerRadius, bounds)); adjusted = true;
		}
		if (!adjusted) break;
	}
}

function translateBug(enemy: Enemy, dx: number, dy: number, bounds: Bounds) {
	const radius = BUG_SPECS[enemy.variant].radius;
	if (enemy.variant !== "centipede") {
		enemy.x = clamp(enemy.x + dx, radius, bounds.width - radius); enemy.y = clamp(enemy.y + dy, radius, bounds.height - radius);
		return;
	}
	const points = [enemy, ...enemy.state.segments];
	let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
	for (const point of points) { minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x); minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y); }
	dx = clamp(dx, radius - minX, bounds.width - radius - maxX); dy = clamp(dy, radius - minY, bounds.height - radius - maxY);
	for (const point of points) { point.x += dx; point.y += dy; }
}
export function separateBugs(enemies: Enemy[], bounds: Bounds) {
	// Broad-phase cells keep the solver local, including every centipede segment.
	const nodes = enemies.filter(enemy => enemy.health > 0).flatMap(enemy => {
		const radius = BUG_SPECS[enemy.variant].radius, mass = enemy.variant === "centipede" ? 8 : enemy.variant === "armoured" ? 2 : 1;
		return (enemy.variant === "centipede" ? [enemy, ...enemy.state.segments] : [enemy]).map(point => ({ enemy, point, radius, mass }));
	});
	const cellSize = 48, stride = Math.ceil(bounds.width / cellSize) + 2, pairs: number[] = [];
	let refresh = true;
	for (let pass = 0; pass < 96; pass++) {
		const fresh = refresh || pass % 8 === 0;
		if (fresh) {
			const grid = new Map<number, number[]>(); pairs.length = 0;
			for (let i = 0; i < nodes.length; i++) {
				const { point } = nodes[i], key = Math.floor(point.x / cellSize) + Math.floor(point.y / cellSize) * stride;
				const cell = grid.get(key); if (cell) cell.push(i); else grid.set(key, [i]);
			}
			for (let i = 0; i < nodes.length; i++) {
				const a = nodes[i], cx = Math.floor(a.point.x / cellSize), cy = Math.floor(a.point.y / cellSize);
				for (let gx = cx - 1; gx <= cx + 1; gx++) for (let gy = cy - 1; gy <= cy + 1; gy++) for (const j of grid.get(gx + gy * stride) ?? []) {
					if (j > i && a.enemy !== nodes[j].enemy) pairs.push(i, j);
				}
			}
		}
		let overlap = 0;
		for (let k = 0; k < pairs.length; k += 2) {
			const a = nodes[pairs[k]], b = nodes[pairs[k + 1]];
			const dx = b.point.x - a.point.x, dy = b.point.y - a.point.y, minimum = a.radius + b.radius + BUG_CLEARANCE;
			if (dx * dx + dy * dy >= (minimum - .02) ** 2) continue;
			const distance = Math.sqrt(dx * dx + dy * dy), penetration = minimum - distance;
			overlap = Math.max(overlap, penetration);
			const angle = distance > .0001 ? 0 : ((Math.imul(a.enemy.id, 73856093) ^ Math.imul(b.enemy.id, 19349663)) >>> 0) / 4294967296 * Math.PI * 2;
			const nx = distance > .0001 ? dx / distance : Math.cos(angle), ny = distance > .0001 ? dy / distance : Math.sin(angle);
			translateBug(a.enemy, -nx * penetration * b.mass / (a.mass + b.mass), -ny * penetration * b.mass / (a.mass + b.mass), bounds);
			translateBug(b.enemy, nx * penetration * a.mass / (a.mass + b.mass), ny * penetration * a.mass / (a.mass + b.mass), bounds);
			// A wall may absorb one body's share; let the other use the remaining room.
			const remaining = minimum - Math.hypot(b.point.x - a.point.x, b.point.y - a.point.y);
			if (remaining > .02) {
				translateBug(b.enemy, nx * remaining, ny * remaining, bounds);
				const rest = minimum - Math.hypot(b.point.x - a.point.x, b.point.y - a.point.y);
				if (rest > .02) translateBug(a.enemy, -nx * rest, -ny * rest, bounds);
			}
		}
		if (overlap <= .02 && fresh) break;
		refresh = overlap <= .02;
	}
}
