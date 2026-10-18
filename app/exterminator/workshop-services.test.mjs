import { expect, test } from "bun:test";
import { chooseHive, closeShop, closeWorkshop, HEAL_COST, newGame, openShop, openWorkshop, playerStats, purchaseService, start, step, workshopServices } from "./game";
import { viewFromGame } from "./runtime";
import { enemyMixHints } from "./hives";
import { TERRAIN_NAMES, terrainByPrevalence } from "./terrain";
function shop(money = 1000, health = 40) { const game = newGame(47); start(game); game.money = money; game.player.health = health; openWorkshop(game); openShop(game); return game; }

test("full repairs deduct their listed price, require enough money, and disappear at full health", () => {
	const game = shop(HEAL_COST); const parts = JSON.stringify(game.parts);
	expect(workshopServices(game).find(choice => choice.id === "heal")).toMatchObject({ key: "4", cost: HEAL_COST });
	purchaseService(game, "heal"); expect(game.player.health).toBe(100); expect(game.money).toBe(0); expect(game.mode).toBe("shop"); expect(JSON.stringify(game.parts)).toBe(parts);
	const healed = JSON.stringify(game); purchaseService(game, "heal"); expect(JSON.stringify(game)).toBe(healed);
	const short = shop(HEAL_COST - 1); purchaseService(short, "heal"); expect(short.player.health).toBe(40); expect(short.money).toBe(HEAL_COST - 1);
});

test("sensor ranks have increasing prices and reveal difficulty, terrain, then enemy intel without rerolling jobs", () => {
	const game = shop(), hives = JSON.stringify(game.hives), stats = playerStats(game);
	for (const hive of viewFromGame(game).hives) { expect(hive.enemyMix).toBeNull(); expect(hive.activity).toBeNull(); expect(hive.threat).toBeNull(); expect(hive.minBugs).toBeNull(); expect(hive.secondaryTerrain).toBeNull(); expect(hive.payment).toBeGreaterThan(0); }
	const first = workshopServices(game).find(choice => choice.id === "sensor").cost;
	purchaseService(game, "sensor"); expect(game.parts.sensor).toBe(1); expect(game.money).toBe(1000 - first);
	const second = workshopServices(game).find(choice => choice.id === "sensor").cost; expect(second).toBeGreaterThan(first);
	for (const preview of viewFromGame(game).hives) { const hive = game.hives.find(hive => hive.id === preview.id); expect(preview.activity).toBe(hive.activity); expect(preview.threat).toBe(hive.threat); expect(preview.secondaryTerrain).toBeNull(); expect(preview.enemyMix).toBeNull(); }
	purchaseService(game, "sensor"); expect(game.parts.sensor).toBe(2); expect(game.money).toBe(1000 - first - second);
	for (const preview of viewFromGame(game).hives) {
		const ordered = terrainByPrevalence(game.hives.find(hive => hive.id === preview.id).terrain);
		expect(preview.enemyMix).toBeNull(); expect(preview.terrain).toBe(TERRAIN_NAMES[ordered[0]]); expect(preview.secondaryTerrain).toBe(TERRAIN_NAMES[ordered[1]]);
		expect(preview).not.toHaveProperty("layout"); expect(preview).not.toHaveProperty("forecast");
	}
	const third = workshopServices(game).find(choice => choice.id === "sensor");
	expect(third.cost).toBeGreaterThan(second); expect(third.description).toContain("enemy mix");
	purchaseService(game, "sensor"); expect(game.parts.sensor).toBe(3); expect(game.money).toBe(1000 - first - second - third.cost);
	for (const preview of viewFromGame(game).hives) expect(preview.enemyMix).toBe(enemyMixHints(game.hives.find(hive => hive.id === preview.id).enemyMix));
	expect(JSON.stringify(game.hives)).toBe(hives); expect(playerStats(game)).toEqual(stats);
	const capped = JSON.stringify(game); purchaseService(game, "sensor"); purchaseService(game, "invalid"); expect(JSON.stringify(game)).toBe(capped);
});

test("sensor purchases persist across jobs and stay resettable with the run", () => {
	const game = shop(); purchaseService(game, "sensor"); purchaseService(game, "sensor"); purchaseService(game, "sensor"); closeShop(game); closeWorkshop(game); chooseHive(game, game.hives[0].id);
	game.wave = 3; game.toSpawn = 0; game.intermission = .001;
	step(game, { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: false }, 1 / 120);
	expect(game.mode).toBe("base"); expect(game.parts.sensor).toBe(3);
	for (const hive of viewFromGame(game).hives) { expect(hive.enemyMix).not.toBeNull(); expect(hive.activity).not.toBeNull(); expect(hive.secondaryTerrain).not.toBeNull(); }
	expect(newGame().parts.sensor).toBe(0);
});
