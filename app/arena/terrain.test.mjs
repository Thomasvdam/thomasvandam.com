import { expect, test } from "bun:test";
import { chooseUpgrade, DESCENT_TIME, newGame, start, step, togglePause, WAVES_PER_DEPTH, waveSize } from "./game.ts";
import { createTerrain, MOVEMENT, terrainAt } from "./terrain.ts";
import { mechSkin } from "./sprite-parts.ts";
import { mechPose } from "./animation.ts";
const idle = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: false };
function advance(game, seconds, input = idle) { for (let i = 0; i < Math.ceil(seconds * 120); i++) step(game, input, 1 / 120); }
function clearedFloor() {
	const game = newGame(47); start(game); game.wave = WAVES_PER_DEPTH; game.toSpawn = 0;
	return game;
}

test("each undercarriage applies its terrain handling to actual movement and speed upgrades", () => {
	for (const undercarriage of ["legs", "wheels", "tracks"]) for (const terrain of ["firm", "mud", "rubble"]) {
		const game = newGame(1, undercarriage); start(game); game.terrain.fill(terrain); game.spawnTimer = 100;
		const before = game.player.x;
		advance(game, .25, { ...idle, move: { x: 1, y: 0 } });
		expect(game.player.x - before).toBeCloseTo(220 * MOVEMENT[undercarriage][terrain] * .25);
		game.mode = "upgrade"; chooseUpgrade(game, "speed"); const upgraded = game.player.x;
		advance(game, .25, { ...idle, move: { x: 1, y: 0 } });
		expect(game.player.x - upgraded).toBeCloseTo(245 * MOVEMENT[undercarriage][terrain] * .25);
	}
});

test("terrain is repeatable, changes with depth, keeps a firm arrival zone, and handles bounds", () => {
	const first = createTerrain(47, 1);
	expect(first).toEqual(createTerrain(47, 1)); expect(first).not.toEqual(createTerrain(47, 2));
	expect(new Set(first)).toEqual(new Set(["firm", "mud", "rubble"])); expect(first).toHaveLength(126);
	for (let depth = 1; depth <= 10; depth++) expect(terrainAt(createTerrain(47, depth), 560, 360)).toBe("firm");
	expect(terrainAt(first, -50, -50)).toBe(first[0]); expect(terrainAt(first, 1120, 720)).toBe(first.at(-1));
});

test("the third cleared wave descends once, preserving health, XP and equipment", () => {
	const game = clearedFloor(); game.undercarriage = "tracks"; game.player.health = 60; game.upgrades.damage = 2; game.damage = 3; game.xp = 2;
	const oldTerrain = [...game.terrain];
	advance(game, 3.1); expect(game.descent).toBeGreaterThan(0); expect(game.wave).toBe(3);
	const before = { ...game.player }; advance(game, .25, { ...idle, move: { x: 1, y: 1 }, fire: true });
	expect(game.player.x).toBe(before.x); expect(game.bullets).toHaveLength(0); expect(game.spawns).toHaveLength(0);
	advance(game, DESCENT_TIME);
	expect(game.depth).toBe(2); expect(game.wave).toBe(4); expect(game.descent).toBe(0);
	expect(game.toSpawn + game.spawns.length).toBe(waveSize(4)); expect(game.terrain).not.toEqual(oldTerrain);
	expect(game.player.health).toBe(60); expect(game.xp).toBe(2); expect(game.undercarriage).toBe("tracks"); expect(game.damage).toBe(3);
	expect(game.player.x).toBe(560); expect(game.player.y).toBe(360);
});

test("descent waits for every pickup and chained upgrade, and pauses without advancing", () => {
	const game = clearedFloor(); game.intermission = .001;
	game.pickups.push({ id: 90, x: 30, y: 30, value: 15, attracted: true });
	step(game, idle, 1 / 120); expect(game.descent).toBe(0);
	advance(game, 2); expect(game.mode).toBe("upgrade"); expect(game.descent).toBe(0);
	chooseUpgrade(game, "damage"); expect(game.mode).toBe("upgrade");
	chooseUpgrade(game, "speed"); advance(game, .1); expect(game.descent).toBeGreaterThan(0); expect(game.pickups).toHaveLength(0);
	togglePause(game); const paused = JSON.stringify(game); advance(game, 10); expect(JSON.stringify(game)).toBe(paused);
	togglePause(game); advance(game, 3); expect(game.depth).toBe(2); expect(game.wave).toBe(4);
	expect(newGame().depth).toBe(1); expect(newGame().descent).toBe(0);
});

test("wheels and tracks reuse attachment bones and upper-body animation without a walking stride", () => {
	for (const undercarriage of ["wheels", "tracks"]) {
		const skin = mechSkin({ damage: 3, fireRate: 3, speed: 3 }, undercarriage);
		expect(skin.footL).toBe(undercarriage === "wheels" ? "mechWheel" : "mechTrack"); expect(skin.footR).toBe(skin.footL);
		const state = { distance: 11, walkBlend: 1, moveAngle: .5, aimAngle: 2, shotAge: .03, time: 1 };
		const pose = mechPose({ ...state, undercarriage }); expect(pose.footL.x).toBe(0); expect(pose.upper.angle).toBe(2);
		expect(pose.weapon).toEqual(mechPose(state).weapon);
	}
});

test("level-up choices offer unequipped undercarriages and swapping consumes one choice", async () => {
	const { upgradeChoices } = await import("./game.ts");
	const game = newGame();
	expect(upgradeChoices(game).map(choice => choice.id)).toEqual(["damage", "fireRate", "speed", "wheels", "tracks"]);
	chooseUpgrade(game, "wheels"); expect(game.undercarriage).toBe("legs");
	game.mode = "upgrade"; game.player.health = 60; game.speed = 270; game.upgrades.speed = 2; game.xp = 1;
	chooseUpgrade(game, "wheels");
	expect(game.mode).toBe("playing"); expect(game.undercarriage).toBe("wheels"); expect(game.speed).toBe(270);
	expect(game.upgrades.speed).toBe(2); expect(game.player.health).toBe(60); expect(game.xp).toBe(1);
	expect(upgradeChoices(game).map(choice => choice.id)).toEqual(["damage", "fireRate", "speed", "legs", "tracks"]);
	game.mode = "upgrade"; chooseUpgrade(game, "wheels"); expect(game.mode).toBe("upgrade");
	chooseUpgrade(game, "tracks"); expect(game.undercarriage).toBe("tracks");
	game.mode = "upgrade"; chooseUpgrade(game, "legs"); expect(game.undercarriage).toBe("legs"); expect(game.upgrades.speed).toBe(2);
	expect(newGame().undercarriage).toBe("legs");
});
