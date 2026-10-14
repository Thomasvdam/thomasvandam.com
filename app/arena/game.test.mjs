import { expect, test } from "bun:test";
import { chooseUpgrade, ENEMY_RADIUS, FIELD, newGame, PLAYER_RADIUS, SPAWN_WARNING_TIME, start, step, togglePause, waveSize, xpNeeded } from "./game";
import { cameraFor, screenToWorld } from "./camera";
import { viewFromGame } from "./runtime";

const idle = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: false };
function advance(game, seconds, input = idle) { for (let i = 0; i < Math.round(seconds * 120); i++) step(game, input, 1 / 120); }
function enemy(game, props = {}) { const result = { id: game.nextId++, x: game.player.x + 60, y: game.player.y, health: 1, maxHealth: 1, speed: 0, variant: "burrower", angle: 0, walkDistance: 0, bornAt: -10, hitAt: -10, ...props }; game.enemies.push(result); return result; }

test("movement has equal diagonal speed and respects the fixed arena on every side", () => {
	const game = newGame(); start(game); game.toSpawn = 1; game.spawnTimer = 1000; const initial = { ...game.player };
	advance(game, 1, { ...idle, move: { x: 1, y: 1 } });
	expect(Math.hypot(game.player.x - initial.x, game.player.y - initial.y)).toBeCloseTo(game.speed, 5);
	advance(game, 10, { ...idle, move: { x: 1, y: 1 } });
	expect(game.player.x).toBe(FIELD.width - PLAYER_RADIUS); expect(game.player.y).toBe(FIELD.height - PLAYER_RADIUS);
	game.enemies = []; advance(game, 10, { ...idle, move: { x: -1, y: -1 } });
	expect(game.player.x).toBe(PLAYER_RADIUS); expect(game.player.y).toBe(PLAYER_RADIUS);
});

test("manual aim controls shots; neutral aim retains direction and projectiles expire", () => {
	const game = newGame(); start(game);
	step(game, { ...idle, aim: { x: 1, y: 0 }, fire: true }, 1 / 120);
	expect(game.player.angle).toBe(0); expect(game.bullets[0].vx).toBe(640); expect(game.bullets[0].vy).toBe(0);
	advance(game, .3, { ...idle, fire: true }); expect(game.bullets.length).toBe(2); expect(game.player.angle).toBe(0);
	advance(game, 2); expect(game.bullets).toHaveLength(0);
});

test("swept shots kill, drop XP, and armored enemies require enough damage", () => {
	const game = newGame(); start(game); enemy(game, { x: 100, y: 100, health: 2, maxHealth: 2 });
	game.bullets.push({ id: 100, x: 60, y: 100, vx: 2400, vy: 0, damage: 1, life: 1 });
	step(game, idle, 1 / 30); expect(game.enemies[0].health).toBe(1); expect(game.kills).toBe(0);
	game.bullets.push({ id: 101, x: 60, y: 100, vx: 2400, vy: 0, damage: 1, life: 1 });
	step(game, idle, 1 / 30); expect(game.enemies).toHaveLength(0); expect(game.kills).toBe(1); expect(game.pickups[0].value).toBe(1);
});

test("level-up freezes the complete simulation and preserves excess XP across multiple choices", () => {
	const game = newGame(); start(game);
	game.pickups.push({ id: 100, x: game.player.x, y: game.player.y, value: xpNeeded(1) + xpNeeded(2) + 2 });
	step(game, idle, 1 / 120); expect(game.mode).toBe("upgrade"); expect(game.level).toBe(2);
	const frozen = JSON.stringify(game); advance(game, 3, { ...idle, move: { x: 1, y: 1 }, fire: true }); expect(JSON.stringify(game)).toBe(frozen);
	chooseUpgrade(game, "damage"); expect(game.damage).toBe(2); expect(game.mode).toBe("upgrade"); expect(game.level).toBe(3);
	chooseUpgrade(game, "fireRate"); expect(game.shotInterval).toBeCloseTo(.17); expect(game.mode).toBe("playing"); expect(game.xp).toBe(2);
	chooseUpgrade(game, "speed"); expect(game.speed).toBe(220); // No upgrade without a pending choice.
	game.mode = "upgrade"; chooseUpgrade(game, "speed"); expect(game.speed).toBe(245);
});

test("waves finish only after all spawns and enemies; the next starts automatically and collects remaining XP", () => {
	const game = newGame(); start(game); game.toSpawn = 1; game.spawnTimer = 100;
	step(game, idle, 1 / 120); expect(game.intermission).toBe(0);
	game.toSpawn = 0; const last = enemy(game, { x: 100, y: 100 });
	step(game, idle, 1 / 120); expect(game.intermission).toBe(0);
	last.health = 0; step(game, idle, 1 / 120); expect(game.intermission).toBe(3);
	const remaining = game.intermission; togglePause(game); advance(game, 10); expect(game.intermission).toBe(remaining);
	togglePause(game); advance(game, 3.1); expect(game.wave).toBe(2); expect(game.toSpawn).toBe(waveSize(2)); expect(game.pickups).toHaveLength(0); expect(game.xp).toBe(1);
});

test("contact damage has invulnerability, death freezes play, and a fresh run resets progression", () => {
	const game = newGame(); start(game); enemy(game, { x: game.player.x, y: game.player.y });
	step(game, idle, 1 / 120); expect(game.player.health).toBe(80);
	advance(game, .5); expect(game.player.health).toBe(80);
	advance(game, 4); expect(game.mode).toBe("dead"); expect(game.player.health).toBe(0);
	const ended = JSON.stringify(game); advance(game, 2); expect(JSON.stringify(game)).toBe(ended);
	const reset = newGame(); expect(reset.mode).toBe("ready"); expect(reset.kills).toBe(0); expect(reset.xp).toBe(0); expect(reset.upgrades).toEqual({ damage: 0, fireRate: 0, speed: 0 });
});

test("spawn warnings are stationary, harmless, and last the full delay before an enemy can hit", () => {
	const game = newGame(200); start(game); game.toSpawn = 1; game.spawnTimer = 0;
	step(game, idle, 1 / 120); expect(game.enemies).toHaveLength(0); expect(game.spawns).toHaveLength(1);
	expect(viewFromGame(game).enemies).toBe(1);
	const warning = { ...game.spawns[0] }; Object.assign(game.player, { x: warning.x, y: warning.y });
	advance(game, SPAWN_WARNING_TIME - 1 / 120);
	expect(game.player.health).toBe(100); expect(game.enemies).toHaveLength(0); expect(game.intermission).toBe(0);
	expect(game.spawns[0].x).toBe(warning.x); expect(game.spawns[0].y).toBe(warning.y);
	advance(game, 2 / 120); expect(game.spawns).toHaveLength(0); expect(game.enemies[0].id).toBe(warning.id); expect(game.player.health).toBe(80);
});

test("spawn warnings freeze during pauses and upgrade choices", () => {
	const game = newGame(); start(game); game.spawnTimer = 0; step(game, idle, 1 / 120);
	togglePause(game); const paused = JSON.stringify(game); advance(game, 4); expect(JSON.stringify(game)).toBe(paused);
	togglePause(game); game.mode = "upgrade"; const upgrading = JSON.stringify(game); advance(game, 4); expect(JSON.stringify(game)).toBe(upgrading);
	chooseUpgrade(game, "damage"); advance(game, .5); expect(game.enemies).toHaveLength(0); expect(game.spawns[0].remaining).toBeCloseTo(SPAWN_WARNING_TIME - .5);
});

test("arena-wide spawn warnings fit inside bounds and may appear directly on the player", () => {
	const game = newGame(200); start(game); game.spawnTimer = 0;
	step(game, idle, 1 / 120); const warning = game.spawns[0];
	expect(warning.x).toBeGreaterThanOrEqual(ENEMY_RADIUS); expect(warning.x).toBeLessThanOrEqual(FIELD.width - ENEMY_RADIUS);
	expect(warning.y).toBeGreaterThanOrEqual(ENEMY_RADIUS); expect(warning.y).toBeLessThanOrEqual(FIELD.height - ENEMY_RADIUS);
	const matching = newGame(200); start(matching); matching.spawnTimer = 0;
	Object.assign(matching.player, { x: warning.x, y: warning.y }); step(matching, idle, 1 / 120);
	expect(matching.spawns[0].x).toBe(warning.x); expect(matching.spawns[0].y).toBe(warning.y); expect(matching.player.health).toBe(100);
});

test("pending spawn warnings prevent a wave clear and global XP attraction", () => {
	const game = newGame(); start(game); game.toSpawn = 0;
	game.spawns.push({ id: 100, x: 100, y: 100, remaining: 2, variant: "burrower" });
	game.pickups.push({ id: 101, x: 50, y: 50, value: 1 });
	step(game, idle, 1 / 120); expect(game.intermission).toBe(0); expect(game.pickups[0].attracted).toBeFalsy(); expect(game.pickups[0].x).toBe(50);
});

test("each group of three spawn warnings pressures the player's position even in a corner", () => {
	for (const position of [{ x: PLAYER_RADIUS, y: PLAYER_RADIUS }, { x: FIELD.width - PLAYER_RADIUS, y: FIELD.height - PLAYER_RADIUS }, { x: 560, y: 360 }]) {
		const game = newGame(200); start(game); Object.assign(game.player, position);
		for (let i = 0; i < 3; i++) { game.spawnTimer = 0; step(game, idle, 1 / 120); }
		expect(game.spawns).toHaveLength(3); const nearby = game.spawns[2];
		expect(Math.hypot(nearby.x - position.x, nearby.y - position.y)).toBeLessThanOrEqual(92);
		expect(nearby.x).toBeGreaterThanOrEqual(ENEMY_RADIUS); expect(nearby.x).toBeLessThanOrEqual(FIELD.width - ENEMY_RADIUS);
		expect(nearby.y).toBeGreaterThanOrEqual(ENEMY_RADIUS); expect(nearby.y).toBeLessThanOrEqual(FIELD.height - ENEMY_RADIUS);
	}
});

test("moving away from a warning avoids the hit when the enemy appears", () => {
	const game = newGame(); start(game); game.toSpawn = 0;
	game.spawns.push({ id: 100, x: game.player.x, y: game.player.y, remaining: SPAWN_WARNING_TIME, variant: "burrower" });
	advance(game, SPAWN_WARNING_TIME + .1, { ...idle, move: { x: 1, y: 0 } });
	expect(game.enemies).toHaveLength(1); expect(game.player.health).toBe(100); expect(game.player.x).toBeGreaterThan(game.enemies[0].x + 100);
});

test("clearing a wave attracts all distant XP immediately and conserves its value through a level-up pause", () => {
	const game = newGame(); start(game); game.toSpawn = 0;
	Object.assign(game.player, { x: 20, y: 20 });
	game.pickups.push({ id: 100, x: 1100, y: 700, value: 2 }, { id: 101, x: 1000, y: 600, value: 3 }, { id: 102, x: 20, y: 700, value: 2 });
	enemy(game, { health: 0, x: 1000, y: 700 });
	step(game, idle, 1 / 120); expect(game.intermission).toBe(3); expect(game.pickups.every(drop => drop.attracted)).toBe(true);
	expect(game.pickups[0].x).toBeLessThan(1100); expect(game.pickups[2].y).toBeLessThan(700);
	advance(game, 2); expect(game.mode).toBe("upgrade");
	const conserved = game.xp + xpNeeded(1) + game.pickups.reduce((sum, drop) => sum + drop.value, 0); expect(conserved).toBe(8);
	const frozen = JSON.stringify(game); advance(game, 2); expect(JSON.stringify(game)).toBe(frozen);
	chooseUpgrade(game, "speed"); advance(game, 2); expect(game.pickups).toHaveLength(0); expect(game.xp).toBe(2); expect(game.wave).toBe(2);
});

test("wave-clear attraction stays attached to pickups across wave transitions and resets on a fresh run", () => {
	const game = newGame(); start(game); game.toSpawn = 0; game.intermission = .01;
	game.pickups.push({ id: 100, x: 20, y: 20, value: 1, attracted: true });
	const before = game.pickups[0].x; advance(game, .1);
	expect(game.wave).toBe(2); expect(game.pickups[0].attracted).toBe(true); expect(game.pickups[0].x).toBeGreaterThan(before);
	expect(newGame().spawns).toHaveLength(0); expect(newGame().pickups).toHaveLength(0);
});

test("XP attraction conserves values and accumulated drops stay bounded", () => {
	const game = newGame(); start(game);
	for (let i = 0; i < 512; i++) game.pickups.push({ id: game.nextId++, x: 100, y: 100, value: 1 });
	enemy(game, { health: 0, x: 100, y: 100 }); step(game, idle, 1 / 120);
	expect(game.pickups).toHaveLength(512); expect(game.pickups.reduce((sum, drop) => sum + drop.value, 0)).toBe(513);
	game.pickups = [{ id: 2000, x: game.player.x + 80, y: game.player.y, value: 2 }];
	advance(game, .5); expect(game.pickups).toHaveLength(0); expect(game.xp).toBe(2);
});

test("camera follows only the axes that do not fit, clamps at edges, and projects mouse aim", () => {
	const player = { x: 560, y: 360 };
	const wide = cameraFor(player, 1280, 800); expect(wide.x).toBe(0); expect(wide.y).toBe(0); expect(wide.offsetX).toBe(80); expect(wide.offsetY).toBe(40);
	expect(screenToWorld({ x: 640, y: 400 }, wide)).toEqual(player);
	const narrow = cameraFor(player, 360, 500); expect(narrow.x).toBe(380); expect(narrow.y).toBe(110);
	expect(screenToWorld({ x: 180, y: 250 }, narrow)).toEqual(player);
	const mixed = cameraFor(player, 1280, 500); expect(mixed.x).toBe(0); expect(mixed.y).toBe(110);
	const edge = cameraFor({ x: 1110, y: 710 }, 360, 500); expect(edge.x).toBe(760); expect(edge.y).toBe(220);
});
