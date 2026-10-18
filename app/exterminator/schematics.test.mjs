import { extractSchematic } from "./courier";
import { expect, test } from "bun:test";
import { createBug, defaultBugWeights } from "./bug-types";
import { chooseHive, chooseUndercarriage, chooseWeapon, clearCombat, FIELD, newGame, start, step, undercarriageChoices, weaponChoices } from "./game";
import { createHives } from "./hives";
import { createSchematicProgress, normalizeSchematics, SCHEMATICS, SCHEMATIC_STORAGE_KEY, schematicForHive } from "./schematics";
import { setDebug, spawnDebugWave, defaultComposition } from "./debug";
import { canAttackLights } from "./light-threats";
import { lightAt } from "./lighting";
import { nextMenuSelection, viewFromGame } from "./runtime";
const idle = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: false };
function setup(cleared = 2, known = [], seed = 47) {
	const game = newGame(seed, "legs", known); game.hivesCleared = cleared; game.hives = createHives(seed, cleared);
	start(game); chooseHive(game, game.hives[0].id); game.player.invulnerable = 1000; game.toSpawn = 1; game.spawnTimer = 1000; return game;
}
const courier = game => game.enemies.find(e => e.variant === "courier");
function advance(game, seconds, input = idle) { for (let i = 0; i < Math.round(seconds * 120); i++) step(game, input, 1 / 120); }
function finishWave(game) {
	game.enemies = game.enemies.filter(e => e.variant === "courier"); game.spawns = []; game.toSpawn = 0;
	step(game, idle, 1 / 120); expect(game.intermission).toBeGreaterThan(0);
	game.intermission = .001; step(game, idle, 1 / 120);
}
function killCourier(game) { courier(game).health = 0; step(game, idle, 1 / 120); }
function storage(initial = null) {
	let raw = initial, writes = 0;
	return { getItem: () => raw, setItem: (key, value) => { expect(key).toBe(SCHEMATIC_STORAGE_KEY); raw = value; writes++; }, raw: () => raw, writes: () => writes };
}

test("fresh players have only cannon and legs, and every selection path respects schematic locks", () => {
	const game = newGame(); expect(game.weapon).toBe("cannon"); expect(game.undercarriage).toBe("legs");
	expect(weaponChoices(game).filter(c => !c.locked).map(c => c.id)).toEqual(["cannon"]);
	expect(undercarriageChoices(game).filter(c => !c.locked).map(c => c.id)).toEqual(["legs"]);
	game.mode = "weapons"; for (const id of ["shotgun", "rpg", "flamethrower"]) chooseWeapon(game, id); expect(game.weapon).toBe("cannon");
	game.mode = "workshop"; for (const id of ["wheels", "treads"]) chooseUndercarriage(game, id); expect(game.undercarriage).toBe("legs");
	expect(newGame(1, "wheels").undercarriage).toBe("legs");
	const recovered = newGame(1, "legs", ["shotgun", "wheels"]); recovered.mode = "weapons"; chooseWeapon(recovered, "shotgun"); expect(recovered.weapon).toBe("shotgun");
	recovered.mode = "workshop"; chooseUndercarriage(recovered, "wheels"); expect(recovered.undercarriage).toBe("wheels");
});

test("controller navigation skips locked cards in both directions without changing stable number shortcuts", () => {
	const game = newGame(); game.mode = "weapons"; const choices = viewFromGame(game).choices;
	expect(choices.map(c => c.key)).toEqual(["1", "2", "3", "4", "5"]);
	expect(nextMenuSelection(choices, 0, 1)).toBe(4); expect(nextMenuSelection(choices, 4, -1)).toBe(0);
	game.schematics = ["rpg"]; const unlocked = viewFromGame(game).choices;
	expect(nextMenuSelection(unlocked, 0, 1)).toBe(2); expect(nextMenuSelection(unlocked, 2, 1)).toBe(4);
});

test("one optional courier appears only in hives 3, 6, 9, and never enters ordinary hive weights", () => {
	for (let cleared = 0; cleared < 12; cleared++) {
		const game = setup(cleared), expected = (cleared + 1) % 3 === 0;
		expect(!!courier(game)).toBe(expected); expect(game.schematicReward !== null).toBe(expected); expect(defaultBugWeights(cleared).courier).toBe(0);
		expect(viewFromGame(game).enemies).toBe(1); // The scheduled combat spawn excludes the optional actor.
	}
	const complete = setup(2, SCHEMATICS); expect(courier(complete)).toBeUndefined(); expect(complete.schematicReward).toBeNull();
});

test("rewards vary with the run seed and randomly exhaust only the remaining schematics", () => {
	const first = new Set(Array.from({ length: 100 }, (_, seed) => schematicForHive(seed, 2, []))); expect(first.size).toBe(5);
	const known = [];
	for (let cleared = 2; cleared < 15; cleared += 3) { const next = schematicForHive(47, cleared, known); expect(SCHEMATICS).toContain(next); expect(known).not.toContain(next); known.push(next); }
	expect(new Set(known).size).toBe(5); expect(schematicForHive(47, 17, known)).toBeNull();
});

test("an ignored courier persists with identity and health through three waves, then expires without stalling extraction", () => {
	const game = setup(), actor = courier(game); actor.health = 2;
	finishWave(game); expect(game.wave).toBe(2); expect(courier(game)).toBe(actor); expect(actor.health).toBe(2);
	finishWave(game); expect(game.wave).toBe(3); expect(courier(game)).toBe(actor); expect(actor.health).toBe(2);
	finishWave(game); expect(game.mode).toBe("base"); expect(game.hivesCleared).toBe(3); expect(game.schematics).toEqual([]); expect(courier(game)).toBeUndefined();
	chooseHive(game, game.hives[0].id); expect(courier(game)).toBeUndefined();
	const next = setup(5); expect(courier(next)).toBeDefined();
});

test("courier kills carry a schematic through waves but do not unlock it until the hive returns to base", () => {
	const game = setup(), reward = game.schematicReward; killCourier(game);
	expect(game.carriedSchematic).toBe(reward); expect(game.schematics).toEqual([]); expect(viewFromGame(game).carriedSchematic).not.toBeNull();
	extractSchematic(game); expect(game.schematics).toEqual([]);
	finishWave(game); expect(game.carriedSchematic).toBe(reward); expect(game.schematics).toEqual([]);
	finishWave(game); expect(game.carriedSchematic).toBe(reward);
	finishWave(game); expect(game.mode).toBe("base"); expect(game.schematics).toEqual([reward]); expect(game.lastSchematic).toBe(reward); expect(game.carriedSchematic).toBeNull();
	expect([...weaponChoices(game), ...undercarriageChoices(game)].find(c => c.id === reward).locked).toBe(false);
});

test("courier can still be captured during the final wave's automatic return countdown", () => {
	const game = setup(); finishWave(game); finishWave(game); game.toSpawn = 0; game.spawns = []; step(game, idle, 1 / 120);
	expect(game.intermission).toBe(3); const reward = game.schematicReward; killCourier(game); game.intermission = .001; step(game, idle, 1 / 120);
	expect(game.mode).toBe("base"); expect(game.schematics).toEqual([reward]);
});

test("death before extraction destroys cargo and a new run restarts eligibility while keeping only recovered ownership", () => {
	const game = setup(2, ["shotgun"]); killCourier(game); expect(game.carriedSchematic).not.toBeNull();
	game.player.invulnerable = 0; game.player.health = 10;
	game.acid.push({ id: game.nextId++, owner: -1, x: game.player.x, y: game.player.y, vx: 0, vy: 0, life: 1 }); step(game, idle, 1 / 120);
	expect(game.mode).toBe("dead"); expect(game.carriedSchematic).toBeNull(); expect(game.schematics).toEqual(["shotgun"]);
	const fresh = newGame(88, "legs", game.schematics); expect(fresh.hivesCleared).toBe(0); expect(fresh.carriedSchematic).toBeNull(); expect(fresh.schematics).toEqual(["shotgun"]); expect(fresh.parts.weapons.shotgun.damage).toBe(0);
});

test("all real weapons can kill and collect the courier without a separate pickup", () => {
	for (const weapon of ["cannon", "shotgun", "rpg", "flamethrower"]) {
		const game = setup(2, SCHEMATICS.filter(id => id !== "treads")), actor = courier(game); game.weapon = weapon;
		game.player.x = 500; game.player.y = 360; actor.x = 570; actor.y = 353.75; actor.speed = 0;
		for (let i = 0; i < 240 && game.carriedSchematic === null; i++) step(game, { move: { x: 0, y: 0 }, aim: { x: 1, y: 0 }, fire: true }, 1 / 120);
		expect(game.carriedSchematic, weapon).toBe("treads"); expect(game.schematics).not.toContain("treads"); expect(game.remains.some(r => r.variant === "courier")).toBe(true);
	}
});

test("courier is harmless, flees the mech, prefers darkness, stays in bounds and pauses with combat", () => {
	const game = setup(), actor = courier(game); game.player.invulnerable = 0;
	actor.x = game.player.x; actor.y = game.player.y; actor.state.seekRemaining = 0;
	advance(game, .5); expect(game.player.health).toBe(100); expect(Math.hypot(actor.x - game.player.x, actor.y - game.player.y)).toBeGreaterThan(40);
	const target = actor.state.destination; expect(lightAt(game, target.x, target.y)).toBeLessThan(.42); expect(canAttackLights("courier")).toBe(false);
	advance(game, 10); expect(actor.x).toBeGreaterThanOrEqual(9); expect(actor.y).toBeGreaterThanOrEqual(9); expect(actor.x).toBeLessThanOrEqual(FIELD.width - 9); expect(actor.y).toBeLessThanOrEqual(FIELD.height - 9);
	game.mode = "paused"; const before = JSON.stringify(game); advance(game, 1); expect(JSON.stringify(game)).toBe(before);
});

test("debug replacement and hash toggles discard cargo; debug couriers never award permanent gear", () => {
	const game = setup(); killCourier(game); setDebug(game, true); expect(game.carriedSchematic).toBeNull(); expect(game.schematicReward).toBeNull();
	const actor = createBug({ variant: "courier", id: game.nextId++, position: game.player, player: game.player, threat: 1, wave: 1, time: game.time, bounds: FIELD }); actor.state.schematic = "rpg"; actor.health = 0; game.enemies.push(actor);
	step(game, idle, 1 / 120); expect(game.carriedSchematic).toBeNull(); expect(game.schematics).toEqual([]);
	spawnDebugWave(game, defaultComposition()); expect(game.schematics).toEqual([]); clearCombat(game); expect(game.schematicReward).toBeNull();
});

test("browser saves contain only extracted unlocks and survive new progression instances, death and reload", () => {
	const disk = storage(), progress = createSchematicProgress(disk), game = setup(2, ["shotgun"]);
	progress.remember(game.schematics); const writes = disk.writes(); killCourier(game);
	expect(disk.writes()).toBe(writes); expect(createSchematicProgress(disk).read()).toEqual(["shotgun"]);
	const reward = game.carriedSchematic; finishWave(game); finishWave(game); finishWave(game); progress.remember(game.schematics);
	expect(createSchematicProgress(disk).read()).toEqual(["shotgun", reward]); expect(JSON.parse(disk.raw())).toEqual({ version: 1, unlocked: ["shotgun", reward] });
});

test("save loading validates data, deduplicates ids, handles corrupt/blocked storage and keeps session ownership", () => {
	expect(normalizeSchematics(["shotgun", "shotgun", "cannon", "legs", "unknown", null, {}, "wheels"])).toEqual(["shotgun", "wheels"]);
	for (const raw of [null, "invalid", "null", "[]", '{"version":2,"unlocked":["rpg"]}', '{"version":1,"unlocked":"rpg"}']) expect(createSchematicProgress(storage(raw)).read()).toEqual([]);
	const disk = storage('{"version":1,"unlocked":["rpg","bad","rpg"]}'); const progress = createSchematicProgress(disk); expect(progress.read()).toEqual(["rpg"]);
	progress.remember(["wheels"]); expect(progress.read()).toEqual(["rpg", "wheels"]);
	const blocked = createSchematicProgress({ getItem: () => { throw Error("blocked"); }, setItem: () => { throw Error("quota"); } });
	expect(blocked.read()).toEqual([]); blocked.remember(["treads"]); expect(blocked.persistent).toBe(false); expect(blocked.read()).toEqual(["treads"]);
	const session = createSchematicProgress(null); session.remember(["flamethrower"]); expect(session.read()).toEqual(["flamethrower"]); expect(session.persistent).toBe(false);
});


test("a courier kill and fatal hit in the same step cannot bank the schematic", () => {
	for (const cause of ["acid", "contact"]) {
		const game = setup(); courier(game).health = 0; game.player.health = 10; game.player.invulnerable = 0;
		if (cause === "acid") game.acid.push({ id: game.nextId++, owner: -1, x: game.player.x, y: game.player.y, vx: 0, vy: 0, life: 1 });
		else { const enemy = createBug({ variant: "burrower", id: game.nextId++, position: game.player, player: game.player, threat: 1, wave: 1, time: game.time, bounds: FIELD }); enemy.speed = 0; game.enemies.push(enemy); }
		step(game, idle, 1 / 120); expect(game.mode).toBe("dead"); expect(game.carriedSchematic).toBeNull(); expect(game.schematics).toEqual([]);
	}
});
