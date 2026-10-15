import { expect, test } from "bun:test";
import { chooseHive, chooseUndercarriage, chooseUpgrade, closeWorkshop, openWorkshop, BASE_SPEED, MAX_SPEED_RANK, SPEED_RANK_BONUS, newGame, playerStats, start, step, upgradeChoices, upgradeLevels, WAVES_PER_HIVE, waveSize } from "./game.ts";
import { createHives } from "./hives.ts";
import { createTerrain, MOVEMENT, terrainAt, terrainSummary } from "./terrain.ts";
import { mechSkin } from "./sprite-parts.ts";
import { mechPose } from "./animation.ts";
import { viewFromGame } from "./runtime.ts";
const idle = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: false };
function advance(game, seconds, input = idle) { for (let i = 0; i < Math.ceil(seconds * 120); i++) step(game, input, 1 / 120); }
function deploy(game) { start(game); chooseHive(game, game.hives.find(hive => hive.activity === "Low").id); }
function finishHive(game) { game.wave = WAVES_PER_HIVE; game.toSpawn = 0; game.enemies = []; game.spawns = []; advance(game, 3.1); }

test("each undercarriage applies its terrain handling to actual movement and speed upgrades", () => {
	for (const undercarriage of ["legs", "wheels", "treads"]) for (const terrain of ["firm", "mud", "rubble"]) {
		const game = newGame(1, undercarriage); deploy(game); game.terrain.fill(terrain); game.spawnTimer = 100;
		const before = game.player.x; advance(game, .25, { ...idle, move: { x: 1, y: 0 } });
		expect(game.player.x - before).toBeCloseTo(BASE_SPEED * MOVEMENT[undercarriage][terrain] * .25);
		game.mode = "upgrade"; chooseUpgrade(game, "speed"); const upgraded = game.player.x;
		advance(game, .25, { ...idle, move: { x: 1, y: 0 } });
		expect(game.player.x - upgraded).toBeCloseTo((BASE_SPEED * 1.08) * MOVEMENT[undercarriage][terrain] * .25);
	}
});

test("terrain is repeatable, varies by layout, keeps a firm arrival zone, and handles bounds", () => {
	const first = createTerrain(47, 1);
	expect(first).toEqual(createTerrain(47, 1)); expect(first).not.toEqual(createTerrain(47, 2));
	expect(new Set(first)).toEqual(new Set(["firm", "mud", "rubble"])); expect(first).toHaveLength(126);
	for (let layout = 1; layout <= 10; layout++) expect(terrainAt(createTerrain(47, layout), 560, 360)).toBe("firm");
	expect(terrainAt(first, -50, -50)).toBe(first[0]); expect(terrainAt(first, 1120, 720)).toBe(first.at(-1));
});

test("ready opens base; hive completion returns to base without repairs or automatic redeployment", () => {
	const game = newGame(47); start(game); expect(game.mode).toBe("base"); expect(game.hive).toBeNull();
	chooseHive(game, "invalid"); expect(game.mode).toBe("base");
	const candidate = game.hives[0], forecast = [...candidate.terrain]; chooseHive(game, candidate.id);
	expect(game.mode).toBe("playing"); expect(game.hive.id).toBe(candidate.id); expect(game.terrain).toEqual(forecast);
	game.player.health = 40; game.xp = 2; game.parts.cannon = 2; game.parts.cooler = 1;
	finishHive(game);
	expect(game.mode).toBe("base"); expect(game.hivesCleared).toBe(1); expect(game.player.health).toBe(40); expect(game.hive).toBeNull();
	expect(game.xp).toBe(2); expect(playerStats(game).damage).toBe(3); expect(playerStats(game).shotInterval).toBeCloseTo(.17);
	expect(game.bullets).toHaveLength(0); expect(game.hives).toHaveLength(3);
	const waiting = JSON.stringify(game); advance(game, 20, { ...idle, move: { x: 1, y: 1 }, fire: true }); expect(JSON.stringify(game)).toBe(waiting);
	const next = game.hives[1]; chooseHive(game, next.id);
	expect(game.mode).toBe("playing"); expect(game.wave).toBe(1); expect(game.toSpawn).toBe(waveSize(1, next.threat));
	expect(game.terrain).toEqual(next.terrain); expect(game.player.health).toBe(40); expect(game.xp).toBe(2);
	expect(game.player.x).toBe(560); expect(game.player.y).toBe(360);
});

test("return to base waits for all XP and chained upgrade choices", () => {
	const game = newGame(); deploy(game); game.wave = WAVES_PER_HIVE; game.toSpawn = 0; game.intermission = .001;
	game.pickups.push({ id: 90, x: 30, y: 30, value: 15, attracted: true });
	advance(game, 2); expect(game.mode).toBe("upgrade"); expect(game.hivesCleared).toBe(0);
	chooseUpgrade(game, "damage"); expect(game.mode).toBe("upgrade"); chooseUpgrade(game, "speed");
	advance(game, .1); expect(game.mode).toBe("base"); expect(game.pickups).toHaveLength(0); expect(game.hivesCleared).toBe(1);
});

test("workshop is optional and reopenable, preserves hive choices, and never deploys or repairs", () => {
	const game = newGame(); start(game); game.player.health = 60;
	const choices = JSON.stringify(game.hives);
	for (const base of ["wheels", "treads", "legs"]) {
		openWorkshop(game); expect(game.mode).toBe("workshop"); chooseUndercarriage(game, base);
		expect(game.undercarriage).toBe(base); expect(game.mode).toBe("workshop"); expect(game.player.health).toBe(60);
		chooseHive(game, game.hives[0].id); expect(game.mode).toBe("workshop");
		const frozen = JSON.stringify(game); advance(game, 10); expect(JSON.stringify(game)).toBe(frozen);
		closeWorkshop(game); expect(game.mode).toBe("base"); expect(JSON.stringify(game.hives)).toBe(choices);
	}
	chooseUndercarriage(game, "wheels"); expect(game.undercarriage).toBe("legs");
	chooseHive(game, game.hives[0].id); chooseUndercarriage(game, "treads"); expect(game.undercarriage).toBe("legs");
	openWorkshop(game); expect(game.mode).toBe("playing");
});

test("hive previews match deployed layouts and activity changes actual enemy pressure", () => {
	for (const seed of [1, 47, 999, 4294967295]) {
		const choices = createHives(seed, 0); expect(choices).toEqual(createHives(seed, 0));
		expect(new Set(choices.map(hive => terrainSummary(hive.terrain)[0].id)).size).toBe(3);
		expect(new Set(choices.map(hive => hive.activity))).toEqual(new Set(["Low", "Moderate", "High"]));
		const pressures = [];
		for (const choice of [...choices].sort((a, b) => a.threat - b.threat)) {
			const game = newGame(seed); start(game); const preview = viewFromGame(game).hives.find(hive => hive.id === choice.id);
			chooseHive(game, choice.id); expect(game.terrain).toEqual(choice.terrain);
			expect(game.toSpawn).toBe(preview.minBugs); game.spawnTimer = 0; step(game, idle, 1 / 120); advance(game, 1.3);
			pressures.push({ total: preview.minBugs, health: game.enemies[0].maxHealth, speed: game.enemies[0].speed });
		}
		expect(pressures[2].total).toBeGreaterThan(pressures[0].total); expect(pressures[2].health).toBeGreaterThan(pressures[0].health); expect(pressures[2].speed).toBeGreaterThan(pressures[0].speed);
		expect(Math.min(...createHives(seed, 1).map(hive => hive.threat))).toBeGreaterThan(Math.min(...choices.map(hive => hive.threat)));
	}
});

test("part speed ranks are independent, restored on re-equip, and reset for a new run", () => {
	const game = newGame(); deploy(game);
	for (let rank = 0; rank < 3; rank++) { game.mode = "upgrade"; chooseUpgrade(game, "speed"); }
	expect(upgradeChoices(game).map(choice => choice.id)).toEqual(["damage", "fireRate"]);
	finishHive(game); openWorkshop(game); chooseUndercarriage(game, "wheels");
	expect(upgradeLevels(game).speed).toBe(0); expect(playerStats(game).speed).toBe(BASE_SPEED); expect(mechSkin(upgradeLevels(game), "wheels").footL).toBe("mechWheel");
	closeWorkshop(game); chooseHive(game, game.hives[0].id); game.mode = "upgrade"; chooseUpgrade(game, "speed");
	expect(game.parts.undercarriages).toEqual({ legs: 3, wheels: 1, treads: 0 });
	finishHive(game); openWorkshop(game); chooseUndercarriage(game, "legs");
	expect(upgradeLevels(game).speed).toBe(3); expect(playerStats(game).speed).toBeCloseTo(BASE_SPEED * 1.24); expect(mechSkin(upgradeLevels(game), "legs").footL).toBe("mechBoostFoot");
	chooseUndercarriage(game, "wheels"); expect(upgradeLevels(game).speed).toBe(1); expect(mechSkin(upgradeLevels(game), "wheels").footL).toBe("mechServoWheel");
	game.mode = "dead"; const frozen = JSON.stringify(game); chooseUndercarriage(game, "treads"); chooseUpgrade(game, "speed"); expect(JSON.stringify(game)).toBe(frozen);
	const fresh = newGame(); expect(fresh.parts).toEqual({ cannon: 0, cooler: 0, undercarriages: { legs: 0, wheels: 0, treads: 0 } }); expect(fresh.hivesCleared).toBe(0);
});

test("handling budgets and capped speed retain terrain advantages", () => {
	expect(MOVEMENT.legs).toEqual({ firm: 1, mud: .25, rubble: 1 }); expect(MOVEMENT.wheels).toEqual({ firm: 1.5, mud: .375, rubble: .375 }); expect(MOVEMENT.treads).toEqual({ firm: .75, mud: .75, rubble: .75 });
	for (const speeds of Object.values(MOVEMENT)) expect(Object.values(speeds).reduce((a, b) => a + b)).toBe(2.25);
	const game = newGame(); deploy(game);
	for (let rank = 1; rank <= MAX_SPEED_RANK; rank++) { game.mode = "upgrade"; chooseUpgrade(game, "speed"); expect(playerStats(game).speed).toBeCloseTo(BASE_SPEED * (1 + rank * SPEED_RANK_BONUS)); }
	game.mode = "upgrade"; const frozen = JSON.stringify(game); chooseUpgrade(game, "speed"); expect(JSON.stringify(game)).toBe(frozen);
	for (const terrain of ["firm", "mud", "rubble"]) for (const slower of ["legs", "wheels", "treads"]) for (const faster of ["legs", "wheels", "treads"]) {
		if (MOVEMENT[slower][terrain] < MOVEMENT[faster][terrain]) expect(playerStats(game).speed * MOVEMENT[slower][terrain]).toBeLessThan(BASE_SPEED * MOVEMENT[faster][terrain]);
	}
	chooseUpgrade(game, "damage"); expect(playerStats(game).damage).toBe(2); expect(game.mode).toBe("playing");
});

test("wheels and treads reuse attachment bones and upper-body animation without walking", () => {
	for (const undercarriage of ["wheels", "treads"]) {
		const skin = mechSkin({ damage: 3, fireRate: 3, speed: 3 }, undercarriage); expect(skin.footL).toBe(undercarriage === "wheels" ? "mechBoostWheel" : "mechBoostTread"); expect(skin.footR).toBe(skin.footL);
		const state = { distance: 11, walkBlend: 1, moveAngle: .5, aimAngle: 2, shotAge: .03, time: 1 };
		const pose = mechPose({ ...state, undercarriage }); expect(pose.footL.x).toBe(0); expect(pose.upper.angle).toBe(2); expect(pose.weapon).toEqual(mechPose(state).weapon);
	}
});
