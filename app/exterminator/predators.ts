import { BUG_SPECS, type Enemy } from "./bug-types";
import { moveBug, walkBugTo } from "./bug-motion";
import type { Game } from "./game";
import { angleDifference, circleHitTime, clamp, distanceToSegment, segmentHitTime, type Bounds, type Vector } from "./math";
import type { Terrain } from "./terrain";

export const PIT_RADIUS = 180;
export const PIT_PULL: Record<Terrain, number> = { firm: 270, rubble: 200, mud: 175 };
export const SPRAY_WINDUP = .75;
export const SPRAY_DURATION = .4;
export const SPRAY_RANGE = 180;
export const SPRAY_HALF_ANGLE = Math.PI / 4;
export const DRAGONFLY_WINDUP = .6;
export const DRAGONFLY_SPEED = 500;
export const SPIDER_WINDUP = .9;
export const BOLA_SPEED = 420;
export const TETHER_RANGE = 760;
export const TETHER_LIFETIME = 6;
export const TETHER_PULL = 130;
export type Bola = Vector & { id: number; owner: number; vx: number; vy: number; life: number };
export type Tether = { owner: number; remaining: number };
export type Spider = Extract<Enemy, { variant: "bolasSpider" }>;
export type SpiderIndex = Map<number, Spider>;

export function preparePulls(game: Game, dt: number) {
	const spiders: SpiderIndex = new Map(), force = { x: 0, y: 0 };
	let terrain: Terrain | null = null, strongest = 0;
	for (const enemy of game.enemies) {
		if (enemy.health <= 0) continue;
		if (enemy.variant === "bolasSpider") spiders.set(enemy.id, enemy);
		if (enemy.variant !== "antlion") continue;
		const dx = enemy.x - game.player.x, dy = enemy.y - game.player.y, distance = Math.hypot(dx, dy);
		if (distance >= PIT_RADIUS) continue;
		const pull = PIT_PULL[enemy.state.terrain] * (1 - distance / PIT_RADIUS);
		if (pull > strongest) { strongest = pull; terrain = enemy.state.terrain; }
		if (distance > 0) { const speed = Math.min(pull, distance / dt); force.x += dx / distance * speed; force.y += dy / distance * speed; }
	}
	// Overlapping pits can change direction but cannot amplify their strongest pull.
	const pitSpeed = Math.hypot(force.x, force.y);
	if (pitSpeed > strongest) { force.x *= strongest / pitSpeed; force.y *= strongest / pitSpeed; }
	game.tethers = game.tethers.filter(tether => {
		tether.remaining -= dt;
		const spider = spiders.get(tether.owner);
		if (!spider || tether.remaining <= 0) return false;
		const dx = spider.x - game.player.x, dy = spider.y - game.player.y, distance = Math.hypot(dx, dy);
		if (distance > TETHER_RANGE || distance < 60) return false;
		force.x += dx / distance * TETHER_PULL; force.y += dy / distance * TETHER_PULL;
		return true;
	});
	return { terrain, force, spiders };
}
export function provokeBombardier(game: Game, enemy: Enemy) {
	if (enemy.variant !== "bombardier" || enemy.health <= 0 || enemy.state.phase !== "chase") return;
	enemy.state.phase = "windup"; enemy.state.remaining = SPRAY_WINDUP;
	enemy.state.direction = Math.atan2(game.player.y - enemy.y, game.player.x - enemy.x);
	enemy.angle = enemy.state.direction + Math.PI;
}
export function inSpray(point: Vector, enemy: Vector, direction: number, radius: number) {
	const dx = point.x - enemy.x, dy = point.y - enemy.y, distance = Math.hypot(dx, dy);
	return distance <= SPRAY_RANGE + radius && (distance <= radius || Math.abs(angleDifference(Math.atan2(dy, dx), direction)) <= SPRAY_HALF_ANGLE + Math.asin(Math.min(1, radius / distance)));
}
export function stepBombardier(game: Game, enemy: Extract<Enemy, { variant: "bombardier" }>, dt: number, bounds: Bounds, playerRadius: number) {
	const state = enemy.state;
	if (state.phase === "chase") { walkBugTo(enemy, game.player, dt, bounds); return; }
	state.remaining = Math.max(0, state.remaining - dt);
	if (state.phase === "windup") {
		if (state.remaining === 0) { state.phase = "spray"; state.remaining = SPRAY_DURATION; }
	} else if (state.phase === "spray") {
		if (game.player.invulnerable === 0 && inSpray(game.player, enemy, state.direction, playerRadius)) { game.player.health = Math.max(0, game.player.health - 20); game.player.invulnerable = .9; }
		if (state.remaining === 0) { state.phase = "recover"; state.remaining = 2.2; }
	} else if (state.remaining === 0) state.phase = "chase";
}
export function stepDragonfly(game: Game, enemy: Extract<Enemy, { variant: "dragonfly" }>, dt: number, bounds: Bounds, playerRadius: number) {
	const state = enemy.state; state.contact = false; state.remaining = Math.max(0, state.remaining - dt);
	if (state.phase === "windup") {
		enemy.angle = Math.atan2(state.target.y - enemy.y, state.target.x - enemy.x);
		if (state.remaining === 0) state.phase = "intercept";
		return;
	}
	if (state.phase === "intercept") {
		const before = { x: enemy.x, y: enemy.y }, distance = Math.hypot(state.target.x - enemy.x, state.target.y - enemy.y);
		const travel = Math.min(distance, DRAGONFLY_SPEED * dt);
		if (distance > 0) moveBug(enemy, { x: (state.target.x - enemy.x) / distance, y: (state.target.y - enemy.y) / distance }, travel, bounds);
		state.contact = distanceToSegment(game.player, before, enemy) <= playerRadius + BUG_SPECS.dragonfly.radius;
		if (distance <= travel + .01) { state.phase = "recover"; state.remaining = 1.2; }
		return;
	}
	if (state.phase === "recover") { if (state.remaining === 0) { state.phase = "track"; state.remaining = 1; } return; }
	const dx = game.player.x - enemy.x, dy = game.player.y - enemy.y, distance = Math.hypot(dx, dy), side = enemy.id % 2 ? 1 : -1;
	if (distance > 0) {
		const radial = clamp((distance - 280) / 100, -1, 1), vx = dx / distance * radial - dy / distance * side * .4, vy = dy / distance * radial + dx / distance * side * .4;
		const length = Math.hypot(vx, vy); enemy.angle = Math.atan2(vy, vx);
		moveBug(enemy, { x: vx / length, y: vy / length }, enemy.speed * dt, bounds);
	}
	if (state.remaining === 0 && distance <= 650) {
		state.target = { x: clamp(game.player.x + game.playerVelocity.x * .65, playerRadius, bounds.width - playerRadius), y: clamp(game.player.y + game.playerVelocity.y * .65, playerRadius, bounds.height - playerRadius) };
		state.phase = "windup"; state.remaining = DRAGONFLY_WINDUP;
	}
}
export function spiderCover(game: Game, spider: Spider, bounds: Bounds) {
	let best: { id: number; point: Vector } | null = null, score = Infinity;
	for (const bug of game.enemies) {
		if (bug.health <= 0 || bug.id === spider.id || bug.variant === "egg" || bug.variant === "dragonfly" || bug.variant === "bolasSpider") continue;
		const dx = bug.x - game.player.x, dy = bug.y - game.player.y, distance = Math.hypot(dx, dy);
		if (distance < 1 || distance > 500) continue;
		const behind = Math.max(150, 480 - distance), point = { x: bug.x + dx / distance * behind, y: bug.y + dy / distance * behind }, radius = BUG_SPECS.bolasSpider.radius;
		if (point.x < radius || point.y < radius || point.x > bounds.width - radius || point.y > bounds.height - radius) continue;
		const cost = Math.hypot(spider.x - point.x, spider.y - point.y) - (bug.id === spider.state.coverId ? 60 : 0);
		if (cost < score) { score = cost; best = { id: bug.id, point }; }
	}
	return best;
}
export function stepSpider(game: Game, spider: Spider, dt: number, bounds: Bounds) {
	const state = spider.state; state.cooldown = Math.max(0, state.cooldown - dt); state.seekRemaining -= dt;
	if (state.phase === "windup") {
		state.remaining = Math.max(0, state.remaining - dt);
		spider.angle = Math.atan2(state.target.y - spider.y, state.target.x - spider.x);
		if (state.remaining === 0) {
			if (game.bolas.length < 64) game.bolas.push({ id: game.nextId++, owner: spider.id, x: spider.x, y: spider.y, vx: Math.cos(spider.angle) * BOLA_SPEED, vy: Math.sin(spider.angle) * BOLA_SPEED, life: TETHER_RANGE / BOLA_SPEED });
			state.phase = "position"; state.cooldown = 3.2;
		}
		return;
	}
	const range = Math.hypot(game.player.x - spider.x, game.player.y - spider.y), angle = Math.atan2(game.player.y - spider.y, game.player.x - spider.x);
	if (state.seekRemaining <= 0) {
		const cover = spiderCover(game, spider, bounds); state.coverId = cover?.id ?? null; state.seekRemaining = .5;
		if (cover) state.destination = cover.point;
	}
	if (state.coverId !== null && game.enemies.some(enemy => enemy.id === state.coverId && enemy.health > 0)) walkBugTo(spider, state.destination, dt, bounds);
	else {
		const direction = range < 450 ? -1 : range > 600 ? 1 : 0;
		walkBugTo(spider, { x: spider.x + Math.cos(angle) * direction * 100 - Math.sin(angle) * 25, y: spider.y + Math.sin(angle) * direction * 100 + Math.cos(angle) * 25 }, dt, bounds);
	}
	spider.angle = angle;
	if (state.cooldown === 0 && range <= 680 && range >= 200 && !game.tethers.some(tether => tether.owner === spider.id) && !game.bolas.some(bola => bola.owner === spider.id)) {
		state.phase = "windup"; state.remaining = SPIDER_WINDUP; state.target = { x: game.player.x, y: game.player.y };
	}
}
export function stepBolas(game: Game, dt: number, spiders: SpiderIndex, playerRadius: number) {
	game.bolas = game.bolas.filter(bola => {
		const owner = spiders.get(bola.owner);
		if (!owner || owner.health <= 0) return false;
		const previous = { x: bola.x, y: bola.y }, travel = Math.min(dt, bola.life);
		bola.x += bola.vx * travel; bola.y += bola.vy * travel; bola.life -= dt;
		if (circleHitTime(bola, game.player, playerRadius, previous, 7) < Infinity) {
			if (!game.tethers.some(tether => tether.owner === bola.owner)) game.tethers.push({ owner: bola.owner, remaining: TETHER_LIFETIME });
			return false;
		}
		return bola.life > 0;
	});
	game.tethers = game.tethers.filter(tether => (spiders.get(tether.owner)?.health ?? 0) > 0);
}
export function cuttableStrand(player: Vector, spider: Vector) {
	const dx = spider.x - player.x, dy = spider.y - player.y, distance = Math.hypot(dx, dy);
	return { x: player.x + dx / Math.max(1, distance) * 40, y: player.y + dy / Math.max(1, distance) * 40 };
}
export function firstTetherHit(game: Game, spiders: SpiderIndex, previous: Vector, end: Vector) {
	let owner: number | null = null, time = Infinity;
	for (const tether of game.tethers) {
		const spider = spiders.get(tether.owner); if (!spider || spider.health <= 0) continue;
		const hit = segmentHitTime(end, previous, cuttableStrand(game.player, spider), spider, 6);
		if (hit < time) { time = hit; owner = spider.id; }
	}
	return { owner, time };
}
export function blastTethers(game: Game, spiders: SpiderIndex, center: Vector, radius: number) {
	game.tethers = game.tethers.filter(tether => {
		const spider = spiders.get(tether.owner);
		return spider && spider.health > 0 && distanceToSegment(center, cuttableStrand(game.player, spider), spider) > radius;
	});
}
export function flameTethers(game: Game, spiders: SpiderIndex, origin: Vector, angle: number, range: number, halfAngle: number) {
	const cosine = Math.cos(angle), sine = Math.sin(angle), width = Math.tan(halfAngle);
	game.tethers = game.tethers.filter(tether => {
		const spider = spiders.get(tether.owner); if (!spider || spider.health <= 0) return false;
		const dx = spider.x - game.player.x, dy = spider.y - game.player.y, length = Math.hypot(dx, dy);
		for (let distance = 40; distance <= Math.min(length, range + 30); distance += 4) {
			const px = game.player.x + dx / length * distance - origin.x, py = game.player.y + dy / length * distance - origin.y, forward = px * cosine + py * sine;
			if (forward >= -3 && Math.abs(px * sine - py * cosine) <= Math.max(0, forward) * width + 3 && px * px + py * py <= (range + 3) ** 2) return false;
		}
		return true;
	});
}
