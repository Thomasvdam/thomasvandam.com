import { moveBug, walkBugTo } from "./bug-motion";
import { BUG_SPECS, type BugVariant, type Enemy } from "./bug-types";
import { FIELD, type Game } from "./game";
import { CORNER_LIGHTS, type CornerLight } from "./lighting";
import { clamp, distanceToSegment, type Bounds, type Vector } from "./math";

export const LAMP_HEALTH = 60;
export const LAMP_RADIUS = 12;
export const MOTH_SWARM_SIZE = 6;
export const MOTHS_TO_BLOCK = 4;
export const MECH_LIGHTS = ["front", "rearLeft", "rearRight"] as const;
export type LightId = CornerLight | typeof MECH_LIGHTS[number];
export const emptyLightCover = (): Record<LightId, number> => ({ front: 0, rearLeft: 0, rearRight: 0, northWest: 0, northEast: 0, southWest: 0, southEast: 0 });
const cornerPositions = new Map<CornerLight, Vector>();
export const cornerPosition = (id: CornerLight): Vector => {
	const cached = cornerPositions.get(id); if (cached) return cached;
	const corner = CORNER_LIGHTS.find(corner => corner.id === id)!;
	const point = { x: corner.right ? FIELD.width - 16 : 16, y: corner.bottom ? FIELD.height - 16 : 16 };
	cornerPositions.set(id, point); return point;
};
export function lightPosition(game: Game, id: LightId): Vector {
	if (!MECH_LIGHTS.includes(id as typeof MECH_LIGHTS[number])) return cornerPosition(id as CornerLight);
	const forward = id === "front" ? 20 : -14, side = id === "front" ? 0 : id === "rearLeft" ? -10 : 10;
	const cos = Math.cos(game.player.angle), sin = Math.sin(game.player.angle);
	return { x: game.player.x + forward * cos - side * sin, y: game.player.y + forward * sin + side * cos };
}
export const lightExists = (game: Game, id: LightId) => MECH_LIGHTS.includes(id as typeof MECH_LIGHTS[number]) || game.parts.cornerLights[id as CornerLight];
export const lightTransmission = (game: Game, id: LightId) => clamp(1 - game.lightCover[id] / MOTHS_TO_BLOCK, 0, 1);
export function refreshLightCover(game: Game) {
	game.lightCover = emptyLightCover();
	for (const moth of game.enemies) if (moth.variant === "moth" && moth.health > 0 && moth.state.light !== null && lightExists(game, moth.state.light)) {
		const source = lightPosition(game, moth.state.light);
		if (Math.hypot(moth.x - source.x, moth.y - source.y) <= 50) game.lightCover[moth.state.light]++;
	}
}
export function stepMoth(game: Game, moth: Extract<Enemy, { variant: "moth" }>, dt: number, bounds: Bounds) {
	moth.state.seekRemaining -= dt;
	const current = moth.state.light === null ? null : lightPosition(game, moth.state.light);
	if (moth.state.light === null || !lightExists(game, moth.state.light) || (moth.state.seekRemaining <= 0 && current && Math.hypot(moth.x - current.x, moth.y - current.y) > 70)) {
		moth.state.seekRemaining = .4;
		let nearest = Infinity; moth.state.light = null;
		for (const id of [...MECH_LIGHTS, ...CORNER_LIGHTS.map(corner => corner.id)]) {
			if (!lightExists(game, id) || lightTransmission(game, id) === 0) continue;
			const source = lightPosition(game, id), distance = Math.hypot(source.x - moth.x, source.y - moth.y);
			if (distance < nearest) { nearest = distance; moth.state.light = id; }
		}
	}
	if (moth.state.light === null) {
		const angle = moth.id * 2.39996 + game.time;
		moveBug(moth, { x: Math.cos(angle), y: Math.sin(angle) }, moth.speed * dt * .3, bounds); return;
	}
	const source = lightPosition(game, moth.state.light), angle = moth.id * 2.39996 + game.time * 3.5;
	const radius = 16 + moth.id % 3 * 5;
	walkBugTo(moth, { x: source.x + Math.cos(angle) * radius, y: source.y + Math.sin(angle) * radius }, dt, bounds);
}

const excludedAttackers = new Set<BugVariant>(["moth", "queen", "worker", "egg", "slug", "antlion", "centipede"]);
export const canAttackLights = (variant: BugVariant) => !excludedAttackers.has(variant);
export function lightSensitiveChance(cleared: number, threat: number) {
	return cleared < 4 ? 0 : Math.min(.45, .1 + (cleared - 4) * .025 + Math.max(0, threat - cleared - 1) * .04);
}
export function assignLightTrait(game: Game, enemy: Enemy) {
	const chance = game.debug ? game.debug.lightSensitivePercent / 100 : lightSensitiveChance(game.hivesCleared, game.hive?.threat ?? 1);
	let hash = (game.runSeed ^ Math.imul(enemy.id, 2654435761)) >>> 0;
	hash = Math.imul(hash ^ hash >>> 16, 2246822507) >>> 0;
	if (canAttackLights(enemy.variant) && hash / 4294967296 < chance) enemy.lightSensitive = true;
}
export function chooseLightTarget(game: Game, enemy: Enemy) {
	if (!enemy.lightSensitive || !canAttackLights(enemy.variant)) { enemy.lightTarget = null; return; }
	if (enemy.lightTarget && game.parts.cornerLights[enemy.lightTarget]) return;
	let nearest = Infinity; enemy.lightTarget = null;
	for (const corner of CORNER_LIGHTS) if (game.parts.cornerLights[corner.id]) {
		const point = cornerPosition(corner.id), distance = Math.hypot(point.x - enemy.x, point.y - enemy.y);
		if (distance < nearest) { nearest = distance; enemy.lightTarget = corner.id; }
	}
}
export const combatTarget = (game: Game, enemy: Enemy): Vector => enemy.lightTarget && game.parts.cornerLights[enemy.lightTarget] ? cornerPosition(enemy.lightTarget) : game.player;
export function damageLamp(game: Game, id: CornerLight, damage: number) {
	if (!game.parts.cornerLights[id] || damage <= 0) return;
	game.lampHealth[id] = Math.max(0, game.lampHealth[id] - damage);
	if (game.lampHealth[id] === 0) game.parts.cornerLights[id] = false;
}
export function contactLamp(game: Game, enemy: Enemy, previous: Vector, charging: boolean) {
	const id = enemy.lightTarget;
	if (!id || !game.parts.cornerLights[id] || game.time < (enemy.lampHitAt ?? -Infinity) + .9) return;
	if ((enemy.variant === "lunger" || enemy.variant === "dragonfly") && !charging) return;
	if (distanceToSegment(cornerPosition(id), previous, enemy) > LAMP_RADIUS + BUG_SPECS[enemy.variant].radius) return;
	damageLamp(game, id, charging ? 30 : 20); enemy.lampHitAt = game.time;
}
