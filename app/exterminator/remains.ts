import { combatTarget } from "./light-threats";
import { BUG_SPECS, type BugVariant, type Enemy } from "./bug-types";
import { walkBugTo } from "./bug-motion";
import type { Game } from "./game";
import { angleDifference, type Bounds, type Vector } from "./math";

export const CORPSE_LIFETIME = 60;
export const CORPSE_BURN_TIME = 1.2;
export const BACKPACK_LIMIT = 5;
export const CARAPACE_HEALTH = 2;
export type Carapace = { id: number; variant: BugVariant; health: number; burnAt?: number };
export type BugRemains = Vector & { id: number; variant: BugVariant; angle: number; diedAt: number; segments: Vector[]; burnAt?: number };
export function corpseAlive(remains: BugRemains, time: number) {
	return time - remains.diedAt < CORPSE_LIFETIME && (remains.burnAt === undefined || time - remains.burnAt < CORPSE_BURN_TIME);
}
export function leaveCorpse(game: Game, enemy: Enemy) {
	game.remains.push({ id: enemy.id, x: enemy.x, y: enemy.y, variant: enemy.variant, angle: enemy.angle, diedAt: game.time, segments: enemy.variant === "centipede" ? enemy.state.segments.map(segment => ({ ...segment })) : [], ...(enemy.burnt ? { burnAt: game.time } : {}) });
}
export function inFlame(point: Vector, radius: number, origin: Vector, angle: number, range: number, halfAngle: number) {
	const dx = point.x - origin.x, dy = point.y - origin.y, distance = Math.hypot(dx, dy);
	return distance <= range + radius && (distance <= radius || Math.abs(angleDifference(Math.atan2(dy, dx), angle)) <= halfAngle + Math.asin(Math.min(1, radius / distance)));
}
export function burnRemains(game: Game, origin: Vector, angle: number, range: number, halfAngle: number) {
	for (const remains of game.remains) if (remains.burnAt === undefined && [remains, ...remains.segments].some(point => inFlame(point, BUG_SPECS[remains.variant].radius, origin, angle, range, halfAngle))) remains.burnAt = game.time;
}
export function absorbBackpack(enemy: Enemy, damage: number, time: number, flame = false) {
	if (enemy.variant !== "assassin") return damage;
	if (flame) { for (const plate of enemy.state.backpack) plate.burnAt ??= time; return damage; }
	while (damage > 0 && enemy.state.backpack.length > 0) {
		const plate = enemy.state.backpack[enemy.state.backpack.length - 1], absorbed = Math.min(damage, plate.health);
		damage -= absorbed; plate.health -= absorbed;
		if (plate.health <= 0) enemy.state.backpack.pop();
	}
	return damage;
}
export function stepAssassin(game: Game, enemy: Extract<Enemy, { variant: "assassin" }>, dt: number, bounds: Bounds) {
	const state = enemy.state;
	state.backpack = state.backpack.filter(plate => plate.burnAt === undefined || game.time - plate.burnAt < CORPSE_BURN_TIME);
	state.seekRemaining -= dt;
	let target = state.targetId === null ? undefined : game.remains.find(remains => remains.id === state.targetId && remains.burnAt === undefined);
	if (state.backpack.length >= BACKPACK_LIMIT) { target = undefined; state.targetId = null; }
	else if (!target || state.seekRemaining <= 0) {
		let nearest = 360 ** 2; target = undefined;
		for (const remains of game.remains) {
			if (remains.burnAt !== undefined || !corpseAlive(remains, game.time)) continue;
			const distance = (remains.x - enemy.x) ** 2 + (remains.y - enemy.y) ** 2;
			if (distance < nearest) { nearest = distance; target = remains; }
		}
		state.targetId = target?.id ?? null; state.seekRemaining = .4;
	}
	const destination = target ?? combatTarget(game, enemy);
	enemy.angle = Math.atan2(destination.y - enemy.y, destination.x - enemy.x);
	walkBugTo(enemy, destination, dt, bounds);
	if (target && Math.hypot(enemy.x - target.x, enemy.y - target.y) <= BUG_SPECS.assassin.radius + 12) {
		state.backpack.push({ id: target.id, variant: target.variant, health: CARAPACE_HEALTH });
		game.remains = game.remains.filter(remains => remains !== target); state.targetId = null;
	}
}
