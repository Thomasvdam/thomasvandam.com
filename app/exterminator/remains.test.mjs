import { expect, test } from "bun:test";
import { BUG_TYPES, createBug } from "./bug-types";
import { FIELD, newGame, start, chooseHive, step, togglePause, clearCombat } from "./game";
import { absorbBackpack, burnRemains, CORPSE_BURN_TIME, corpseAlive, leaveCorpse, stepAssassin } from "./remains";
import { createRemainsLayer } from "./remains-renderer";
const idle = { move: { x: 0, y: 0 }, aim: { x: 1, y: 0 }, fire: false }, dt = 1 / 120;
function setup() { const game = newGame(47); start(game); chooseHive(game, game.hives[0].id); game.toSpawn = 1; game.spawnTimer = 10000; game.player.invulnerable = 10000; game.player.x = 200; game.player.y = 360; return game; }
function bug(game, variant, x = 800, y = 360) { const enemy = createBug({ variant, id: game.nextId++, position: { x, y }, player: game.player, threat: 1, wave: 1, time: game.time, bounds: FIELD }); game.enemies.push(enemy); return enemy; }
function corpse(game, variant = "burrower", x = 500, y = 360) { const dead = createBug({ variant, id: game.nextId++, position: { x, y }, player: game.player, threat: 1, wave: 1, time: 0, bounds: FIELD }); leaveCorpse(game, dead); return game.remains.at(-1); }
function advance(game, seconds, input = idle) { for (let i = 0; i < Math.round(seconds * 120); i++) step(game, input, dt); }
function shoot(game, weapon = "cannon", damage = 1) { game.bullets.push({ id: game.nextId++, x: 250, y: 360, vx: 12000, vy: 0, damage, life: 1, weapon, blastRadius: weapon === "rpg" ? 65 : 0 }); }

test("every bug leaves remains with stable appearance and geometry, no early population cap, and sixty-second expiry", () => {
	const game = setup();
	for (const type of BUG_TYPES) bug(game, type).health = 0;
	step(game, idle, dt); expect(game.remains).toHaveLength(BUG_TYPES.length);
	expect(game.remains.find(body => body.variant === "centipede").segments).toHaveLength(7);
	for (let i = 0; i < 100; i++) corpse(game); expect(game.remains.length).toBeGreaterThan(100);
	const first = game.remains[0]; expect(corpseAlive(first, first.diedAt + 59.99)).toBe(true); expect(corpseAlive(first, first.diedAt + 60)).toBe(false);
	game.time += 60; step(game, idle, dt); expect(game.remains).toEqual([]);
});

test("corpses are harmless ground decorations and allow movement and shots through them", () => {
	const game = setup(); game.terrain.fill("firm"); corpse(game, "centipede", 200); corpse(game, "armoured", 250); game.player.invulnerable = 0;
	const target = bug(game, "burrower", 320); target.speed = 0; shoot(game, "cannon", 10); step(game, { ...idle, move: { x: 1, y: 0 } }, dt);
	expect(game.player.x).toBeGreaterThan(200); expect(game.player.health).toBe(100); expect(game.enemies).not.toContain(target); expect(game.remains).toHaveLength(3);
});

test("flame kills leave a briefly burning corpse, ignition is not refreshed, and distant remains survive", () => {
	const game = setup(); game.weapon = "flamethrower"; const enemy = bug(game, "burrower", 280); enemy.health = .01; const old = corpse(game, "armoured", 290), far = corpse(game, "slug", 900);
	step(game, { ...idle, fire: true }, dt); const fresh = game.remains.find(body => body.id === enemy.id);
	expect(fresh).toBeDefined(); expect(fresh.burnAt).toBe(game.time); expect(old.burnAt).toBe(game.time); expect(far.burnAt).toBeUndefined();
	const ignition = old.burnAt; advance(game, .5, { ...idle, fire: true }); expect(old.burnAt).toBe(ignition); expect(game.remains).toContain(fresh);
	advance(game, 1); expect(game.remains).not.toContain(fresh); expect(game.remains).not.toContain(old); expect(game.remains).toContain(far);
});

test("assassins seek nearby corpses, consume each once, cap at five, then chase the player", () => {
	const game = setup(), assassin = bug(game, "assassin", 700), other = bug(game, "assassin", 700); other.speed = 0;
	const first = corpse(game, "flyer", 675); stepAssassin(game, assassin, dt, FIELD); stepAssassin(game, other, dt, FIELD);
	expect(assassin.state.backpack).toEqual([{ id: first.id, variant: "flyer", health: 2 }]); expect(other.state.backpack).toEqual([]); expect(game.remains).not.toContain(first);
	for (let i = 0; i < 6; i++) { corpse(game, "burrower", assassin.x, assassin.y); stepAssassin(game, assassin, dt, FIELD); }
	expect(assassin.state.backpack).toHaveLength(5); expect(game.remains).toHaveLength(2);
	const before = assassin.x; stepAssassin(game, assassin, .1, FIELD); expect(assassin.x).toBeLessThan(before);
});

test("assassins ignore burning and distant bodies, replace consumed targets, and melee without armour", () => {
	const game = setup(), a = bug(game, "assassin", 500), burning = corpse(game, "burrower", 520); burning.burnAt = 0; corpse(game, "burrower", 1000);
	const before = a.x; stepAssassin(game, a, .1, FIELD); expect(a.x).toBeLessThan(before); expect(a.state.backpack).toEqual([]);
	a.x = 230; game.player.invulnerable = 0; advance(game, .5); expect(game.player.health).toBe(90);
});

test("armour loses partial health, breaks in order, and passes excess damage to health", () => {
	const game = setup(), a = bug(game, "assassin"); a.state.backpack = [1, 2].map(id => ({ id, variant: "flyer", health: 2 }));
	expect(absorbBackpack(a, .75, 0)).toBe(0); expect(a.state.backpack[1].health).toBe(1.25);
	expect(absorbBackpack(a, 2, 0)).toBe(0); expect(a.state.backpack).toHaveLength(1); expect(a.state.backpack[0].health).toBe(1.25);
	expect(absorbBackpack(a, 4, 0)).toBe(2.75); expect(a.state.backpack).toEqual([]);
	for (const weapon of ["cannon", "shotgun", "rpg"]) {
		const actual = setup(), target = bug(actual, "assassin", 320); target.speed = 0; target.state.backpack = [{ id: 99, variant: "flyer", health: 2 }];
		shoot(actual, weapon, 3); step(actual, idle, dt); expect(target.health).toBe(target.maxHealth - 1); expect(target.state.backpack).toEqual([]);
	}
});

test("flame bypasses and burns all collected plates; collection freezes decay and broken plates never return", () => {
	const game = setup(), a = bug(game, "assassin", 280); a.speed = 0; a.state.backpack = [{ id: 99, variant: "armoured", health: 2 }]; game.weapon = "flamethrower";
	step(game, { ...idle, fire: true }, dt); const plate = a.state.backpack[0]; expect(a.health).toBeLessThan(a.maxHealth); expect(plate.burnAt).toBe(game.time);
	advance(game, CORPSE_BURN_TIME + .1); expect(a.state.backpack).toEqual([]); expect(game.remains).toEqual([]);
	const body = corpse(game, "flyer", 280); game.time = body.diedAt + 59; stepAssassin(game, a, dt, FIELD); expect(a.state.backpack).toHaveLength(1);
	game.time += 100; stepAssassin(game, a, dt, FIELD); expect(a.state.backpack).toHaveLength(1); absorbBackpack(a, 2, game.time); expect(game.remains).toEqual([]);
});

test("pause freezes corpses, burning and armour; waves preserve them, base/debug replacement clear them", () => {
	const game = setup(), a = bug(game, "assassin"); corpse(game); a.state.backpack = [{ id: 99, variant: "flyer", health: 2, burnAt: game.time }];
	togglePause(game); const before = JSON.stringify(game); advance(game, 10); expect(JSON.stringify(game)).toBe(before); togglePause(game);
	a.health = 0; game.toSpawn = 0; step(game, idle, dt); expect(game.intermission).toBe(3); advance(game, 3.1); expect(game.wave).toBe(2); expect(game.remains.length).toBeGreaterThan(0);
	clearCombat(game); expect(game.remains).toEqual([]);
	corpse(game); game.wave = 3; game.toSpawn = 0; game.spawns = []; game.intermission = .001; step(game, idle, dt); expect(game.mode).toBe("base"); expect(game.remains).toEqual([]);
});

test("ground cache reuses unchanged corpses and invalidates on collection, ignition, replacement and clock reset", () => {
	let clears = 0;
	let canvases = 0; const layer = createRemainsLayer(() => ({ getContext: () => { const first = canvases++ === 0; return new Proxy({ globalAlpha: 1, clearRect: () => { if (first) clears++; } }, { get: (target, key) => key in target ? target[key] : () => {} }); } })), sprites = new Proxy({}, { get: (_, key) => key }); const game = setup(), body = corpse(game);
	layer(game, sprites); const first = clears; game.player.x += 10; layer(game, sprites); expect(clears).toBe(first);
	burnRemains(game, { x: 470, y: 360 }, 0, 100, .5); layer(game, sprites); expect(clears).toBe(first + 1);
	game.remains = []; layer(game, sprites); expect(clears).toBe(first + 2);
	game.remains = [{ ...body }]; layer(game, sprites); expect(clears).toBe(first + 3);
	game.time = 2; layer(game, sprites); game.time = 0; layer(game, sprites); expect(clears).toBe(first + 5);
});
