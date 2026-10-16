import { expect, test } from "bun:test";
import { chooseHive, chooseUndercarriage, chooseUpgrade, chooseWeapon, closeShop, closeWeapons, closeWorkshop, newGame, openShop, openWeapons, openWorkshop, purchaseService, start, step, upgradeChoices, upgradeCost, workshopServices } from "./game";
import { viewFromGame } from "./runtime";
const idle = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: false };
function advance(game, duration) { for (let i = 0; i < Math.ceil(duration * 120); i++) step(game, idle, 1 / 120); }
function job() { const game = newGame(47); start(game); return game; }
function clearWave(game) { game.toSpawn = 0; game.spawns = []; game.enemies = []; step(game, idle, 1 / 120); advance(game, 3.1); }

test("each offered job quotes a payment before sensor upgrades; greater threat pays more", () => {
	const game = job(); const ordered = [...game.hives].sort((a, b) => a.threat - b.threat);
	expect(ordered.map(hive => hive.payment)).toEqual([100, 180, 260]);
	for (const hive of viewFromGame(game).hives) { expect(hive.activity).toBeNull(); expect(hive.payment).toBe(game.hives.find(candidate => candidate.id === hive.id).payment); }
	chooseHive(game, ordered[2].id); expect(viewFromGame(game).payment).toBe(260);
});

test("only a completed three-wave job pays, exactly once, and the receipt lasts until deployment", () => {
	const game = job(); const choice = game.hives[0]; chooseHive(game, choice.id); game.player.health = 40;
	clearWave(game); expect(game.wave).toBe(2); expect(game.money).toBe(0); expect(game.mode).toBe("playing");
	clearWave(game); expect(game.wave).toBe(3); expect(game.money).toBe(0);
	clearWave(game); expect(game.mode).toBe("base"); expect(game.money).toBe(choice.payment); expect(game.lastJob).toEqual({ name: choice.name, payment: choice.payment }); expect(game.player.health).toBe(40);
	const paid = JSON.stringify(game); advance(game, 20); expect(JSON.stringify(game)).toBe(paid);
	openWorkshop(game); openShop(game); closeShop(game); closeWorkshop(game); expect(game.money).toBe(choice.payment); expect(game.lastJob.payment).toBe(choice.payment);
	chooseHive(game, game.hives[0].id); expect(game.lastJob).toBeNull(); expect(game.money).toBe(choice.payment);
	for (let i = 0; i < 3; i++) clearWave(game); expect(game.money).toBeGreaterThan(choice.payment); expect(game.hivesCleared).toBe(2);
});

test("kills do not award currency or interrupt combat, and a failed job does not pay", () => {
	const game = job(); chooseHive(game, game.hives[0].id); game.toSpawn = 1; game.spawnTimer = 100;
	game.enemies.push({ id: 99, x: 50, y: 50, health: 0, maxHealth: 1, speed: 0, variant: "burrower", angle: 0, walkDistance: 0, bornAt: -10, hitAt: -10 });
	step(game, idle, 1 / 120); expect(game.kills).toBe(1); expect(game.money).toBe(0); expect(game.mode).toBe("playing");
	game.player.health = 20; game.enemies.push({ id: 100, ...game.player, health: 1, maxHealth: 1, speed: 0, variant: "burrower", bornAt: -10, hitAt: -10 }); step(game, idle, 1 / 120);
	expect(game.mode).toBe("dead"); expect(game.money).toBe(0); expect(game.lastJob).toBeNull();
});

test("shop prices rise with the upgraded part's own rank; exact balances work without automatic menu exits", () => {
	const game = job(); openWorkshop(game); openShop(game); expect(game.mode).toBe("shop");
	const empty = JSON.stringify(game); chooseUpgrade(game, "damage"); expect(JSON.stringify(game)).toBe(empty);
	game.money = 260; chooseUpgrade(game, "damage"); expect(game.money).toBe(160); expect(game.parts.weapons.cannon.damage).toBe(1); expect(upgradeChoices(game)[0].cost).toBe(160);
	chooseUpgrade(game, "damage"); expect(game.money).toBe(0); expect(game.parts.weapons.cannon.damage).toBe(2); expect(game.mode).toBe("shop"); expect(upgradeChoices(game)[0].cost).toBe(260);
	const broke = JSON.stringify(game); chooseUpgrade(game, "damage"); purchaseService(game, "sensor"); expect(JSON.stringify(game)).toBe(broke);
	closeShop(game); openWeapons(game); chooseWeapon(game, "shotgun"); closeWeapons(game); openShop(game); expect(upgradeChoices(game)[0].cost).toBe(100);
	closeShop(game); chooseUndercarriage(game, "wheels"); openShop(game); game.money = 100; chooseUpgrade(game, "speed"); expect(game.parts.undercarriages.wheels).toBe(1); expect(upgradeChoices(game).find(choice => choice.id === "speed").cost).toBe(160);
	closeShop(game); chooseUndercarriage(game, "legs"); openShop(game); expect(upgradeChoices(game).find(choice => choice.id === "speed").cost).toBe(100);
	for (let rank = 0; rank < 10; rank++) expect(upgradeCost(rank + 1)).toBeGreaterThan(upgradeCost(rank));
});

test("purchases are base-only and unavailable or capped choices never deduct money", () => {
	const game = job(); game.money = 1000; game.player.health = 40;
	for (const mode of ["ready", "playing", "paused", "base", "workshop", "weapons", "dead"]) {
		game.mode = mode; const frozen = JSON.stringify(game); chooseUpgrade(game, "damage"); purchaseService(game, "heal"); purchaseService(game, "sensor"); expect(JSON.stringify(game)).toBe(frozen);
	}
	game.mode = "shop"; game.parts.undercarriages.legs = 3; game.parts.weapons.cannon.mod = 10; game.parts.sensor = 2; game.player.health = 100;
	const capped = JSON.stringify(game); chooseUpgrade(game, "speed"); chooseUpgrade(game, "weaponMod"); chooseUpgrade(game, "invalid"); purchaseService(game, "heal"); purchaseService(game, "sensor"); expect(JSON.stringify(game)).toBe(capped);
	expect(viewFromGame(game).choices.map(choice => choice.key)).toEqual(["1", "6"]); expect(workshopServices(game)).toEqual([]);
});

test("a new run resets money, receipts and all purchases", () => {
	const game = job(); game.money = 1000; openWorkshop(game); openShop(game); chooseUpgrade(game, "damage"); purchaseService(game, "sensor");
	const fresh = newGame(); expect(fresh.money).toBe(0); expect(fresh.lastJob).toBeNull(); expect(fresh.parts.sensor).toBe(0); expect(fresh.parts.weapons.cannon.damage).toBe(0);
});
