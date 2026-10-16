import { expect, test } from "bun:test";
import { BEETLE_BLAST_RADIUS, BEETLE_FLIGHT_TIME, BEETLE_ROLL_TIME, BUG_SPECS, bugForSpawn, createBug } from "./bugs";
import { chooseHive, FIELD, newGame, PLAYER_RADIUS, start, step } from "./game";
const idle = { move: { x: 0, y: 0 }, aim: { x: 1, y: 0 }, fire: false };
function setup() {
	const game = newGame(47); start(game); chooseHive(game, game.hives[0].id);
	game.toSpawn = 1; game.spawnTimer = 1000; game.terrain.fill("firm");
	return game;
}
function bug(game, variant = "beetle", x = 840, y = 360) {
	const enemy = createBug({ variant, id: game.nextId++, position: { x, y }, player: game.player, threat: 1, wave: 1, time: game.time, bounds: FIELD });
	game.enemies.push(enemy); return enemy;
}
function advance(game, seconds, input = idle) { for (let i = 0; i < Math.round(seconds * 120); i++) step(game, input, 1 / 120); }
function lob(game, target = game.player, age = 0) { game.lobs.push({ id: game.nextId++, x: 800, y: 360, target: { x: target.x, y: target.y }, age }); }

test("centipedes close distance faster while retaining their existing movement barrier", () => {
	const game = setup(), enemy = bug(game, "centipede", 900);
	expect(BUG_SPECS.centipede.speed).toBe(104); expect(enemy.speed).toBe(112);
	advance(game, .5); expect(enemy.walkDistance - 12).toBeCloseTo(56); expect(enemy.state.segments).toHaveLength(7); expect(game.player.health).toBe(100);
});

test("beetles retreat nearby, approach from far away, and hold their preferred throwing range", () => {
	for (const [x, direction] of [[700, 1], [1000, -1], [840, 0]]) {
		const game = setup(), enemy = bug(game, "beetle", x); advance(game, .25);
		expect(Math.sign(enemy.x - x)).toBe(direction); expect(game.lobs).toHaveLength(0);
	}
});

test("beetles visibly prepare a ball before throwing and commit to a fixed landing spot", () => {
	const game = setup(), enemy = bug(game); advance(game, .5);
	expect(enemy.state.phase).toBe("roll"); expect(enemy.state.remaining).toBeCloseTo(BEETLE_ROLL_TIME - .5);
	advance(game, .4); expect(game.lobs).toHaveLength(0); expect(enemy.x).toBe(840);
	advance(game, .2); expect(game.lobs).toHaveLength(1); expect(enemy.state.phase).toBe("roll");
	const target = { ...game.lobs[0].target }; advance(game, .4, { ...idle, move: { x: 0, y: 1 } });
	expect(game.lobs[0].target).toEqual(target); expect(game.player.y).toBeGreaterThan(target.y); expect(game.lobs).toHaveLength(1);
});

test("lobs deal area damage once on landing, including the edge of the mech footprint", () => {
	for (const offset of [0, BEETLE_BLAST_RADIUS + PLAYER_RADIUS - 1, BEETLE_BLAST_RADIUS + PLAYER_RADIUS + 1]) {
		const game = setup(); const enemy = bug(game); enemy.state.remaining = 100; lob(game, { x: game.player.x + offset, y: game.player.y });
		advance(game, BEETLE_FLIGHT_TIME - .05); expect(game.player.health).toBe(100);
		advance(game, .1); expect(game.player.health).toBe(offset > BEETLE_BLAST_RADIUS + PLAYER_RADIUS ? 100 : 80);
		const health = game.player.health; advance(game, .3); expect(game.player.health).toBe(health); expect(game.lobs).toHaveLength(0);
	}
});

test("players can leave the marked landing area during flight; simultaneous impacts respect invulnerability", () => {
	const dodged = setup(); bug(dodged); lob(dodged); advance(dodged, 1, { ...idle, move: { x: 0, y: 1 } }); expect(dodged.player.health).toBe(100);
	const hit = setup(); bug(hit); lob(hit); lob(hit); advance(hit, 1); expect(hit.player.health).toBe(80);
});

test("lobs freeze with the game, can kill, and disappear on wave clear or restart", () => {
	const game = setup(), enemy = bug(game); lob(game); game.mode = "paused";
	const frozen = JSON.stringify(game); advance(game, 2); expect(JSON.stringify(game)).toBe(frozen);
	game.mode = "playing"; game.player.health = 20; advance(game, 1); expect(game.mode).toBe("dead");
	const dead = JSON.stringify(game); advance(game, 2); expect(JSON.stringify(game)).toBe(dead); expect(newGame().lobs).toEqual([]);
	game.mode = "playing"; game.player.health = 100; game.player.invulnerable = 0; enemy.health = 0; game.toSpawn = 0;
	lob(game, game.player, BEETLE_FLIGHT_TIME - .001); step(game, idle, 1 / 30);
	expect(game.player.health).toBe(100); expect(game.lobs).toHaveLength(0); expect(game.intermission).toBe(3);
});

test("a released ball survives its thrower's death until the wave clears, but a dead beetle cannot throw", () => {
	const game = setup(), enemy = bug(game);
	enemy.state.phase = "roll"; enemy.state.remaining = .001; step(game, idle, 1 / 120); expect(game.lobs).toHaveLength(1);
	enemy.health = 0; advance(game, 1); expect(game.player.health).toBe(80);
	const other = setup(), dead = bug(other); dead.state.phase = "roll"; dead.state.remaining = .001; dead.health = 0;
	step(other, idle, 1 / 120); expect(other.lobs).toHaveLength(0);
});

test("beetles unlock on job three and remain in the specialist rotation thereafter", () => {
	for (let cleared = 0; cleared < 7; cleared++) {
		const variants = Array.from({ length: 60 }, (_, i) => bugForSpawn(cleared, 1, i));
		expect(variants.includes("beetle")).toBe(cleared >= 2);
	}
});


test("beetles prepare while out of range and release a ready ball immediately on entering range", () => {
	const game = setup(), enemy = bug(game, "beetle", 1050); enemy.speed = 0;
	advance(game, BEETLE_ROLL_TIME + .2); expect(enemy.state.phase).toBe("ready"); expect(game.lobs).toHaveLength(0);
	enemy.x = game.player.x + 350; step(game, idle, 1 / 120);
	expect(game.lobs).toHaveLength(1); expect(enemy.state.phase).toBe("roll"); expect(enemy.state.remaining).toBe(BEETLE_ROLL_TIME);
	advance(game, .5); expect(enemy.state.remaining).toBeCloseTo(BEETLE_ROLL_TIME - .5);
});
