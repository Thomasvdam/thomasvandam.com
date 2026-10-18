import { combatTarget } from "./light-threats";
import { walkBugTo } from "./bug-motion";
import { BUG_SPECS, type Enemy } from "./bug-types";
import type { Game } from "./game";
import { distanceToSegment, type Vector, type Bounds } from "./math";

export const ACID_RADIUS = 5;
export const ACID_SPEED = 300;
export const ACID_WINDUP = .55;
export const ACID_LIFETIME = 2.2;
type Spitter = Extract<Enemy, { variant: "spitter" }>;
const distance = (a: Vector, b: Vector) => Math.hypot(a.x - b.x, a.y - b.y);

export function acidLineClear(from: Vector, to: Vector, enemies: Enemy[], owner: number) {
	return !enemies.some(enemy => enemy.variant === "armoured" && enemy.id !== owner && enemy.health > 0 && distanceToSegment(enemy, from, to) <= BUG_SPECS.armoured.radius + ACID_RADIUS + 2);
}
function coverPoint(armour: Enemy, player: Vector, bounds: Bounds): Vector | null {
	const length = distance(armour, player);
	if (length < 1) return null;
	const point = { x: armour.x + (armour.x - player.x) / length * 90, y: armour.y + (armour.y - player.y) / length * 90 };
	const radius = BUG_SPECS.spitter.radius;
	return point.x >= radius && point.x <= bounds.width - radius && point.y >= radius && point.y <= bounds.height - radius && distance(point, player) >= 190 && distance(point, player) <= 440 ? point : null;
}
function walkTo(enemy: Spitter, target: Vector, dt: number, bounds: Bounds) {
	const length = distance(enemy, target), travel = Math.min(length, enemy.speed * dt), radius = BUG_SPECS.spitter.radius;
	if (!length) return;
	const x = Math.max(radius, Math.min(bounds.width - radius, enemy.x + (target.x - enemy.x) / length * travel));
	const y = Math.max(radius, Math.min(bounds.height - radius, enemy.y + (target.y - enemy.y) / length * travel));
	enemy.walkDistance += Math.hypot(x - enemy.x, y - enemy.y); enemy.x = x; enemy.y = y;
}
export function stepAcidSpitter(game: Game, enemy: Spitter, dt: number, bounds: Bounds) {
	const state = enemy.state, player = combatTarget(game, enemy);
	state.remaining = Math.max(0, state.remaining - dt);
	if (state.phase === "windup") {
		enemy.angle = Math.atan2(state.target.y - enemy.y, state.target.x - enemy.x);
		if (state.remaining === 0) {
			if (acidLineClear(enemy, state.target, game.enemies, enemy.id) && game.acid.length < 64) {
				game.acid.push({ id: game.nextId++, lightTarget: enemy.attackLight, owner: enemy.id, x: enemy.x, y: enemy.y, vx: Math.cos(enemy.angle) * ACID_SPEED, vy: Math.sin(enemy.angle) * ACID_SPEED, life: ACID_LIFETIME });
				state.phase = "cover"; state.remaining = 1.6;
			} else { state.phase = "peek"; state.remaining = .2; }
		}
		return;
	}
	const range = distance(enemy, player), angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
	enemy.angle = angle;
	let cover: { armour: Enemy; point: Vector } | undefined, bestScore = Infinity;
	for (const armour of game.enemies) {
		if (armour.variant !== "armoured" || armour.health <= 0) continue;
		const point = coverPoint(armour, player, bounds);
		if (!point) continue;
		const score = distance(enemy, point) - (armour.id === state.coverId ? 50 : 0);
		if (score < bestScore) { cover = { armour, point }; bestScore = score; }
	} state.coverId = cover?.armour.id ?? null;
	if (range < 170) {
		walkTo(enemy, { x: enemy.x - Math.cos(angle) * 100, y: enemy.y - Math.sin(angle) * 100 }, dt, bounds);
		state.phase = "cover";
		return;
	}
	if (cover && state.phase === "cover") {
		walkTo(enemy, cover.point, dt, bounds);
		if (distance(enemy, cover.point) <= 12 && state.remaining === 0) state.phase = "peek";
		return;
	}
	if (!cover) {
		const direction = range < 240 ? -1 : range > 330 ? 1 : 0;
		walkTo(enemy, { x: enemy.x + Math.cos(angle) * direction * 100, y: enemy.y + Math.sin(angle) * direction * 100 }, dt, bounds);
	}
	if (state.remaining === 0 && range <= 440 && acidLineClear(enemy, player, game.enemies, enemy.id)) {
		state.phase = "windup"; state.remaining = ACID_WINDUP; state.target = { x: player.x, y: player.y }; enemy.attackLight = enemy.lightTarget;
		return;
	}
	if (cover) {
		const point = cover.point, length = distance(cover.armour, player), nx = (cover.armour.x - player.x) / length, ny = (cover.armour.y - player.y) / length;
		const radius = BUG_SPECS.spitter.radius;
		const flanks = [state.side, -state.side].map(side => ({ side, point: { x: Math.max(radius, Math.min(bounds.width - radius, point.x - ny * side * 110)), y: Math.max(radius, Math.min(bounds.height - radius, point.y + nx * side * 110)) } }));
		const flank = flanks.find(candidate => acidLineClear(candidate.point, player, game.enemies, enemy.id)) ?? flanks[0];
		state.side = flank.side; walkTo(enemy, flank.point, dt, bounds);
	} else if (!acidLineClear(enemy, player, game.enemies, enemy.id)) {
		// Without armour, sidestep armour that obstructs the firing lane.
		walkTo(enemy, { x: enemy.x - Math.sin(angle) * state.side * 100, y: enemy.y + Math.cos(angle) * state.side * 100 }, dt, bounds);
	}
}

export function stepBulletAnt(game: Game, enemy: Extract<Enemy, { variant: "bulletAnt" }>, dt: number, bounds: Bounds) {
	const state = enemy.state, player = combatTarget(game, enemy);
	state.remaining = Math.max(0, state.remaining - dt);
	if (state.phase === "windup") {
		enemy.angle = Math.atan2(state.target.y - enemy.y, state.target.x - enemy.x);
		if (state.remaining === 0) {
			if (acidLineClear(enemy, state.target, game.enemies, enemy.id) && game.acid.length < 64) {
				game.acid.push({ id: game.nextId++, lightTarget: enemy.attackLight, owner: enemy.id, x: enemy.x, y: enemy.y, vx: Math.cos(enemy.angle) * ACID_SPEED, vy: Math.sin(enemy.angle) * ACID_SPEED, life: ACID_LIFETIME });
			}
			state.phase = "chase"; state.remaining = 1.6;
		}
		return;
	}
	const range = Math.hypot(player.x - enemy.x, player.y - enemy.y), angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
	const direction = range < 240 ? -1 : range > 330 ? 1 : 0;
	walkBugTo(enemy, { x: enemy.x + Math.cos(angle) * direction * 100, y: enemy.y + Math.sin(angle) * direction * 100 }, dt, bounds);
	enemy.angle = angle;
	if (state.remaining === 0 && range <= 440 && acidLineClear(enemy, player, game.enemies, enemy.id)) {
		state.phase = "windup"; state.remaining = ACID_WINDUP; state.target = { x: player.x, y: player.y }; enemy.attackLight = enemy.lightTarget;
	} else if (!acidLineClear(enemy, player, game.enemies, enemy.id)) {
		const side = enemy.id % 2 ? 1 : -1;
		walkBugTo(enemy, { x: enemy.x - Math.sin(angle) * side * 100, y: enemy.y + Math.cos(angle) * side * 100 }, dt, bounds);
	}
}
