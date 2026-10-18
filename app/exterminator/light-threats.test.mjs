import { expect, test } from "bun:test";
import { BUG_TYPES, createBug, defaultBugWeights } from "./bug-types";
import { chooseHive, clearCombat, FIELD, newGame, purchaseService, start, step, workshopServices } from "./game";
import { lightAt, warningLit } from "./lighting";
import { assignLightTrait, canAttackLights, chooseLightTarget, combatTarget, cornerPosition, damageLamp, LAMP_HEALTH, lightPosition, lightSensitiveChance, lightTransmission, MECH_LIGHTS, MOTH_SWARM_SIZE, refreshLightCover } from "./light-threats";
import { defaultComposition, setDebug, spawnDebugWave } from "./debug";
import { blastTethers, firstTetherHit, flameTethers, preparePulls, provokeBombardier } from "./predators";
import { viewFromGame } from "./runtime";
const idle = { move: { x: 0, y: 0 }, aim: { x: 1, y: 0 }, fire: false };
function setup() {
	const game = newGame(47); start(game); game.mode = "shop"; game.money = 1000;
	purchaseService(game, "northWest"); game.mode = "base"; chooseHive(game, game.hives[0].id);
	game.toSpawn = 1; game.spawnTimer = 1000; game.player.invulnerable = 1000; return game;
}
function bug(game, variant, x = 300, y = 16, sensitive = false) {
	const enemy = createBug({ variant, id: game.nextId++, position: { x, y }, player: game.player, threat: 1, wave: 1, time: game.time, bounds: FIELD });
	if (sensitive) enemy.lightSensitive = true; game.enemies.push(enemy); return enemy;
}
function advance(game, seconds, input = idle) { for (let i = 0; i < Math.round(seconds * 120); i++) step(game, input, 1 / 120); }
function mothsAt(game, id, count = 4) {
	const source = lightPosition(game, id);
	return Array.from({ length: count }, () => { const moth = bug(game, "moth", source.x, source.y); moth.state.light = id; return moth; });
}

test("moth swarms unlock in hive three and debug encounters expand into six individually killable moths", () => {
	expect(defaultBugWeights(1).moth).toBe(0); expect(defaultBugWeights(2).moth).toBeGreaterThan(0);
	const game = setup(); setDebug(game, true); spawnDebugWave(game, { ...defaultComposition(), burrower: 0, moth: 2 }, 100);
	step(game, idle, 1 / 120); expect(game.spawns).toHaveLength(MOTH_SWARM_SIZE);
	game.spawnTimer = 0; step(game, idle, 1 / 120); expect(game.spawns).toHaveLength(MOTH_SWARM_SIZE * 2);
	advance(game, 1.3); expect(game.enemies).toHaveLength(12); expect(game.enemies.every(e => e.variant === "moth" && e.health === 1 && !e.lightSensitive)).toBe(true);
	const ids = game.enemies.map(e => e.id); expect(new Set(ids).size).toBe(12); expect(game.mode).toBe("playing");
});

test("moths seek both mobile and fixed light sources, orbit them, and never damage mech or fixtures", () => {
	const game = setup(); game.player.invulnerable = 0;
	const corner = bug(game, "moth", 40, 40), mobile = bug(game, "moth", game.player.x + 30, game.player.y);
	advance(game, 2);
	expect(corner.state.light).toBe("northWest"); expect(MECH_LIGHTS).toContain(mobile.state.light);
	expect(Math.hypot(corner.x - 16, corner.y - 16)).toBeLessThan(50); expect(game.player.health).toBe(100); expect(game.lampHealth.northWest).toBe(60);
	const before = { x: mobile.x, y: mobile.y }; advance(game, .1); expect(Math.hypot(mobile.x - before.x, mobile.y - before.y)).toBeGreaterThan(0);
	damageLamp(game, "northWest", 60); advance(game, .1); expect(corner.state.light).not.toBe("northWest");
});

test("moth density dims only its source, blocks all light at four moths, and death/dispersal restores it", () => {
	const game = setup(); game.player.angle = 0; const target = { x: 790, y: 360 };
	const initial = lightAt(game, target.x, target.y); const swarm = mothsAt(game, "front", 2); refreshLightCover(game);
	expect(lightTransmission(game, "front")).toBe(.5); expect(lightAt(game, target.x, target.y)).toBeCloseTo(initial * .5);
	mothsAt(game, "front", 2); refreshLightCover(game); expect(lightAt(game, target.x, target.y)).toBe(0); expect(warningLit(game, target)).toBe(false);
	expect(lightTransmission(game, "rearLeft")).toBe(1); expect(lightTransmission(game, "northWest")).toBe(1);
	for (const moth of swarm) moth.health = 0; refreshLightCover(game); expect(lightTransmission(game, "front")).toBe(.5);
	for (const enemy of game.enemies) enemy.x = 1000; refreshLightCover(game); expect(lightAt(game, target.x, target.y)).toBeCloseTo(initial);
	for (const id of [...MECH_LIGHTS, "northWest"]) mothsAt(game, id);
	refreshLightCover(game); expect(lightAt(game, game.player.x, game.player.y)).toBe(0); expect(lightAt(game, 100, 100)).toBe(0);
	game.mode = "paused"; const frozen = JSON.stringify(game); advance(game, 1); expect(JSON.stringify(game)).toBe(frozen);
	clearCombat(game); expect(Object.values(game.lightCover).every(count => count === 0)).toBe(true); expect(game.parts.cornerLights.northWest).toBe(true);
});

test("light attackers unlock in hive five with difficulty/progression rates, stable traits, and excluded species", () => {
	expect(lightSensitiveChance(3, 10)).toBe(0); expect(lightSensitiveChance(4, 5)).toBe(.1);
	expect(lightSensitiveChance(4, 7)).toBeGreaterThan(lightSensitiveChance(4, 5)); expect(lightSensitiveChance(8, 9)).toBeGreaterThan(.1); expect(lightSensitiveChance(100, 200)).toBe(.45);
	const game = setup(); game.hivesCleared = 4; game.hive.threat = 5;
	let marked = 0;
	for (let i = 1; i <= 2000; i++) { const enemy = createBug({ variant: "burrower", id: i, position: { x: 300, y: 300 }, player: game.player, threat: 1, wave: 1, time: 0, bounds: FIELD }); assignLightTrait(game, enemy); marked += enemy.lightSensitive ? 1 : 0; const again = { ...enemy, lightSensitive: undefined }; assignLightTrait(game, again); expect(again.lightSensitive).toBe(enemy.lightSensitive); }
	expect(marked / 2000).toBeCloseTo(.1, 1);
	setDebug(game, true); game.debug.lightSensitivePercent = 100;
	for (const variant of BUG_TYPES) { const enemy = bug(game, variant); assignLightTrait(game, enemy); expect(!!enemy.lightSensitive).toBe(canAttackLights(variant)); }
	for (const excluded of ["moth", "queen", "worker", "egg", "slug", "antlion", "centipede"]) expect(canAttackLights(excluded)).toBe(false);
});

test("trait assignment also covers eligible hatched ants and debug wave overrides validate their percentages", () => {
	const game = setup(); setDebug(game, true); game.debug.lightSensitivePercent = 100;
	const egg = bug(game, "egg", 300, 300); egg.bornAt = -5; egg.state.hatchVariant = "soldier";
	step(game, idle, 1 / 120); expect(game.enemies.find(e => e.id === egg.id)).toMatchObject({ variant: "soldier", lightSensitive: true });
	for (const percent of [-1, 101, NaN]) { const before = JSON.stringify(game); spawnDebugWave(game, defaultComposition(), percent); expect(JSON.stringify(game)).toBe(before); }
});

test("attackers select installed corners, persist through moth obstruction, retarget destruction, then resume the mech", () => {
	const game = setup(), enemy = bug(game, "burrower", 100, 100, true);
	chooseLightTarget(game, enemy); expect(enemy.lightTarget).toBe("northWest"); expect(combatTarget(game, enemy)).toEqual(cornerPosition("northWest"));
	mothsAt(game, "northWest"); refreshLightCover(game); chooseLightTarget(game, enemy); expect(enemy.lightTarget).toBe("northWest");
	game.mode = "shop"; purchaseService(game, "southEast"); game.mode = "playing";
	damageLamp(game, "northWest", 999); chooseLightTarget(game, enemy); expect(enemy.lightTarget).toBe("southEast");
	damageLamp(game, "southEast", 999); chooseLightTarget(game, enemy); expect(enemy.lightTarget).toBeNull(); expect(combatTarget(game, enemy)).toBe(game.player);
	const ordinary = bug(game, "burrower", 100, 100); chooseLightTarget(game, ordinary); expect(combatTarget(game, ordinary)).toBe(game.player);
});

test("every eligible species damages fixtures using contact, charge, projectile, spray, or tether attacks", () => {
	for (const variant of BUG_TYPES.filter(canAttackLights)) {
		const game = setup(), enemy = bug(game, variant, variant === "bombardier" ? 150 : 300, 30, true);
		enemy.angle = Math.atan2(16 - enemy.y, 16 - enemy.x); step(game, idle, 1 / 120);
		if (variant === "bombardier") { enemy.speed = 0; provokeBombardier(game, enemy); }
		advance(game, 10);
		expect(game.lampHealth.northWest, variant).toBeLessThan(LAMP_HEALTH);
		expect(game.player.health, variant).toBe(100);
	}
});

test("lamp health and destruction persist across combat cleanup, and $30 repurchases restore full health exactly once", () => {
	const game = setup(); damageLamp(game, "northWest", 20); clearCombat(game); expect(game.lampHealth.northWest).toBe(40); expect(game.parts.cornerLights.northWest).toBe(true);
	game.mode = "shop"; const before = game.money; purchaseService(game, "northWest"); expect(game.money).toBe(before);
	damageLamp(game, "northWest", 40); expect(game.parts.cornerLights.northWest).toBe(false); expect(workshopServices(game).find(c => c.id === "northWest").cost).toBe(30);
	game.money = 29; purchaseService(game, "northWest"); expect(game.lampHealth.northWest).toBe(0);
	game.money = 30; purchaseService(game, "northWest"); expect(game.money).toBe(0); expect(game.lampHealth.northWest).toBe(60); expect(game.parts.cornerLights.northWest).toBe(true);
	purchaseService(game, "northWest"); expect(game.lampHealth.northWest).toBe(60); expect(newGame().parts.cornerLights.northWest).toBe(false);
});

test("lamp tethers damage only their lamp and remain cuttable by bullets, explosions and flame", () => {
	for (const weapon of ["cannon", "shotgun", "rpg", "flamethrower"]) {
		const game = setup(), spider = bug(game, "bolasSpider", 400, 16, true), spiders = new Map([[spider.id, spider]]);
		game.tethers = [{ owner: spider.id, lightTarget: "northWest", remaining: 6 }];
		expect(preparePulls(game, 1).force).toEqual({ x: 0, y: 0 }); expect(game.lampHealth.northWest).toBe(45); expect(viewFromGame(game).tethered).toBe(0);
		if (weapon === "rpg") blastTethers(game, spiders, { x: 200, y: 16 }, 10);
		else if (weapon === "flamethrower") flameTethers(game, spiders, { x: 200, y: 50 }, -Math.PI / 2, 100, Math.PI / 6);
		else { expect(firstTetherHit(game, spiders, { x: 200, y: 50 }, { x: 200, y: 0 }).owner).toBe(spider.id); game.tethers = []; }
		expect(game.tethers, weapon).toHaveLength(0);
	}
	const game = setup(), spider = bug(game, "bolasSpider", 400, 16); game.tethers = [{ owner: spider.id, lightTarget: "northWest", remaining: 6 }];
	preparePulls(game, 4.1); expect(game.parts.cornerLights.northWest).toBe(false); expect(game.tethers).toHaveLength(0);
});

test("acid uses swept obstruction order and ordinary shots cannot destroy lamps", () => {
	for (const sensitive of [false, true]) {
		const game = setup(); game.acid.push({ id: 90, owner: 99, x: 200, y: 16, vx: -20000, vy: 0, life: 2, ...(sensitive ? { lightTarget: "northWest" } : {}) });
		step(game, idle, 1 / 30); expect(game.lampHealth.northWest).toBe(sensitive ? 40 : 60);
	}
	const game = setup(), armour = bug(game, "armoured", 100, 18); armour.speed = 0;
	game.acid.push({ id: 90, owner: 99, x: 200, y: 16, vx: -20000, vy: 0, life: 2, lightTarget: "northWest" });
	step(game, idle, 1 / 30); expect(game.lampHealth.northWest).toBe(60); expect(game.acid).toHaveLength(0);
});


test("real weapon input cuts a lamp cord without pulling the mech", () => {
	for (const weapon of ["cannon", "shotgun", "rpg", "flamethrower"]) {
		const game = setup(), spider = bug(game, "bolasSpider", 400, 16, true); spider.speed = 0; spider.state.cooldown = 100;
		game.player.x = 200; game.player.y = 100; game.weapon = weapon;
		game.tethers = [{ owner: spider.id, lightTarget: "northWest", remaining: 6 }];
		advance(game, .25, { ...idle, aim: { x: 0, y: -1 }, fire: true });
		expect(game.tethers, weapon).toHaveLength(0); expect(game.player.x).toBe(200); expect(game.player.y).toBe(100);
	}
});

test("moths keep a wave alive and their deaths restore coverage while leaving persistent remains", () => {
	const game = setup(); game.toSpawn = 0; const swarm = mothsAt(game, "front");
	step(game, idle, 1 / 120); expect(game.intermission).toBe(0); expect(game.lightCover.front).toBe(4);
	swarm[0].health = 0; step(game, idle, 1 / 120); expect(game.intermission).toBe(0); expect(game.lightCover.front).toBe(3);
	for (const moth of swarm) moth.health = 0; step(game, idle, 1 / 120);
	expect(game.intermission).toBe(3); expect(game.lightCover.front).toBe(0); expect(game.remains).toHaveLength(4); expect(game.kills).toBe(4);
});


test("moths keep blocking a darkened source but reconsider distant sources after the mech escapes", () => {
	const game = setup(), swarm = mothsAt(game, "front", 6); refreshLightCover(game);
	advance(game, .2); expect(swarm.every(moth => moth.state.light === "front")).toBe(true);
	const moth = swarm[0]; moth.x = 20; moth.y = 20; moth.state.seekRemaining = 0; game.player.x = 1000; game.player.y = 600;
	step(game, idle, 1 / 120); expect(moth.state.light).toBe("northWest");
});
