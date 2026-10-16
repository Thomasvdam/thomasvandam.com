import { expect, test } from "bun:test";
import { chooseHive, chooseUpgrade, closeBankedUpgrades, closeWorkshop, newGame, openBankedUpgrades, openWorkshop, playerStats, purchaseService, start, step, workshopServices } from "./game.ts";
import { viewFromGame } from "./runtime.ts";
import { TERRAIN_NAMES, terrainByPrevalence } from "./terrain.ts";
function workshop(points = 3, health = 40) {
	const game = newGame(47); start(game); game.bankedUpgrades = points; game.player.health = health;
	openWorkshop(game); openBankedUpgrades(game); return game;
}

test("a full heal costs one banked upgrade and cannot be purchased at full health", () => {
	const game = workshop(); const parts = JSON.stringify(game.parts);
	expect(workshopServices(game).find(choice => choice.id === "heal").key).toBe("4");
	purchaseService(game, "heal"); expect(game.player.health).toBe(100); expect(game.bankedUpgrades).toBe(2); expect(game.mode).toBe("spend"); expect(JSON.stringify(game.parts)).toBe(parts);
	expect(workshopServices(game).some(choice => choice.id === "heal")).toBe(false);
	const healed = JSON.stringify(game); purchaseService(game, "heal"); expect(JSON.stringify(game)).toBe(healed);
});

test("last-point healing returns to the workshop; repairs require saved points and cannot revive a dead run", () => {
	const game = workshop(1); purchaseService(game, "heal"); expect(game.player.health).toBe(100); expect(game.mode).toBe("workshop"); expect(game.bankedUpgrades).toBe(0);
	const empty = workshop(0); purchaseService(empty, "heal"); expect(empty.player.health).toBe(40); expect(empty.bankedUpgrades).toBe(0);
	for (const mode of ["base", "workshop", "playing", "paused", "upgrade", "dead"]) {
		const outside = workshop(2); outside.mode = mode; const frozen = JSON.stringify(outside);
		purchaseService(outside, "heal"); purchaseService(outside, "sensor"); expect(JSON.stringify(outside)).toBe(frozen);
	}
});

test("sensor ranks reveal difficulty then secondary terrain without rerolling hives or exposing hidden difficulty", () => {
	const game = workshop(4); const hives = JSON.stringify(game.hives), stats = playerStats(game);
	const before = viewFromGame(game);
	expect(game.parts.sensor).toBe(0);
	for (const hive of before.hives) { expect(hive.activity).toBeNull(); expect(hive.threat).toBeNull(); expect(hive.minBugs).toBeNull(); expect(hive.maxBugs).toBeNull(); expect(hive.secondaryTerrain).toBeNull(); }
	purchaseService(game, "sensor"); expect(game.parts.sensor).toBe(1); expect(game.bankedUpgrades).toBe(3);
	for (const preview of viewFromGame(game).hives) {
		const hive = game.hives.find(hive => hive.id === preview.id);
		expect(preview.activity).toBe(hive.activity); expect(preview.threat).toBe(hive.threat); expect(preview.minBugs).toBeGreaterThan(0); expect(preview.secondaryTerrain).toBeNull();
	}
	purchaseService(game, "sensor"); expect(game.parts.sensor).toBe(2); expect(game.bankedUpgrades).toBe(2);
	for (const preview of viewFromGame(game).hives) {
		const ordered = terrainByPrevalence(game.hives.find(hive => hive.id === preview.id).terrain);
		expect(preview.terrain).toBe(TERRAIN_NAMES[ordered[0]]); expect(preview.secondaryTerrain).toBe(TERRAIN_NAMES[ordered[1]]);
		expect(preview).not.toHaveProperty("layout"); expect(preview).not.toHaveProperty("forecast");
	}
	expect(JSON.stringify(game.hives)).toBe(hives); expect(playerStats(game)).toEqual(stats);
	expect(workshopServices(game).some(choice => choice.id === "sensor")).toBe(false);
	const capped = JSON.stringify(game); purchaseService(game, "sensor"); purchaseService(game, "invalid"); expect(JSON.stringify(game)).toBe(capped);
});

test("sensor progress persists across hives and resets on a new run", () => {
	const game = workshop(2, 100); purchaseService(game, "sensor"); purchaseService(game, "sensor");
	expect(game.mode).toBe("workshop"); closeWorkshop(game); chooseHive(game, game.hives[0].id);
	game.wave = 3; game.toSpawn = 0; game.intermission = .001;
	step(game, { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: false }, 1 / 120);
	expect(game.mode).toBe("base"); expect(game.parts.sensor).toBe(2);
	for (const hive of viewFromGame(game).hives) { expect(hive.activity).not.toBeNull(); expect(hive.secondaryTerrain).not.toBeNull(); }
	const fresh = newGame(47); expect(fresh.parts.sensor).toBe(0); expect(viewFromGame(fresh).hives.every(hive => hive.activity === null)).toBe(true);
});

test("normal level-up cards cannot purchase repairs or sensors and service back shortcuts stay stable", () => {
	const game = workshop(); game.mode = "upgrade"; const frozen = JSON.stringify(game);
	chooseUpgrade(game, "heal"); chooseUpgrade(game, "sensor"); expect(JSON.stringify(game)).toBe(frozen);
	game.mode = "spend"; expect(viewFromGame(game).choices.map(choice => choice.key)).toEqual(["1", "2", "3", "4", "5", "6"]);
	game.parts.undercarriages.legs = 3; purchaseService(game, "heal"); purchaseService(game, "sensor"); purchaseService(game, "sensor");
	game.bankedUpgrades = 1; openBankedUpgrades(game); expect(viewFromGame(game).choices.map(choice => choice.key)).toEqual(["1", "2", "6"]);
	closeBankedUpgrades(game); expect(game.mode).toBe("workshop"); expect(game.bankedUpgrades).toBe(1);
});
