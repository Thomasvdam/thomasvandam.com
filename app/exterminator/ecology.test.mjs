import { expect, test } from "bun:test";
import { createBug, defaultBugWeights } from "./bug-types";
import { bugForSpawn, separateBugs, stepBugs } from "./bugs";
import { ANT_BROOD, COLONY_LIMIT, EGG_HATCH_TIME, SLIME_LIFETIME, colonyIndex, spawnQueenGuards } from "./ecology";
import { FIELD, newGame, start, chooseHive, step, togglePause, clearCombat } from "./game";
import { createHives } from "./hives";
import { viewFromGame } from "./runtime";
const idle = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: false };
function setup() { const game = newGame(47); start(game); chooseHive(game, game.hives[0].id); game.toSpawn = 1; game.spawnTimer = 10000; game.player.invulnerable = 10000; game.player.x = 200; return game; }
function bug(game, variant, x = 800, y = 360) { const enemy = createBug({ variant, id: game.nextId++, position: { x, y }, player: game.player, threat: 1, wave: 1, time: game.time, bounds: FIELD }); game.enemies.push(enemy); return enemy; }
function advance(game, seconds, input = idle) { for (let i = 0; i < Math.round(seconds * 120); i++) step(game, input, 1 / 120); }
function shoot(game, x, y, vx, damage = 1, weapon = "cannon", blastRadius = 0) { game.bullets.push({ id: game.nextId++, x, y, vx, vy: 0, damage, life: 1, weapon, blastRadius }); }
function queen(game, x = 800, y = 360) { const enemy = bug(game, "queen", x, y); spawnQueenGuards(game, enemy, FIELD); return enemy; }

test("slugs wander independently of player movement and leave a connected, time-limited slime trail", () => {
	const game = setup(), slug = bug(game, "slug", 500, 300), initial = { x: slug.x, y: slug.y };
	const other = setup(), second = bug(other, "slug", 500, 300); other.player.y = 650;
	advance(game, 2); advance(other, 2);
	expect({ x: slug.x, y: slug.y, angle: slug.angle }).toEqual({ x: second.x, y: second.y, angle: second.angle });
	expect(Math.hypot(slug.x - initial.x, slug.y - initial.y)).toBeGreaterThan(20); expect(game.slime.length).toBeGreaterThan(4);
	for (let i = 1; i < game.slime.length; i++) { expect(game.slime[i].x).toBe(game.slime[i - 1].end.x); expect(game.slime[i].y).toBe(game.slime[i - 1].end.y); }
	const first = game.slime[0], last = game.slime.at(-1); slug.health = 0; step(game, idle, 1 / 120);
	game.time = first.bornAt + SLIME_LIFETIME - .02; step(game, idle, 1 / 120); expect(game.slime).toContain(first);
	advance(game, .03); expect(game.slime).not.toContain(first); expect(game.slime).toContain(last);
	game.time = last.bornAt + SLIME_LIFETIME; step(game, idle, 1 / 120); expect(game.slime).toHaveLength(0);
});

test("slime halves each undercarriage's actual terrain-adjusted movement, never stacks, and stops affecting speed on expiry", () => {
	for (const undercarriage of ["legs", "wheels", "treads"]) for (const surface of ["firm", "mud", "rubble"]) {
		const distances = [];
		for (const copies of [0, 1, 3]) {
			const game = setup(); game.undercarriage = undercarriage; game.terrain.fill(surface);
			game.slime = Array.from({ length: copies }, () => ({ x: 100, y: 360, end: { x: 400, y: 360 }, bornAt: game.time }));
			step(game, { ...idle, move: { x: 1, y: 0 } }, 1 / 120); distances.push(game.player.x - 200);
			expect(viewFromGame(game).slimed).toBe(copies > 0);
		}
		expect(distances[1]).toBeCloseTo(distances[0] * .5, 8); expect(distances[2]).toBeCloseTo(distances[1], 8);
	}
	const expired = setup(); expired.slime.push({ x: 200, y: 360, end: { x: 200, y: 360 }, bornAt: -15 });
	step(expired, { ...idle, move: { x: 1, y: 0 } }, 1 / 120); expect(viewFromGame(expired).slimed).toBe(false); expect(expired.slime).toHaveLength(0);
});

test("queens arrive with exactly two linked workers after the normal warning, retreat, and lay one egg every six seconds", () => {
	const game = setup(); game.player.x = 500;
	game.spawns.push({ id: game.nextId++, x: 700, y: 360, remaining: .1, variant: "queen" });
	advance(game, .09); expect(game.enemies).toHaveLength(0);
	advance(game, .03); const q = game.enemies.find(enemy => enemy.variant === "queen");
	const workers = game.enemies.filter(enemy => enemy.variant === "worker"); expect(workers).toHaveLength(2);
	for (const worker of workers) expect(worker.state.queenId).toBe(q.id);
	const distance = Math.hypot(q.x - game.player.x, q.y - game.player.y); advance(game, 1);
	expect(Math.hypot(q.x - game.player.x, q.y - game.player.y)).toBeGreaterThan(distance);
	advance(game, 4.8); expect(game.enemies.some(enemy => enemy.variant === "egg")).toBe(false);
	advance(game, .3); const eggs = game.enemies.filter(enemy => enemy.variant === "egg"); expect(eggs).toHaveLength(1);
	expect(eggs[0].state).toEqual({ queenId: q.id, hatchVariant: "worker" }); expect(eggs[0].health).toBe(1);
});

test("eggs hatch into worker, soldier, and bullet ants in order, preserve ownership, and do not count as kills", () => {
	const game = setup(), q = queen(game); q.speed = 0;
	for (let index = 0; index < 3; index++) {
		q.state.layRemaining = 0; step(game, idle, 1 / 120);
		const egg = game.enemies.find(enemy => enemy.variant === "egg"); expect(egg.state.hatchVariant).toBe(ANT_BROOD[index]);
		const id = egg.id, position = { x: egg.x, y: egg.y };
		advance(game, EGG_HATCH_TIME - .02); expect(game.enemies.find(enemy => enemy.id === id).variant).toBe("egg");
		expect({ x: egg.x, y: egg.y }).toEqual(position);
		advance(game, .04); const ant = game.enemies.find(enemy => enemy.id === id);
		expect(ant.variant).toBe(ANT_BROOD[index]); expect(ant.state.queenId).toBe(q.id); expect(ant.health).toBeGreaterThan(0);
		expect(game.kills).toBe(0);
	}
});

test("colonies independently cap living ants plus eggs at twelve, and replace losses without exceeding the cap", () => {
	const game = setup(), a = queen(game), b = queen(game, 850, 150);
	for (let i = 0; i < 2400; i++) { game.time += 1 / 30; stepBugs(game, 1 / 30, FIELD, 14); }
	for (const q of [a, b]) expect(colonyIndex(game.enemies).get(q.id).population).toBe(COLONY_LIMIT);
	const worker = game.enemies.find(enemy => enemy.variant === "worker" && enemy.state.queenId === a.id); worker.health = 0;
	a.state.layRemaining = 0; const before = game.nextId; stepBugs(game, 1 / 120, FIELD, 14);
	expect(game.nextId).toBe(before + 1);
	for (const q of [a, b]) expect(colonyIndex(game.enemies).get(q.id).population).toBe(COLONY_LIMIT);
});

test("workers intercept shots with their own health, while the queen remains vulnerable from another angle", () => {
	const game = setup(), q = queen(game); advance(game, 1.5);
	const workers = game.enemies.filter(enemy => enemy.variant === "worker");
	for (const worker of workers) { expect(worker.x).toBeLessThan(q.x); expect(Math.abs(worker.y - q.y)).toBeLessThan(40); }
	const queenHealth = q.health, total = workers.reduce((sum, enemy) => sum + enemy.health, 0);
	shoot(game, q.x - 150, q.y, 12000); step(game, idle, 1 / 120);
	expect(q.health).toBe(queenHealth); expect(workers.reduce((sum, enemy) => sum + enemy.health, 0)).toBe(total - 1);
	shoot(game, q.x + 50, q.y, -12000); step(game, idle, 1 / 120); expect(q.health).toBe(queenHealth - 1);
});

test("eggs are harmless and destructible by cannon, RPG, and flame before they hatch", () => {
	for (const weapon of ["cannon", "rpg", "flamethrower"]) {
		const game = setup(), egg = bug(game, "egg", 280); game.player.invulnerable = 0;
		const health = game.player.health;
		if (weapon === "flamethrower") { game.weapon = weapon; advance(game, 2, { ...idle, aim: { x: 1, y: 0 }, fire: true }); }
		else { shoot(game, 220, 360, 12000, 1, weapon, weapon === "rpg" ? 60 : 0); step(game, idle, 1 / 120); }
		expect(game.enemies.some(enemy => enemy.id === egg.id)).toBe(false); expect(game.kills).toBe(0); expect(game.player.health).toBe(health);
		advance(game, 4.1); expect(game.enemies).toHaveLength(0);
	}
	const game = setup(); bug(game, "egg", 200); game.player.invulnerable = 0; advance(game, 1); expect(game.player.health).toBe(100);
});

test("queen death preserves eggs and ants; orphans guard eggs then wander, and pending eggs prevent wave completion", () => {
	const game = setup(), q = queen(game); q.state.layRemaining = 0; step(game, idle, 1 / 120);
	const egg = game.enemies.find(enemy => enemy.variant === "egg"), workers = game.enemies.filter(enemy => enemy.variant === "worker");
	q.health = 0; game.toSpawn = 0; step(game, idle, 1 / 120);
	expect(game.enemies).toContain(egg); for (const worker of workers) expect(game.enemies).toContain(worker);
	advance(game, .5); expect(game.intermission).toBe(0); expect(game.enemies.filter(enemy => enemy.variant === "egg")).toHaveLength(1);
	for (const worker of workers) worker.health = 0; step(game, idle, 1 / 120); expect(game.enemies).toEqual([egg]);
	advance(game, 3.6); const orphan = game.enemies[0]; expect(orphan.variant).toBe("worker"); expect(orphan.state.queenId).toBe(q.id); expect(game.intermission).toBe(0);
	const position = { x: orphan.x, y: orphan.y }; advance(game, .5); expect(Math.hypot(orphan.x - position.x, orphan.y - position.y)).toBeGreaterThan(1);
	orphan.health = 0; step(game, idle, 1 / 120); expect(game.intermission).toBe(3);
});

test("soldiers chase and deal melee damage; bullet ants kite and fire at a locked aim without seeking armoured cover", () => {
	const melee = setup(), soldier = bug(melee, "soldier", 240); melee.player.invulnerable = 0;
	advance(melee, .5); expect(soldier.x).toBeLessThan(240); expect(melee.player.health).toBe(80);
	const game = setup(); game.player.x = 400; const ant = bug(game, "bulletAnt", 750), armour = bug(game, "armoured", 600, 500); armour.speed = 0;
	step(game, idle, 1 / 120); expect(ant.x).toBeLessThan(750); expect(ant.y).toBe(360); expect(ant.state).not.toHaveProperty("coverId");
	ant.x = 700; ant.state.remaining = 0; step(game, idle, 1 / 120); expect(ant.state.phase).toBe("windup");
	const target = { ...ant.state.target }; game.player.y = 550;
	advance(game, .6); expect(game.acid).toHaveLength(1); expect(game.acid[0].owner).toBe(ant.id); expect(game.acid[0].vx).toBeLessThan(0); expect(game.acid[0].vy).toBeCloseTo(0); expect(target.y).toBe(360);
});

test("slime, eggs, laying, and ranged windups freeze on pause; wave replacement and base return clear ecology", () => {
	const game = setup(), q = queen(game); bug(game, "slug", 400, 300); const ant = bug(game, "bulletAnt", 500); ant.state.remaining = 0;
	q.state.layRemaining = 0; step(game, idle, 1 / 120); expect(game.slime.length).toBeGreaterThan(0); expect(game.enemies.some(enemy => enemy.variant === "egg")).toBe(true);
	togglePause(game); const frozen = JSON.stringify(game); advance(game, 10); expect(JSON.stringify(game)).toBe(frozen);
	togglePause(game); clearCombat(game); expect(game.slime).toEqual([]); expect(game.enemies).toEqual([]); expect(game.acid).toEqual([]);
	game.slime.push({ x: 1, y: 1, end: { x: 2, y: 2 }, bornAt: game.time }); game.wave = 3; game.toSpawn = 0; game.intermission = .001; step(game, idle, 1 / 120);
	expect(game.mode).toBe("base"); expect(game.slime).toEqual([]); expect(newGame().slime).toEqual([]);
});

test("slugs unlock in hives eight through ten and queens in hive eleven, ants only arrive via colonies, and hive intel names that relationship", () => {
	let slugHive = null;
	for (let cleared = 0; cleared < 15; cleared++) {
		const weights = defaultBugWeights(cleared), variants = new Set(Array.from({ length: 200 }, (_, index) => bugForSpawn(cleared, 1, index)));
		if (variants.has("slug") && slugHive === null) slugHive = cleared + 1;
		expect(variants.has("slug")).toBe(slugHive !== null); expect(variants.has("queen")).toBe(cleared >= 10);
		for (const type of ["worker", "soldier", "bulletAnt", "egg"]) expect(weights[type]).toBe(0);
	}
	expect(slugHive).toBeGreaterThanOrEqual(8); expect(slugHive).toBeLessThanOrEqual(10);
	let exclusion;
	for (let seed = 0; seed < 100 && !exclusion; seed++) exclusion = createHives(seed, 10).find(hive => hive.enemyMix.kind === "none" && hive.enemyMix.types.includes("queen"));
	expect(exclusion).toBeDefined();
	for (let wave = 1; wave <= 3; wave++) for (let i = 0; i < 100; i++) expect(bugForSpawn(10, wave, i, exclusion.enemyMix.weights)).not.toBe("queen");
	const game = setup(); game.hives = [exclusion]; game.parts.sensor = 3; expect(viewFromGame(game).hives[0].enemyMix).toBe("No Queen ant colony");
});


test("the crowd grid catches overlapping large queens across the old cell boundary", () => {
	const game = setup(), a = bug(game, "queen", 47.9, 300), b = bug(game, "queen", 96.1, 300);
	separateBugs(game.enemies, FIELD);
	expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(49.98);
});
