import { expect, test } from "bun:test";
import { bankUpgrade, chooseHive, chooseUndercarriage, chooseUpgrade, closeBankedUpgrades, closeWorkshop, newGame, openBankedUpgrades, openWorkshop, playerStats, start, step, upgradeLevels, xpNeeded } from "./game.ts";
import { viewFromGame } from "./runtime.ts";
import { terrainByPrevalence, TERRAIN_NAMES } from "./terrain.ts";
const idle = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: false };
function advance(game, seconds) { for (let i = 0; i < Math.ceil(seconds * 120); i++) step(game, idle, 1 / 120); }
function deploy(game) { start(game); chooseHive(game, game.hives[0].id); game.toSpawn = 0; game.intermission = 100; }
function earn(game, value) { game.pickups.push({ id: game.nextId++, x: game.player.x, y: game.player.y, value }); step(game, idle, 1 / 120); }

test("level-up offers a free bank choice; banking preserves the unspent upgrade and resumes combat", () => {
	const game = newGame(); deploy(game); earn(game, xpNeeded(1));
	expect(game.mode).toBe("upgrade"); expect(game.level).toBe(2); expect(game.bankedUpgrades).toBe(0);
	expect(viewFromGame(game).choices.at(-1)).toMatchObject({ kind: "bank", key: "4" });
	const parts = JSON.stringify(game.parts); bankUpgrade(game);
	expect(game.mode).toBe("playing"); expect(game.bankedUpgrades).toBe(1); expect(JSON.stringify(game.parts)).toBe(parts);
	bankUpgrade(game); expect(game.bankedUpgrades).toBe(1);
	openBankedUpgrades(game); expect(game.mode).toBe("playing");
});

test("chained level-ups can be mixed between immediate upgrades and banking without losing XP", () => {
	const game = newGame(); deploy(game); const earned = xpNeeded(1) + xpNeeded(2) + xpNeeded(3) + 2;
	earn(game, earned); bankUpgrade(game); expect(game.mode).toBe("upgrade"); expect(game.bankedUpgrades).toBe(1);
	chooseUpgrade(game, "damage"); expect(game.mode).toBe("upgrade"); expect(playerStats(game).damage).toBe(2);
	bankUpgrade(game); expect(game.mode).toBe("playing"); expect(game.level).toBe(4); expect(game.xp).toBe(2); expect(game.bankedUpgrades).toBe(2);
});

test("banking the final hive's upgrades permits return to base with the balance intact", () => {
	const game = newGame(); deploy(game); game.wave = 3; game.intermission = .001;
	game.pickups.push({ id: 90, x: 30, y: 30, value: xpNeeded(1), attracted: true });
	advance(game, 2); expect(game.mode).toBe("upgrade"); bankUpgrade(game); advance(game, .1);
	expect(game.mode).toBe("base"); expect(game.bankedUpgrades).toBe(1); expect(game.hivesCleared).toBe(1);
	openBankedUpgrades(game); expect(game.mode).toBe("base"); openWorkshop(game); openBankedUpgrades(game); expect(game.mode).toBe("spend");
});

test("banked upgrades are spent only in the workshop, cost one each, and apply to the equipped parts", () => {
	const game = newGame(); start(game); game.bankedUpgrades = 3; game.player.health = 40;
	openWorkshop(game); chooseUndercarriage(game, "wheels"); openBankedUpgrades(game);
	const frozen = JSON.stringify(game); advance(game, 10); expect(JSON.stringify(game)).toBe(frozen);
	chooseUpgrade(game, "speed"); expect(game.bankedUpgrades).toBe(2); expect(game.parts.undercarriages).toEqual({ legs: 0, wheels: 1, treads: 0 }); expect(game.mode).toBe("spend");
	closeBankedUpgrades(game); chooseUndercarriage(game, "treads"); openBankedUpgrades(game); chooseUpgrade(game, "speed"); chooseUpgrade(game, "damage");
	expect(game.bankedUpgrades).toBe(0); expect(game.mode).toBe("workshop"); expect(game.parts.undercarriages).toEqual({ legs: 0, wheels: 1, treads: 1 }); expect(game.parts.cannon).toBe(1); expect(game.player.health).toBe(40);
	const parts = JSON.stringify(game.parts); chooseUpgrade(game, "speed"); openBankedUpgrades(game); expect(game.mode).toBe("workshop"); expect(JSON.stringify(game.parts)).toBe(parts);
});

test("capped and invalid upgrades cannot consume banked points; leaving the workshop keeps them", () => {
	const game = newGame(); start(game); game.bankedUpgrades = 2; game.parts.undercarriages.legs = 3;
	openWorkshop(game); openBankedUpgrades(game); const snapshot = JSON.stringify(game);
	chooseUpgrade(game, "speed"); chooseUpgrade(game, "invalid"); expect(JSON.stringify(game)).toBe(snapshot);
	expect(viewFromGame(game).choices.map(choice => choice.key)).toEqual(["1", "2", "5", "6"]);
	closeBankedUpgrades(game); closeWorkshop(game); chooseHive(game, game.hives[0].id);
	expect(game.bankedUpgrades).toBe(2); expect(upgradeLevels(game).speed).toBe(3); openBankedUpgrades(game); expect(game.mode).toBe("playing");
	game.mode = "dead"; bankUpgrade(game); openBankedUpgrades(game); chooseUpgrade(game, "damage"); expect(game.bankedUpgrades).toBe(2);
	expect(newGame().bankedUpgrades).toBe(0);
});

test("hive previews expose the most prevalent terrain without a map or percentages", () => {
	const game = newGame(47); start(game);
	for (const preview of viewFromGame(game).hives) {
		const hive = game.hives.find(hive => hive.id === preview.id);
		expect(preview.terrain).toBe(TERRAIN_NAMES[terrainByPrevalence(hive.terrain)[0]]);
		expect(preview).not.toHaveProperty("layout"); expect(preview).not.toHaveProperty("forecast");
	}
});
