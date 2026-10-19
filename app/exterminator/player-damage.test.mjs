import { expect, test } from "bun:test";
import { armourReduction, attackDamage, bugDamageMultiplier, hurtPlayer, MAX_ARMOUR_RANK } from "./player-damage";
import { closeShop, closeWorkshop, chooseHive, newGame, openShop, openWorkshop, purchaseService, start, step, FIELD, PLAYER_RADIUS, workshopServices } from "./game";
import { createBug } from "./bug-types";
import { BEETLE_FLIGHT_TIME } from "./bug-types";
import { resolveAntExplosions, stepClickBeetle } from "./specialists";
import { stepBombardier } from "./predators";
import { bugEntry } from "./bugpedia";
const idle = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: false };
function setup(cleared = 0, armour = 0) { const game = newGame(); start(game); chooseHive(game, game.hives[0].id); game.toSpawn = 1; game.spawnTimer = 1000; game.hivesCleared = cleared; game.parts.armour = armour; return game; }
function bug(game, variant, dx = 0) { const enemy = createBug({ variant, id: game.nextId++, position: { x: game.player.x + dx, y: game.player.y }, player: game.player, time: 0, threat: 1, wave: 1, bounds: FIELD }); enemy.speed = 0; game.enemies.push(enemy); return enemy; }

test("damage starts gently and scales by hive, with armour applied before whole-point rounding", () => {
	for (const [cleared, ordinary, click, heavy] of [[0, 10, 13, 15], [1, 11, 14, 17], [10, 20, 25, 30], [20, 30, 38, 45]]) {
		expect(attackDamage(20, cleared)).toBe(ordinary); expect(attackDamage(25, cleared)).toBe(click); expect(attackDamage(30, cleared)).toBe(heavy);
	}
	expect(bugDamageMultiplier(0)).toBe(.5); expect(attackDamage(25, 0, 5)).toBe(6); // Round once after armour, not 13 / 2.
	expect(attackDamage(20, 0, 1)).toBe(9); expect(attackDamage(20, 0, 5)).toBe(5); expect(attackDamage(20, 20, 5)).toBe(15);
	expect(armourReduction(MAX_ARMOUR_RANK)).toBe(.5); expect(armourReduction(99)).toBe(.5); expect(attackDamage(1, 0, 5)).toBe(1);
});

test("all direct, projectile, spray and area attacks use the same scaling and armour", () => {
	const sources = {
		contact: game => { bug(game, "burrower"); step(game, idle, 1 / 120); },
		acid: game => { game.acid.push({ id: 99, owner: -1, x: game.player.x + 40, y: game.player.y, vx: -10000, vy: 0, life: 1 }); step(game, idle, 1 / 120); },
		lob: game => { game.lobs.push({ id: 99, owner: -1, x: 0, y: 0, target: { ...game.player }, age: BEETLE_FLIGHT_TIME - .001 }); step(game, idle, 1 / 120); },
		spray: game => { const enemy = bug(game, "bombardier", -80); enemy.state.phase = "spray"; enemy.state.remaining = .4; enemy.state.direction = 0; stepBombardier(game, enemy, .01, FIELD, PLAYER_RADIUS); },
		click: game => { const enemy = bug(game, "clickBeetle"); enemy.state.phase = "flight"; enemy.state.remaining = .001; enemy.state.origin = { ...game.player }; enemy.state.target = { ...game.player }; stepClickBeetle(game, enemy, .01, FIELD, PLAYER_RADIUS); },
		ant: game => { const enemy = bug(game, "explodingAnt"); enemy.health = 0; resolveAntExplosions(game, PLAYER_RADIUS); },
	};
	for (const [name, hit] of Object.entries(sources)) for (const [cleared, armour, ordinary, click, heavy] of [[0, 0, 10, 13, 15], [10, 5, 10, 13, 15], [20, 5, 15, 19, 23]]) {
		const game = setup(cleared, armour); hit(game);
		expect(game.player.health, `${name}, hive ${cleared + 1}, armour ${armour}`).toBe(100 - (name === "click" ? click : name === "ant" ? heavy : ordinary));
		expect(game.player.invulnerable).toBeGreaterThan(0);
	}
});

test("invulnerability still blocks stacked hits, armour permits death, and zero damage does nothing", () => {
	const game = setup(0, 5); hurtPlayer(game, 20); expect(game.player.health).toBe(95); hurtPlayer(game, 30); expect(game.player.health).toBe(95);
	game.player.invulnerable = 0; hurtPlayer(game, 0); expect(game.player.invulnerable).toBe(0);
	game.player.health = 4; bug(game, "burrower"); step(game, idle, 1 / 120); expect(game.player.health).toBe(0); expect(game.mode).toBe("dead");
});

test("armour has five priced run ranks shared across equipment; invalid purchases never charge", () => {
	const game = newGame(); start(game); game.money = 2000; openWorkshop(game); openShop(game);
	for (const [rank, cost] of [100, 160, 260, 410, 660].entries()) {
		const choice = workshopServices(game).find(c => c.id === "armour"); expect(choice.cost).toBe(cost); expect(choice.key).toBe("A");
		expect(choice.description).toContain(`${(rank + 1) * 10}%`); const before = game.money;
		purchaseService(game, "armour"); expect(game.parts.armour).toBe(rank + 1); expect(game.money).toBe(before - cost);
	}
	expect(workshopServices(game).find(c => c.id === "armour")).toBeUndefined(); const capped = JSON.stringify(game); purchaseService(game, "armour"); expect(JSON.stringify(game)).toBe(capped);
	closeShop(game); closeWorkshop(game); chooseHive(game, game.hives[0].id); expect(game.parts.armour).toBe(5);
	const before = JSON.stringify(game); purchaseService(game, "armour"); expect(JSON.stringify(game)).toBe(before); expect(newGame().parts.armour).toBe(0);
	const poor = newGame(); poor.mode = "shop"; poor.money = 99; purchaseService(poor, "armour"); expect(poor.parts.armour).toBe(0); expect(poor.money).toBe(99);
});

test("bugpedia displays current hive damage without changing friendly blast damage or armour stats", () => {
	expect(bugEntry("burrower", 0).attack).toBe("10 contact damage"); expect(bugEntry("burrower", 10).attack).toBe("20 contact damage");
	expect(bugEntry("lunger", 0).attack).toContain("15 charging / 10 normal"); expect(bugEntry("clickBeetle", 0).attack).toContain("13 impact");
	expect(bugEntry("explodingAnt", 20).attack).toBe("45 mech / 8 bug damage · 75-unit radius"); expect(bugEntry("assassin", 20).attack).toContain("up to 10 armour health");
});
