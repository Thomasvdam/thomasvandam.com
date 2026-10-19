import { bugRig, bugPose, resolveRig, speciesPose, type ResolvedPart } from "./animation";
import { bugSkin } from "./sprite-parts";
import { clickElevation } from "./specialists";
import { ACID_WINDUP } from "./acid";
import { combatTarget } from "./light-threats";
import { BUG_SPECS, type BugVariant, type Enemy } from "./bug-types";
import { walkBugTo } from "./bug-motion";
import type { Game } from "./game";
import { angleDifference, type Bounds, type Vector } from "./math";

export const DEATH_ANIMATION_TIME = .35;
export const CORPSE_LIFETIME = 60;
export const CORPSE_BURN_TIME = 1.2;
export const BACKPACK_LIMIT = 5;
export const CARAPACE_HEALTH = 2;
export type Carapace = { id: number; variant: BugVariant; health: number; burnAt?: number };
export type DeathFrame = { parts: ResolvedPart[]; tails: ResolvedPart[][]; elevation: number; stretchX: number; stretchY: number };
export type BugRemains = Vector & { death?: DeathFrame; id: number; variant: BugVariant; angle: number; diedAt: number; segments: Vector[]; burnAt?: number };
export function corpseAlive(remains: BugRemains, time: number) {
	return time - remains.diedAt < CORPSE_LIFETIME && (remains.burnAt === undefined || time - remains.burnAt < CORPSE_BURN_TIME);
}
export const dying = (remains: BugRemains, time: number) => !!remains.death && time - remains.diedAt < DEATH_ANIMATION_TIME;
export function leaveCorpse(game: Game, enemy: Enemy) {
	const skin = bugSkin(enemy.variant, enemy.id), state = { distance: enemy.walkDistance, angle: 0, time: game.time, rolling: enemy.variant === "beetle", spitCharge: (enemy.variant === "spitter" || enemy.variant === "bulletAnt") && enemy.state.phase === "windup" ? 1 - enemy.state.remaining / ACID_WINDUP : 0 };
	let stretchX = 1, stretchY = 1;
	if (enemy.variant === "lunger" && enemy.state.phase === "windup") { stretchX = .85; stretchY = 1.12; }
	if (enemy.variant === "clickBeetle" && enemy.state.phase === "windup") { stretchX = .85; stretchY = 1.16; }
	if (enemy.variant === "explodingAnt" && enemy.state.phase === "charge") stretchX = stretchY = 1 + Math.sin(game.time * 32) * .09;
	const death: DeathFrame = {
		parts: resolveRig(bugRig(enemy.variant), skin, speciesPose(enemy.variant, state)),
		tails: enemy.variant === "centipede" ? enemy.state.segments.map((_, index) => resolveRig(bugRig(enemy.variant), { ...skin, head: undefined }, bugPose({ ...state, distance: enemy.walkDistance - index * 9 }))) : [],
		elevation: clickElevation(enemy), stretchX, stretchY,
	};
	game.remains.push({ death, id: enemy.id, x: enemy.x, y: enemy.y, variant: enemy.variant, angle: enemy.angle, diedAt: game.time, segments: enemy.variant === "centipede" ? enemy.state.segments.map(segment => ({ ...segment })) : [], ...(enemy.burnt ? { burnAt: game.time } : {}) });
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
