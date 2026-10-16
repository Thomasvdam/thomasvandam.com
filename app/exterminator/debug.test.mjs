import { expect, test } from "bun:test";
import { BUG_TYPES, defaultComposition, setDebug, spawnDebugWave } from "./debug";
import { chooseHive, newGame, start, step } from "./game";
const idle = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: false };
function advance(game, seconds) { for (let i = 0; i < seconds * 120; i++) step(game, idle, 1 / 120); }
function setup() { const game = newGame(47); setDebug(game, true); start(game); chooseHive(game, game.hives[0].id); game.player.invulnerable = 100; return game; }

test("debug deployment and empty/cleared waves wait indefinitely without automatic progression or payment", () => {
	const game = setup(); advance(game, 10); expect(game.enemies).toHaveLength(0); expect(game.toSpawn).toBe(0); expect(game.wave).toBe(1); expect(game.intermission).toBe(0);
	spawnDebugWave(game, { ...defaultComposition(), burrower: 1 }); advance(game, 2); expect(game.enemies).toHaveLength(1);
	game.enemies[0].health = 0; advance(game, 10); expect(game.mode).toBe("playing"); expect(game.wave).toBe(1); expect(game.money).toBe(0); expect(game.intermission).toBe(0);
});

test("custom composition uses exact counts and normal harmless spawn warnings, including locked specialists", () => {
	const game = setup(), composition = Object.fromEntries(BUG_TYPES.map(type => [type, 1]));
	spawnDebugWave(game, composition); step(game, idle, 1 / 120); expect(game.spawns).toHaveLength(1); expect(game.enemies).toHaveLength(0);
	advance(game, 8); expect(game.toSpawn).toBe(0); expect(game.spawns).toHaveLength(0);
	for (const type of BUG_TYPES) expect(game.enemies.filter(enemy => enemy.variant === type)).toHaveLength(1);
});

test("spawning a new debug wave replaces old actors, projectiles and effects, preserves the mech, and works while paused", () => {
	const game = setup(); spawnDebugWave(game, defaultComposition()); advance(game, 2); game.player.health = 65; game.mode = "paused";
	game.acid.push({ id: 99 }); game.bullets.push({ id: 99 }); game.lobs.push({ id: 99 }); game.remains.push({ id: 99 });
	spawnDebugWave(game, { ...defaultComposition(), burrower: 0, armoured: 2, spitter: 3 });
	expect(game.debug.queue).toEqual(["armoured", "armoured", "spitter", "spitter", "spitter"]); expect(game.toSpawn).toBe(5); expect(game.wave).toBe(2); expect(game.mode).toBe("paused"); expect(game.player.health).toBe(65);
	for (const field of ["enemies", "spawns", "acid", "bullets", "lobs", "remains"]) expect(game[field]).toHaveLength(0);
	const frozen = JSON.stringify(game); advance(game, 1); expect(JSON.stringify(game)).toBe(frozen);
});

test("debug actions reject invalid counts and cannot affect normal play", () => {
	const game = setup();
	for (const count of [-1, 101, NaN, Infinity, .5]) { const before = JSON.stringify(game); spawnDebugWave(game, { ...defaultComposition(), burrower: count }); expect(JSON.stringify(game)).toBe(before); }
	for (const composition of [{ ...defaultComposition(), burrower: 0 }, { ...defaultComposition(), burrower: 60, flyer: 60 }]) { const before = JSON.stringify(game); spawnDebugWave(game, composition); expect(JSON.stringify(game)).toBe(before); }
	setDebug(game, false); expect(game.debug).toBeNull(); const before = JSON.stringify(game); spawnDebugWave(game, defaultComposition()); expect(JSON.stringify(game)).toBe(before);
	advance(game, 3.1); expect(game.wave).toBe(2); expect(game.toSpawn).toBeGreaterThan(0);
	expect(newGame().debug).toBeNull();
});
