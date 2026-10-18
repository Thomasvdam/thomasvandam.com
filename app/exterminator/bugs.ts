import { stepAssassin } from "./remains";
import { stepBombardier, stepDragonfly, stepSpider } from "./predators";
import { moveBug as move } from "./bug-motion";
import { colonyIndex, hatchEgg, stepQueen, stepSlug, stepWorker } from "./ecology";
import { BUG_TYPES, defaultBugWeights, type BugWeights, BUG_SPECS, BEETLE_ROLL_TIME, LUNGE_TRIGGER, LUNGE_DISTANCE, LUNGE_WINDUP, LUNGE_SPEED, LUNGE_WINDUP_TURN_RATE, ARMOUR_HALF_ANGLE, SEGMENT_SPACING, BUG_CLEARANCE, type BugVariant, type Enemy } from "./bug-types";
import { stepAcidSpitter, stepBulletAnt } from "./acid";
import type { Bullet, Game } from "./game";
import { clamp, angleDifference, distanceToSegment, type Vector, type Bounds } from "./math";

export function bugForSpawn(cleared: number, wave: number, index: number, weights: BugWeights = defaultBugWeights(cleared)): BugVariant {
	// A low-discrepancy sequence spreads the weighted mix through even short waves.
	let ticket = ((index * .6180339887498949 + (wave - 1) * .4142135623730951) % 1) * BUG_TYPES.reduce((sum, type) => sum + weights[type], 0);
	for (const type of BUG_TYPES) {
		ticket -= weights[type];
		if (ticket < 0) return type;
	}
	return "burrower";
}

export { createBug } from "./bug-types";
export function enemyCircles(enemy: Enemy): (Vector & { radius: number })[] {
	const radius = BUG_SPECS[enemy.variant].radius;
	return [{ x: enemy.x, y: enemy.y, radius }, ...(enemy.variant === "centipede" ? enemy.state.segments.map(segment => ({ ...segment, radius })) : [])];
}

export function frontArmour(enemy: Enemy, source: Vector) {
	return enemy.variant === "armoured" && Math.abs(angleDifference(Math.atan2(source.y - enemy.y, source.x - enemy.x), enemy.angle)) <= ARMOUR_HALF_ANGLE;
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
	const lungeContacts = new Set<number>(), player = game.player, colonies = colonyIndex(game.enemies);
	for (let index = 0; index < game.enemies.length; index++) {
		const enemy = game.enemies[index];
		if (enemy.health <= 0) continue;
		const dx = player.x - enemy.x, dy = player.y - enemy.y, distance = Math.hypot(dx, dy), desired = Math.atan2(dy, dx);
		const toward = { x: distance ? dx / distance : 0, y: distance ? dy / distance : 0 };
		if (enemy.variant === "assassin") {
			stepAssassin(game, enemy, dt, bounds);
		} else if (enemy.variant === "antlion") {
			enemy.angle = desired; continue;
		} else if (enemy.variant === "bombardier") {
			stepBombardier(game, enemy, dt, bounds, playerRadius);
		} else if (enemy.variant === "dragonfly") {
			stepDragonfly(game, enemy, dt, bounds, playerRadius);
		} else if (enemy.variant === "bolasSpider") {
			stepSpider(game, enemy, dt, bounds);
		} else if (enemy.variant === "slug") {
			stepSlug(game, enemy, dt, bounds);
		} else if (enemy.variant === "queen") {
			stepQueen(game, enemy, colonies.get(enemy.id)!, dt, bounds);
		} else if (enemy.variant === "worker") {
			stepWorker(game, enemy, enemy.state.queenId === null ? undefined : colonies.get(enemy.state.queenId), dt, bounds);
		} else if (enemy.variant === "egg") {
			game.enemies[index] = hatchEgg(game, enemy, bounds);
		} else if (enemy.variant === "bulletAnt") {
			stepBulletAnt(game, enemy, dt, bounds);
		} else if (enemy.variant === "spitter") {
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
	const barriers = enemies.filter((enemy): enemy is Extract<Enemy, { variant: "centipede" }> => enemy.variant === "centipede" && enemy.health > 0);
	const radius = playerRadius + BUG_SPECS.centipede.radius;
	for (let pass = 0; pass < 12; pass++) {
		let adjusted = false;
		for (const enemy of barriers) for (let i = -1; i < enemy.state.segments.length; i++) {
			const circle = i < 0 ? enemy : enemy.state.segments[i];
			if (Math.hypot(player.x - circle.x, player.y - circle.y) >= radius - .001) continue;
			Object.assign(player, separateFromCircle(player, circle, radius, enemy.angle + Math.PI / 2, playerRadius, bounds)); adjusted = true;
		}
		if (!adjusted) break;
	}
}

type CollisionBody = { enemy: Enemy; points: Vector[]; radius: number; mass: number; minX: number; maxX: number; minY: number; maxY: number };
function translateBug(body: CollisionBody, dx: number, dy: number, bounds: Bounds) {
	const { enemy, radius } = body;
	if (enemy.variant !== "centipede") {
		enemy.x = clamp(enemy.x + dx, radius, bounds.width - radius); enemy.y = clamp(enemy.y + dy, radius, bounds.height - radius);
		return;
	}
	// Relaxation only translates a chain: its bounds need measuring once per solve.
	dx = clamp(dx, radius - body.minX, bounds.width - radius - body.maxX); dy = clamp(dy, radius - body.minY, bounds.height - radius - body.maxY);
	for (const point of body.points) { point.x += dx; point.y += dy; }
	body.minX += dx; body.maxX += dx; body.minY += dy; body.maxY += dy;
}
export function separateBugs(enemies: Enemy[], bounds: Bounds) {
	// Broad-phase cells keep the solver local, including every centipede segment.
	let largestRadius = 0;
	const nodes = enemies.filter(enemy => enemy.health > 0 && enemy.variant !== "egg" && enemy.variant !== "antlion" && enemy.variant !== "dragonfly").flatMap(enemy => {
		const radius = BUG_SPECS[enemy.variant].radius, mass = enemy.variant === "centipede" ? 8 : enemy.variant === "armoured" ? 2 : 1;
		largestRadius = Math.max(largestRadius, radius);
		const points = enemy.variant === "centipede" ? [enemy, ...enemy.state.segments] : [enemy];
		const body: CollisionBody = { enemy, points, radius, mass, minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
		for (const point of points) { body.minX = Math.min(body.minX, point.x); body.maxX = Math.max(body.maxX, point.x); body.minY = Math.min(body.minY, point.y); body.maxY = Math.max(body.maxY, point.y); }
		return points.map(point => ({ enemy, point, radius, mass, body }));
	});
	const cellSize = Math.max(48, largestRadius * 2 + BUG_CLEARANCE), stride = Math.ceil(bounds.width / cellSize) + 2, pairs: number[] = [];
	const heads = new Int32Array(stride * (Math.ceil(bounds.height / cellSize) + 2));
	const next = new Int32Array(nodes.length), cells = new Int32Array(nodes.length);
	const offsets = [-stride - 1, -1, stride - 1, -stride, 0, stride, -stride + 1, 1, stride + 1];
	let refresh = true;
	for (let pass = 0; pass < 96; pass++) {
		const fresh = refresh || pass % 8 === 0;
		if (fresh) {
			heads.fill(-1); pairs.length = 0;
			// Build in reverse so each linked cell visits nodes in stable ascending order.
			for (let i = nodes.length - 1; i >= 0; i--) {
				const { point } = nodes[i], key = Math.floor(point.x / cellSize) + 1 + (Math.floor(point.y / cellSize) + 1) * stride;
				cells[i] = key; next[i] = heads[key]; heads[key] = i;
			}
			for (let i = 0; i < nodes.length; i++) for (const offset of offsets) {
				for (let j = heads[cells[i] + offset]; j !== -1; j = next[j]) {
					if (j > i && nodes[i].enemy !== nodes[j].enemy) pairs.push(i, j);
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
			translateBug(a.body, -nx * penetration * b.mass / (a.mass + b.mass), -ny * penetration * b.mass / (a.mass + b.mass), bounds);
			translateBug(b.body, nx * penetration * a.mass / (a.mass + b.mass), ny * penetration * a.mass / (a.mass + b.mass), bounds);
			// A wall may absorb one body's share; let the other use the remaining room.
			const remaining = minimum - Math.hypot(b.point.x - a.point.x, b.point.y - a.point.y);
			if (remaining > .02) {
				translateBug(b.body, nx * remaining, ny * remaining, bounds);
				const rest = minimum - Math.hypot(b.point.x - a.point.x, b.point.y - a.point.y);
				if (rest > .02) translateBug(a.body, -nx * rest, -ny * rest, bounds);
			}
		}
		if (overlap <= .02 && fresh) break;
		refresh = overlap <= .02;
	}
}
