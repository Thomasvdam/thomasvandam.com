import { expect, test } from "bun:test";
import { createBug } from "./bug-types";
import { FIELD, newGame, start, chooseHive, step, togglePause, clearCombat } from "./game";
import { MOVEMENT } from "./terrain";
import { segmentHitTime } from "./math";
import { preparePulls, provokeBombardier, stepBombardier, stepDragonfly, spiderCover, stepSpider, stepBolas, firstTetherHit, blastTethers, flameTethers } from "./predators";
const idle = { move: { x: 0, y: 0 }, aim: { x: 1, y: 0 }, fire: false }, dt = 1 / 120;
function setup() { const game = newGame(47); start(game); chooseHive(game, game.hives[0].id); game.toSpawn = 1; game.spawnTimer = 10000; game.player.invulnerable = 10000; game.player.x = 400; game.player.y = 360; return game; }
function bug(game, variant, x = 800, y = 360, terrain = "firm") { const enemy = createBug({ variant, id: game.nextId++, position: { x, y }, player: game.player, threat: 1, wave: 1, time: game.time, bounds: FIELD, terrain }); game.enemies.push(enemy); return enemy; }
function attach(game, enemy) { game.tethers.push({ owner: enemy.id, remaining: 6 }); }
function advance(game, seconds, input = idle) { for (let i = 0; i < Math.round(seconds * 120); i++) step(game, input, dt); }

test("pits retain their burrow tile across their radius, strengthen inward, and vanish on death", () => {
	const game = setup(); game.terrain.fill("mud"); game.spawns.push({ id: game.nextId++, x: 500, y: 360, remaining: .001, variant: "antlion" }); step(game, idle, dt);
	const lion = game.enemies[0]; expect(lion.state.terrain).toBe("mud"); game.terrain.fill("firm");
	game.player.x = 340; const edge = preparePulls(game, dt); expect(edge.terrain).toBe("mud"); game.player.x = 450; const centre = preparePulls(game, dt); expect(centre.force.x).toBeGreaterThan(edge.force.x);
	game.player.x = 500; expect(preparePulls(game, dt).terrain).toBe("mud"); game.player.x = 320; expect(preparePulls(game, dt).terrain).toBe(null);
	lion.health = 0; game.player.x = 450; expect(preparePulls(game, dt).force).toEqual({ x: 0, y: 0 });
});

test("opposing movement uses each pit's terrain handling and the suitable undercarriage escapes its centre", () => {
	for (const terrain of ["firm", "rubble", "mud"]) {
		const results = {};
		for (const gear of ["wheels", "legs", "treads"]) {
			const game = setup(); game.terrain.fill("firm"); game.undercarriage = gear; const lion = bug(game, "antlion", 390, 360, terrain);
			const pull = preparePulls(game, dt).force.x; step(game, { ...idle, move: { x: 1, y: 0 } }, dt); const moved = game.player.x - 400;
			results[gear] = moved; expect(game.pitTerrain).toBe(terrain); expect(lion.x).toBe(390);
			// Infer controlled movement after subtracting suction, checking terrain ratios.
			const baseline = setup(); baseline.undercarriage = gear; baseline.terrain.fill("firm"); step(baseline, { ...idle, move: { x: 1, y: 0 } }, dt);
			expect(moved - pull * dt).toBeCloseTo((baseline.player.x - 400) * MOVEMENT[gear][terrain] / MOVEMENT[gear].firm, 7);
		}
		const best = { firm: "wheels", rubble: "legs", mud: "treads" }[terrain]; expect(results[best]).toBeGreaterThan(0);
		for (const gear of Object.keys(results)) if (gear !== best) expect(results[best]).toBeGreaterThan(results[gear]);
	}
	const game = setup(); bug(game, "antlion", 460); const one = preparePulls(game, dt).force.x; bug(game, "antlion", 460); expect(preparePulls(game, dt).force.x).toBeCloseTo(one);
	game.player.invulnerable = 0; game.player.x = 460; step(game, idle, dt); expect(game.player.health).toBe(90);
});

test("bombardiers retaliate only after surviving damage, telegraph a locked cone, and recover before reacting again", () => {
	const game = setup(), enemy = bug(game, "bombardier", 500); enemy.speed = 0; game.player.invulnerable = 0;
	stepBombardier(game, enemy, .1, FIELD, 14); expect(enemy.state.phase).toBe("chase"); provokeBombardier(game, enemy); const direction = enemy.state.direction;
	game.player.y = 650; provokeBombardier(game, enemy); expect(enemy.state.direction).toBe(direction);
	stepBombardier(game, enemy, .75, FIELD, 14); expect(game.player.health).toBe(100); expect(enemy.state.phase).toBe("spray");
	stepBombardier(game, enemy, .1, FIELD, 14); expect(game.player.health).toBe(100); game.player.y = 360;
	stepBombardier(game, enemy, .1, FIELD, 14); expect(game.player.health).toBe(90); stepBombardier(game, enemy, .3, FIELD, 14); expect(enemy.state.phase).toBe("recover");
	provokeBombardier(game, enemy); expect(enemy.state.phase).toBe("recover"); stepBombardier(game, enemy, 2.3, FIELD, 14); expect(enemy.state.phase).toBe("chase");
	enemy.health = 0; provokeBombardier(game, enemy); expect(enemy.state.phase).toBe("chase");
	const actual = setup(), beetle = bug(actual, "bombardier", 500); actual.bullets.push({ id: actual.nextId++, x: 460, y: 360, vx: 12000, vy: 0, damage: 1, life: 1, weapon: "cannon", blastRadius: 0 }); step(actual, idle, dt); expect(beetle.state.phase).toBe("windup");
});

test("dragonflies lock an intercept prediction, miss changed direction, and detect fast swept contact", () => {
	const game = setup(), fly = bug(game, "dragonfly", 750); fly.speed = 0; fly.state.remaining = 0; game.playerVelocity = { x: 100, y: 0 };
	stepDragonfly(game, fly, dt, FIELD, 14); expect(fly.state.phase).toBe("windup"); expect(fly.state.target).toEqual({ x: 465, y: 360 });
	game.player.y = 500; game.playerVelocity.y = 200; stepDragonfly(game, fly, .6, FIELD, 14); expect(fly.state.target).toEqual({ x: 465, y: 360 });
	stepDragonfly(game, fly, 1, FIELD, 14); expect(fly.state.contact).toBe(false); expect(fly.state.phase).toBe("recover"); expect(fly.x).toBe(465);
	fly.x = 700; fly.y = 500; fly.state.phase = "intercept"; fly.state.target = { x: 200, y: 500 }; stepDragonfly(game, fly, 1, FIELD, 14); expect(fly.state.contact).toBe(true);
});

test("spiders seek cover behind other bugs, telegraph locked aim, and throw through their cover", () => {
	const game = setup(), spider = bug(game, "bolasSpider", 900), guard = bug(game, "armoured", 600); guard.speed = 0;
	const cover = spiderCover(game, spider, FIELD); expect(cover.id).toBe(guard.id); expect(cover.point.x).toBeGreaterThan(guard.x);
	spider.state.cooldown = 0; stepSpider(game, spider, dt, FIELD); expect(spider.state.phase).toBe("windup"); const target = { ...spider.state.target };
	stepSpider(game, spider, .9, FIELD); expect(game.bolas).toHaveLength(1); expect(spider.state.target).toEqual(target);
	stepBolas(game, 1.3, new Map([[spider.id, spider]]), 14); expect(game.bolas).toHaveLength(0); expect(game.tethers).toHaveLength(1); expect(guard.health).toBe(guard.maxHealth);
});

test("multiple tethers attach without damage, add pull, allow opposing movement, and release independently", () => {
	const game = setup(), a = bug(game, "bolasSpider", 800), b = bug(game, "bolasSpider", 900); const spiders = new Map([[a.id, a], [b.id, b]]);
	for (const enemy of [a, b]) game.bolas.push({ id: game.nextId++, owner: enemy.id, x: 500, y: 360, vx: -420, vy: 0, life: 2 });
	stepBolas(game, .3, spiders, 14); expect(game.tethers).toHaveLength(2); expect(game.player.health).toBe(100); expect(preparePulls(game, dt).force.x).toBe(260);
	game.undercarriage = "wheels"; game.terrain.fill("firm"); step(game, { ...idle, move: { x: -1, y: 0 } }, dt); expect(game.player.x).toBeLessThan(400);
	a.health = 0; expect(Math.hypot(...Object.values(preparePulls(game, dt).force))).toBeCloseTo(130); expect(game.tethers.map(t => t.owner)).toEqual([b.id]);
	b.x = game.player.x + 761; preparePulls(game, dt); expect(game.tethers).toHaveLength(0);
	b.x = 800; attach(game, b); game.tethers[0].remaining = .001; preparePulls(game, dt); expect(game.tethers).toHaveLength(0);
});

test("cannon, shotgun, RPG, and flames sever tethers; individual strands and earlier bug hits resolve correctly", () => {
	for (const weapon of ["cannon", "shotgun", "rpg", "flamethrower"]) {
		const game = setup(), a = bug(game, "bolasSpider", 800), b = bug(game, "bolasSpider", 100, 360); attach(game, a); attach(game, b);
		if (weapon === "flamethrower") { game.weapon = weapon; step(game, { ...idle, fire: true }, dt); }
		else { game.bullets.push({ id: game.nextId++, x: 420, y: 360, vx: 12000, vy: 0, damage: 1, life: 1, weapon, blastRadius: weapon === "rpg" ? 60 : 0 }); step(game, idle, dt); }
		expect(game.tethers.map(t => t.owner)).toEqual([b.id]); expect(a.health).toBe(a.maxHealth);
	}
	const game = setup(), spider = bug(game, "bolasSpider", 800); attach(game, spider); const guard = bug(game, "armoured", 520); guard.speed = 0;
	game.bullets.push({ id: game.nextId++, x: 500, y: 300, vx: 0, vy: 12000, damage: 1, life: 1, weapon: "cannon", blastRadius: 0 });
	// A guard above the strand absorbs the shot first.
	guard.x = 500; guard.y = 330; const health = guard.health; step(game, idle, dt); expect(guard.health).toBeLessThan(health); expect(game.tethers).toHaveLength(1);
	const spiders = new Map([[spider.id, spider]]); expect(firstTetherHit(game, spiders, { x: 400, y: 360 }, { x: 380, y: 360 }).owner).toBe(null);
	blastTethers(game, spiders, { x: 600, y: 360 }, 30); expect(game.tethers).toHaveLength(0);
	attach(game, spider); flameTethers(game, spiders, { x: 420, y: 360 }, Math.PI, 180, .3); expect(game.tethers).toHaveLength(1);
});

test("strand collision handles crossing, collinear, parallel misses, endpoints, and zero-length shots", () => {
	const from = { x: 40, y: 0 }, to = { x: 100, y: 0 };
	expect(segmentHitTime({ x: 80, y: 20 }, { x: 80, y: -20 }, from, to, 6)).toBeCloseTo(.35);
	expect(segmentHitTime({ x: 150, y: 0 }, { x: 0, y: 0 }, from, to, 6)).toBeCloseTo(34 / 150);
	expect(segmentHitTime({ x: 150, y: 7 }, { x: 0, y: 7 }, from, to, 6)).toBe(Infinity);
	expect(segmentHitTime({ x: 100, y: 20 }, { x: 100, y: -20 }, from, to, 6)).toBeCloseTo(.35);
	expect(segmentHitTime({ x: 80, y: 0 }, { x: 80, y: 0 }, from, to, 6)).toBe(0);
});

test("pit suction, attack timers, and tethers freeze on pause and clear on wave replacement", () => {
	const game = setup(), spider = bug(game, "bolasSpider"); attach(game, spider); bug(game, "antlion", 460); bug(game, "dragonfly", 600, 200);
	togglePause(game); const before = JSON.stringify(game); advance(game, 10); expect(JSON.stringify(game)).toBe(before); togglePause(game); clearCombat(game);
	expect(game.tethers).toEqual([]); expect(game.bolas).toEqual([]); expect(game.pitTerrain).toBe(null);
});
