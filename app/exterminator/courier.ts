import { moveBug } from "./bug-motion";
import { createBug, type Enemy } from "./bug-types";
import { FIELD, WAVES_PER_HIVE, type Game } from "./game";
import { lightAt } from "./lighting";
import { clamp, type Bounds, type Vector } from "./math";
import { normalizeSchematics, schematicForHive } from "./schematics";

const hidingScore = (game: Game, point: Vector) => Math.hypot(point.x - game.player.x, point.y - game.player.y) - lightAt(game, point.x, point.y) * 650;
export function beginSchematicHunt(game: Game) {
	game.lastSchematic = null; game.carriedSchematic = null;
	game.schematicReward = game.debug ? null : schematicForHive(game.runSeed, game.hivesCleared, game.schematics);
	if (game.schematicReward === null) return;
	const positions = [
		{ x: 70, y: 70 }, { x: FIELD.width - 70, y: 70 }, { x: 70, y: FIELD.height - 70 }, { x: FIELD.width - 70, y: FIELD.height - 70 },
		{ x: FIELD.width / 2, y: 65 }, { x: FIELD.width / 2, y: FIELD.height - 65 }, { x: 65, y: FIELD.height / 2 }, { x: FIELD.width - 65, y: FIELD.height / 2 },
	];
	const offset = (game.runSeed + game.hivesCleared) % positions.length;
	const candidates = [...positions.slice(offset), ...positions.slice(0, offset)];
	candidates.sort((a, b) => hidingScore(game, b) - hidingScore(game, a));
	const courier = createBug({ variant: "courier", id: game.nextId++, position: candidates[0], player: game.player, threat: 1, wave: 1, time: game.time, bounds: FIELD });
	if (courier.variant === "courier") courier.state.schematic = game.schematicReward;
	game.enemies.push(courier);
}
export function stepCourier(game: Game, courier: Extract<Enemy, { variant: "courier" }>, dt: number, bounds: Bounds) {
	const state = courier.state;
	state.seekRemaining -= dt;
	if (state.seekRemaining <= 0) {
		state.seekRemaining = .3;
		let best = hidingScore(game, courier); state.destination = { x: courier.x, y: courier.y };
		for (let i = 0; i < 24; i++) {
			const angle = i * Math.PI / 12 + courier.id * .3, radius = i % 2 ? 180 : 95;
			const point = { x: clamp(courier.x + Math.cos(angle) * radius, 14, bounds.width - 14), y: clamp(courier.y + Math.sin(angle) * radius, 14, bounds.height - 14) };
			const score = hidingScore(game, point) - Math.hypot(point.x - courier.x, point.y - courier.y) * .1;
			if (score > best) { best = score; state.destination = point; }
		}
	}
	const dx = state.destination.x - courier.x, dy = state.destination.y - courier.y, distance = Math.hypot(dx, dy);
	if (distance > .1) {
		courier.angle = Math.atan2(dy, dx);
		moveBug(courier, { x: dx / distance, y: dy / distance }, Math.min(distance, courier.speed * dt), bounds);
	}
}
export function extractSchematic(game: Game) {
	if (game.mode !== "playing" || !game.hive || game.wave !== WAVES_PER_HIVE || game.intermission > 0) return;
	if (game.carriedSchematic !== null && !game.debug) {
		game.schematics = normalizeSchematics([...game.schematics, game.carriedSchematic]);
		game.lastSchematic = game.carriedSchematic;
	}
}
