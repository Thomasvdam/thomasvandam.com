import { QUEEN_LAY_INTERVAL, BUG_CLEARANCE, BUG_SPECS, createBug, type AntVariant, type Enemy, type WanderState } from "./bug-types";
import { moveBug, walkBugTo } from "./bug-motion";
import type { Game } from "./game";
import { distanceToSegment, type Bounds, type Vector } from "./math";

export const SLIME_LIFETIME = 15;
export const SLIME_INTERVAL = .25;
export const SLIME_RADIUS = 17;
export const SLIME_SPEED_FACTOR = .5;
export { QUEEN_LAY_INTERVAL } from "./bug-types";
export const EGG_HATCH_TIME = 4;
export const COLONY_LIMIT = 12;
export const ANT_BROOD: readonly AntVariant[] = ["worker", "soldier", "bulletAnt"];
export type Slime = Vector & { end: Vector; bornAt: number };
type Queen = Extract<Enemy, { variant: "queen" }>;
type ColonyMember = Extract<Enemy, { variant: "worker" | "soldier" | "bulletAnt" | "egg" }>;
type Colony = { queen: Queen | null; population: number; workers: Extract<Enemy, { variant: "worker" }>[]; eggs: Extract<Enemy, { variant: "egg" }>[] };

export function slimeSpeedFactor(game: Game, radius: number) {
	return game.slime.some(trail => game.time - trail.bornAt < SLIME_LIFETIME && distanceToSegment(game.player, trail, trail.end) <= SLIME_RADIUS + radius) ? SLIME_SPEED_FACTOR : 1;
}
function wander(enemy: Enemy, state: WanderState, dt: number, bounds: Bounds) {
	state.remaining -= dt;
	if (state.remaining <= 0) {
		state.seed = (Math.imul(state.seed, 1664525) + 1013904223) >>> 0;
		state.direction += (state.seed / 4294967296 - .5) * Math.PI * 1.5;
		state.remaining = 1 + state.seed / 4294967296 * 2;
	}
	const travel = moveBug(enemy, { x: Math.cos(state.direction), y: Math.sin(state.direction) }, enemy.speed * dt, bounds);
	if (travel < enemy.speed * dt * .5) { state.direction += Math.PI * .6; state.remaining = .4; }
	enemy.angle = state.direction;
}
export function stepSlug(game: Game, enemy: Extract<Enemy, { variant: "slug" }>, dt: number, bounds: Bounds) {
	wander(enemy, enemy.state, dt, bounds);
	enemy.state.trailRemaining -= dt;
	if (enemy.state.trailRemaining <= 0) {
		game.slime.push({ ...enemy.state.trailFrom, end: { x: enemy.x, y: enemy.y }, bornAt: game.time });
		enemy.state.trailFrom = { x: enemy.x, y: enemy.y };
		enemy.state.trailRemaining += SLIME_INTERVAL;
	}
}
export function colonyIndex(enemies: Enemy[]) {
	const colonies = new Map<number, Colony>();
	const group = (id: number) => {
		let colony = colonies.get(id);
		if (!colony) { colony = { queen: null, population: 0, workers: [], eggs: [] }; colonies.set(id, colony); }
		return colony;
	};
	for (const enemy of enemies) {
		if (enemy.health <= 0) continue;
		if (enemy.variant === "queen") group(enemy.id).queen = enemy;
		else if ((enemy.variant === "worker" || enemy.variant === "soldier" || enemy.variant === "bulletAnt" || enemy.variant === "egg") && enemy.state.queenId !== null) {
			const colony = group(enemy.state.queenId); colony.population++;
			if (enemy.variant === "worker") colony.workers.push(enemy);
			if (enemy.variant === "egg") colony.eggs.push(enemy);
		}
	}
	return colonies;
}
function colonyBug(game: Game, variant: AntVariant | "egg", position: Vector, queenId: number | null, bounds: Bounds, id = game.nextId++): ColonyMember {
	const enemy = createBug({ variant, id, position, player: game.player, threat: game.hive?.threat ?? 1, wave: game.wave, time: game.time, bounds }) as ColonyMember;
	enemy.state.queenId = queenId;
	return enemy;
}
export function spawnQueenGuards(game: Game, queen: Queen, bounds: Bounds) {
	const angle = Math.atan2(game.player.y - queen.y, game.player.x - queen.x);
	for (const side of [-1, 1]) {
		const position = { x: queen.x + Math.cos(angle) * 48 - Math.sin(angle) * side * 24, y: queen.y + Math.sin(angle) * 48 + Math.cos(angle) * side * 24 };
		game.enemies.push(colonyBug(game, "worker", position, queen.id, bounds));
	}
}
export function stepQueen(game: Game, queen: Queen, colony: Colony, dt: number, bounds: Bounds) {
	const dx = queen.x - game.player.x, dy = queen.y - game.player.y, distance = Math.hypot(dx, dy);
	// Keep away from the mech, with a tangential route around the arena walls.
	if (distance < 340) {
		const angle = distance ? Math.atan2(dy, dx) : queen.angle;
		const radius = BUG_SPECS.queen.radius, side = queen.id % 2 ? 1 : -1;
		const directions = [angle, angle + side * Math.PI / 3, angle - side * Math.PI / 3, angle + side * Math.PI / 2, angle - side * Math.PI / 2];
		const heading = directions.find(direction => {
			const x = queen.x + Math.cos(direction) * 35, y = queen.y + Math.sin(direction) * 35;
			return x >= radius && y >= radius && x <= bounds.width - radius && y <= bounds.height - radius;
		}) ?? angle + Math.PI;
		queen.angle = heading; moveBug(queen, { x: Math.cos(heading), y: Math.sin(heading) }, queen.speed * dt, bounds);
	}
	queen.state.layRemaining = Math.max(0, queen.state.layRemaining - dt);
	if (queen.state.layRemaining === 0 && colony.population < COLONY_LIMIT) {
		const angle = queen.angle + Math.PI, egg = colonyBug(game, "egg", { x: queen.x + Math.cos(angle) * 34, y: queen.y + Math.sin(angle) * 34 }, queen.id, bounds);
		if (egg.variant === "egg") { egg.state.hatchVariant = ANT_BROOD[queen.state.broodIndex % ANT_BROOD.length]; colony.eggs.push(egg); }
		game.enemies.push(egg); colony.population++; queen.state.broodIndex++; queen.state.layRemaining = QUEEN_LAY_INTERVAL;
	}
}
export function stepWorker(game: Game, worker: Extract<Enemy, { variant: "worker" }>, colony: Colony | undefined, dt: number, bounds: Bounds) {
	const protect = colony?.queen ?? colony?.eggs.find(egg => egg.health > 0);
	if (!protect) { wander(worker, worker.state, dt, bounds); return; }
	const angle = Math.atan2(game.player.y - protect.y, game.player.x - protect.x), slot = colony!.workers.indexOf(worker);
	// Spread the guards across the line of fire instead of piling up on the queen.
	const lateral = (slot - (colony!.workers.length - 1) / 2) * (BUG_SPECS.worker.radius * 2 + BUG_CLEARANCE + 1);
	walkBugTo(worker, { x: protect.x + Math.cos(angle) * 52 - Math.sin(angle) * lateral, y: protect.y + Math.sin(angle) * 52 + Math.cos(angle) * lateral }, dt, bounds);
	worker.angle = angle;
}
export function hatchEgg(game: Game, egg: Extract<Enemy, { variant: "egg" }>, bounds: Bounds): Enemy {
	if (game.time - egg.bornAt < EGG_HATCH_TIME) return egg;
	return colonyBug(game, egg.state.hatchVariant, egg, egg.state.queenId, bounds, egg.id);
}
