import { BUG_SPECS, createBug, type Enemy } from "./bug-types";
import { moveBug, walkBugTo } from "./bug-motion";
import { combatTarget, cornerPosition, damageLamp, LAMP_RADIUS } from "./light-threats";
import { angleDifference, clamp, type Bounds, type Vector } from "./math";
import { inFlame } from "./remains";
import { damageEnemy, FIELD, type Game } from "./game";

export const CLICK_WINDUP = .75;
export const CLICK_FLIGHT = .7;
export const CLICK_RADIUS = 65;
export const ANT_CHARGE = .65;
export const ANT_RADIUS = 75;
export const GLUE_RANGE = 155;
export const GLUE_HALF_ANGLE = .32;
export const GLUE_WINDUP = .7;
export const GLUE_DURATION = 2.4;
export const BROOD_TIME = 6;
export const BROOD_COUNT = 4;
export const MAX_LARVAE = 80;
export const airborne = (enemy: Enemy) => enemy.variant === "clickBeetle" && enemy.state.phase === "flight";
export const clickElevation = (enemy: Enemy) => enemy.variant === "clickBeetle" && enemy.state.phase === "flight" ? Math.sin((1 - enemy.state.remaining / CLICK_FLIGHT) * Math.PI) * 85 : 0;
export const enemyPosition = (enemy: Enemy): Vector => ({ x: enemy.x, y: enemy.y - clickElevation(enemy) });
export function hurtPlayer(game: Game, damage: number) {
	if (game.player.invulnerable > 0) return;
	game.player.health = Math.max(0, game.player.health - damage); game.player.invulnerable = .9;
}
export function stepClickBeetle(game: Game, enemy: Extract<Enemy, { variant: "clickBeetle" }>, dt: number, bounds: Bounds, playerRadius: number) {
	const state = enemy.state, target = combatTarget(game, enemy), distance = Math.hypot(target.x - enemy.x, target.y - enemy.y);
	if (state.phase === "approach") {
		if (distance > 290) { walkBugTo(enemy, target, dt, bounds); return; }
		state.phase = "windup"; state.remaining = CLICK_WINDUP; state.origin = { x: enemy.x, y: enemy.y };
		const radius = BUG_SPECS.clickBeetle.radius;
		state.target = { x: clamp(target.x, radius, bounds.width - radius), y: clamp(target.y, radius, bounds.height - radius) };
		enemy.attackLight = enemy.lightTarget;
		enemy.angle = Math.atan2(target.y - enemy.y, target.x - enemy.x); return;
	}
	state.remaining = Math.max(0, state.remaining - dt);
	if (state.phase === "windup" && state.remaining === 0) {
		state.phase = "flight"; state.remaining = CLICK_FLIGHT; state.origin = { x: enemy.x, y: enemy.y };
	} else if (state.phase === "flight") {
		const progress = 1 - state.remaining / CLICK_FLIGHT;
		enemy.x = state.origin.x + (state.target.x - state.origin.x) * progress;
		enemy.y = state.origin.y + (state.target.y - state.origin.y) * progress;
		if (state.remaining > 0) return;
		game.explosions.push({ id: game.nextId++, x: enemy.x, y: enemy.y, radius: CLICK_RADIUS, bornAt: game.time });
		if (Math.hypot(game.player.x - enemy.x, game.player.y - enemy.y) <= CLICK_RADIUS + playerRadius) hurtPlayer(game, 25);
		if (enemy.attackLight && Math.hypot(cornerPosition(enemy.attackLight).x - enemy.x, cornerPosition(enemy.attackLight).y - enemy.y) <= CLICK_RADIUS + LAMP_RADIUS) damageLamp(game, enemy.attackLight, 25);
		state.phase = "recover"; state.remaining = .9;
	} else if (state.phase === "recover" && state.remaining === 0) state.phase = "approach";
}
export function stepExplodingAnt(game: Game, enemy: Extract<Enemy, { variant: "explodingAnt" }>, dt: number, bounds: Bounds) {
	const target = combatTarget(game, enemy), state = enemy.state;
	if (state.phase === "chase") {
		if (Math.hypot(target.x - enemy.x, target.y - enemy.y) > 52) { walkBugTo(enemy, target, dt, bounds); return; }
		state.phase = "charge"; state.remaining = ANT_CHARGE;
	} else {
		state.remaining = Math.max(0, state.remaining - dt);
		if (state.remaining === 0) enemy.health = 0;
	}
}
export function glueTouches(game: Game, point: Vector, radius: number) {
	return game.enemies.some(enemy => enemy.health > 0 && enemy.variant === "velvetWorm" && enemy.state.phase === "spray" && inFlame(point, radius, enemy, enemy.state.direction, GLUE_RANGE, GLUE_HALF_ANGLE));
}
export function updateGlue(game: Game, dt: number, playerRadius: number) {
	const exposed = glueTouches(game, game.player, playerRadius);
	game.glue = clamp(game.glue + dt * (exposed ? .65 : -.3), 0, 1);
	return 1 - game.glue * .65;
}
export function stepVelvetWorm(game: Game, enemy: Extract<Enemy, { variant: "velvetWorm" }>, dt: number, bounds: Bounds) {
	const target = combatTarget(game, enemy), state = enemy.state, desired = Math.atan2(target.y - enemy.y, target.x - enemy.x);
	if (state.phase === "approach") {
		enemy.angle += clamp(angleDifference(desired, enemy.angle), -1.2 * dt, 1.2 * dt);
		if (Math.hypot(target.x - enemy.x, target.y - enemy.y) > GLUE_RANGE * .85) moveBug(enemy, { x: Math.cos(enemy.angle), y: Math.sin(enemy.angle) }, enemy.speed * dt, bounds);
		else { state.phase = "windup"; state.remaining = GLUE_WINDUP; state.direction = enemy.angle; state.sweep = enemy.id % 2 ? 1 : -1; }
		return;
	}
	state.remaining = Math.max(0, state.remaining - dt);
	if (state.phase === "windup" && state.remaining === 0) { state.phase = "spray"; state.remaining = GLUE_DURATION; state.direction = enemy.angle - state.sweep * .5; }
	else if (state.phase === "spray") {
		state.direction += state.sweep * dt * .42; enemy.angle = state.direction;
		if (state.remaining === 0) { state.phase = "recover"; state.remaining = .8; }
	} else if (state.phase === "recover" && state.remaining === 0) state.phase = "approach";
}

const excludedHosts = new Set(["queen", "egg", "centipede", "moth", "courier", "parasitoidWasp", "larva"]);
export const canImplant = (enemy: Enemy, time: number) => enemy.health > 0 && !excludedHosts.has(enemy.variant) && !enemy.brood && time >= (enemy.broodBlockedUntil ?? 0);
export function broodPosition(enemy: Enemy) {
	const direction = enemy.angle + (enemy.id % 2 ? 1 : -1) * Math.PI / 2, distance = BUG_SPECS[enemy.variant].radius + 14;
	const center = enemyPosition(enemy);
	const point = (angle: number) => ({ x: center.x + Math.cos(angle) * distance, y: center.y + Math.sin(angle) * distance });
	const inside = (p: Vector) => p.x >= 10 && p.x <= FIELD.width - 10 && p.y >= 10 && p.y <= FIELD.height - 10;
	const preferred = point(direction), opposite = point(direction + Math.PI);
	// Keep the separate target inside the arena, including hosts against a corner.
	return inside(preferred) ? preferred : inside(opposite) ? opposite : point(Math.atan2(FIELD.height / 2 - center.y, FIELD.width / 2 - center.x));
}
export const broodRadius = (enemy: Enemy) => 4 + 5 * clamp((enemy.brood?.age ?? 0) / BROOD_TIME, 0, 1);
export function damageBrood(game: Game, enemy: Enemy, damage: number) {
	if (!enemy.brood) return;
	enemy.brood.health -= damage;
	if (enemy.brood.health <= 0) { delete enemy.brood; enemy.broodBlockedUntil = game.time + 3; }
}
export function stepWasp(game: Game, enemy: Extract<Enemy, { variant: "parasitoidWasp" }>, dt: number, bounds: Bounds) {
	const state = enemy.state;
	state.remaining = Math.max(0, state.remaining - dt); state.seekRemaining -= dt;
	const reserved = game.enemies.reduce((count, bug) => count + (bug.health > 0 ? bug.variant === "larva" ? 1 : bug.brood ? BROOD_COUNT : 0 : 0), 0);
	let host = game.enemies.find(bug => bug.id === state.targetId && canImplant(bug, game.time));
	if (reserved + BROOD_COUNT > MAX_LARVAE) { host = undefined; state.targetId = null; }
	if (reserved + BROOD_COUNT <= MAX_LARVAE && (!host || state.seekRemaining <= 0) && state.remaining === 0) {
		let nearest = Infinity; host = undefined;
		for (const candidate of game.enemies) {
			if (!canImplant(candidate, game.time)) continue;
			const distance = Math.hypot(candidate.x - enemy.x, candidate.y - enemy.y);
			if (distance < nearest) { nearest = distance; host = candidate; }
		}
		state.targetId = host?.id ?? null; state.seekRemaining = .4;
	}
	if (state.remaining > 0 || !host) {
		// Circle the mech while recovering or awaiting a suitable host.
		const angle = enemy.id * 2.39996 + game.time * .4;
		walkBugTo(enemy, { x: game.player.x + Math.cos(angle) * 200, y: game.player.y + Math.sin(angle) * 200 }, dt, bounds); return;
	}
	walkBugTo(enemy, host, dt, bounds);
	if (Math.hypot(host.x - enemy.x, host.y - enemy.y) <= BUG_SPECS[host.variant].radius + 18) {
		host.brood = { age: 0, health: 2, owner: enemy.id };
		state.targetId = null; state.remaining = 2.5;
	}
}

export function resolveAntExplosions(game: Game, playerRadius: number) {
	// Iterative passes resolve each ant once, including any killed earlier in this step.
	let pending = true;
	while (pending) {
		pending = false;
		for (const enemy of game.enemies) {
			if (enemy.variant !== "explodingAnt" || enemy.health > 0 || enemy.state.detonated) continue;
			enemy.state.detonated = true; pending = true;
			game.explosions.push({ id: game.nextId++, x: enemy.x, y: enemy.y, radius: ANT_RADIUS, bornAt: game.time });
			if (Math.hypot(game.player.x - enemy.x, game.player.y - enemy.y) <= ANT_RADIUS + playerRadius) hurtPlayer(game, 30);
			for (const other of game.enemies) {
				if (other.health > 0 && (other.variant === "centipede" ? [other, ...other.state.segments] : [other]).some(point => Math.hypot(point.x - enemy.x, point.y - enemy.y) <= ANT_RADIUS + BUG_SPECS[other.variant].radius)) damageEnemy(game, other, other.variant === "explodingAnt" ? other.health : 8);
			}
			if (enemy.lightTarget && Math.hypot(cornerPosition(enemy.lightTarget).x - enemy.x, cornerPosition(enemy.lightTarget).y - enemy.y) <= ANT_RADIUS + LAMP_RADIUS) damageLamp(game, enemy.lightTarget, 30);
		}
	}
}
export function stepBroods(game: Game, dt: number, bounds: Bounds) {
	// Newly hatched larvae never become hosts and cannot hatch again in this pass.
	for (const host of game.enemies) {
		if (host.health <= 0 || !host.brood) continue;
		host.brood.age += dt;
		if (host.brood.age < BROOD_TIME) continue;
		delete host.brood; host.health = 0;
		for (let i = 0; i < BROOD_COUNT; i++) {
			const angle = i * Math.PI * 2 / BROOD_COUNT;
			game.enemies.push(createBug({ variant: "larva", id: game.nextId++, position: { x: host.x + Math.cos(angle) * 20, y: host.y + Math.sin(angle) * 20 }, player: game.player, threat: game.hive?.threat ?? 1, wave: game.wave, time: game.time, bounds }));
		}
	}
}
