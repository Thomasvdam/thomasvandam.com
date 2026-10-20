import { expect, test } from "bun:test";
import { createBug } from "./bug-types";
import { BOSS_TYPES, bossForHive } from "./boss-types";
import { createBoss, stepBoss, firstBossHit, bossCircles, damageBoss, clawPosition, blastBoss, flameBoss } from "./bosses";
import { chooseHive, clearCombat, newGame, start, step, FIELD } from "./game";
import { createHives } from "./hives";
import { recordVisibleEncounters, createEncounterProgress } from "./encounters";
import { setDebug, spawnDebugBoss, spawnDebugWave, defaultComposition } from "./debug";
import { viewFromGame } from "./runtime";
import { activeClaw } from "./boss-patterns";
const idle = { move: { x: 0, y: 0 }, aim: { x: 1, y: 0 }, fire: false };
function setup(cleared = 4, seed = 47) { const game = newGame(seed); game.hivesCleared = cleared; game.hives = createHives(seed, cleared); start(game); chooseHive(game, game.hives[0].id); game.toSpawn = 0; game.spawns = []; game.enemies = []; game.player.invulnerable = 1000; return game; }
function advance(game, seconds, input = idle) { for (let i = 0; i < Math.round(seconds * 120); i++) step(game, input, 1 / 120); }
function fight(variant) { const game = setup(); game.toSpawn = 1; game.spawnTimer = 1000; game.terrain.fill("firm"); game.boss = createBoss(variant, game.hivesCleared, game.player); game.boss.x = 400; game.boss.y = 360; game.boss.angle = 0; return game; }

test("hives 5, 10, 15 draw a complete unique permutation; order is seeded independently of offers", () => {
	const orders = new Set();
	for (let seed = 0; seed < 300; seed++) {
		const order = [4, 9, 14].map(cleared => bossForHive(seed, cleared)); expect(new Set(order)).toEqual(new Set(BOSS_TYPES)); orders.add(order.join(","));
		for (let cleared = 0; cleared < 24; cleared++) { createHives(seed, cleared); expect(bossForHive(seed, cleared) !== null).toBe([4, 9, 14].includes(cleared)); }
		expect([4, 9, 14].map(c => bossForHive(seed, c))).toEqual(order);
	}
	expect(orders.size).toBe(6);
});

test("boss appears only after wave 3, fights alone, gates payment and counts one kill before base return", () => {
	for (const cleared of [3, 4, 9, 14, 15]) {
		const game = setup(cleared), payment = game.hive.payment;
		for (let wave = 1; wave <= 3; wave++) {
			expect(game.wave).toBe(wave); step(game, idle, 1 / 120); expect(game.intermission).toBe(3); expect(game.boss).toBeNull();
			game.intermission = .001; step(game, idle, 1 / 120);
			if (wave < 3) { game.toSpawn = 0; game.spawns = []; game.enemies = []; }
		}
		if ([4, 9, 14].includes(cleared)) {
			expect(game.mode).toBe("playing"); expect(game.money).toBe(0); expect(game.boss.variant).toBe(bossForHive(game.runSeed, cleared)); expect(game.enemies).toHaveLength(0); expect(game.toSpawn).toBe(0);
			advance(game, 3); expect(game.wave).toBe(3); expect(game.intermission).toBe(0); expect(game.money).toBe(0);
			game.boss.health = 0; step(game, idle, 1 / 120); expect(game.kills).toBe(1); expect(game.intermission).toBe(3);
			game.intermission = .001; step(game, idle, 1 / 120);
		}
		expect(game.mode).toBe("base"); expect(game.money).toBe(payment); expect(game.hivesCleared).toBe(cleared + 1); expect(game.boss).toBeNull();
	}
});

function until(game, phase, max = 8) {
	for (let i = 0; i < max * 120 && game.boss.phase !== phase; i++) step(game, idle, 1 / 120);
	expect(game.boss.phase).toBe(phase);
}

test("rhino locks a wall-length charge and exposes its flanks only after impact", () => {
	const game = fight("rhinoceros"), boss = game.boss; game.player.x = 750; boss.remaining = 0;
	stepBoss(game, 1 / 120, game.player); expect(boss.phase).toBe("chargeWindup");
	expect(boss.target.x).toBe(FIELD.width - 42);
	const angle = boss.angle, target = { ...boss.target }; game.player.y = 500;
	until(game, "charge"); expect(boss.angle).toBe(angle); expect(boss.target).toEqual(target);
	const shielded = boss.health; damageBoss(boss, 4, game.time); expect(shielded - boss.health).toBeCloseTo(.4);
	until(game, "stuck"); expect(boss.x).toBeCloseTo(FIELD.width - 42); expect(boss.rhino.rocks.length).toBeGreaterThan(0);
	const exposed = boss.health; damageBoss(boss, 4, game.time, "flank"); expect(exposed - boss.health).toBe(12);
});

test("scorpion claws have independent hitboxes and health, removed claws cannot sweep, sting can be dodged", () => {
	const game = fight("scorpion"), boss = game.boss, left = clawPosition(boss, 0), right = clawPosition(boss, 1);
	const hit = firstBossHit(boss, { x: left.x + 90, y: left.y }, left); expect(hit.circle.part).toBe("leftClaw");
	damageBoss(boss, 30, game.time, "leftClaw"); expect(boss.claws).toEqual([0, 30]); expect(bossCircles(boss).some(c => c.part === "leftClaw")).toBe(false); expect(bossCircles(boss).find(c => c.part === "rightClaw").x).toBe(right.x);
	boss.phase = "approach"; boss.remaining = 0; boss.attackIndex = 0; stepBoss(game, .01, game.player); expect(boss.phase).toBe("clawWindup"); expect(activeClaw(boss)).toBe(1);
	until(game, "stingWindup");
	const target = { ...boss.target }; game.player.y += 150; advance(game, 1.2); expect(boss.target).toEqual(target); expect(game.player.health).toBe(100); advance(game, .3); expect(boss.phase).toBe("embedded");
	const before = boss.health; damageBoss(boss, 4, game.time, "stinger"); expect(before - boss.health).toBe(12);
});


test("every weapon can damage every boss and RPG/flame do not multiply damage across millipede segments", () => {
	for (const variant of BOSS_TYPES) for (const weapon of ["cannon", "shotgun", "rpg", "flamethrower"]) {
		const game = fight(variant), boss = game.boss; boss.phase = variant === "millipede" ? "acid" : "recover"; boss.remaining = 100;
		boss.x = game.player.x + 90; boss.y = game.player.y; if (variant === "millipede") boss.segments = Array.from({ length: 8 }, (_, i) => ({ x: boss.x + (i + 1) * 22, y: boss.y }));
		if (variant === "millipede") { game.player.x = 570; game.player.y = 200; }
		game.weapon = weapon; const before = boss.health; advance(game, .3, { ...idle, aim: variant === "millipede" ? { x: 0, y: -1 } : idle.aim, fire: true }); expect(boss.health, `${variant}/${weapon}`).toBeLessThan(before);
	}
});

test("pause, death and debug replacement freeze or clear boss state; manual bosses do not alter seeded order", () => {
	const game = fight("scorpion"); game.mode = "paused"; const before = JSON.stringify(game); advance(game, 3); expect(JSON.stringify(game)).toBe(before);
	game.mode = "playing"; setDebug(game, true); const order = [4, 9, 14].map(c => bossForHive(game.runSeed, c)); spawnDebugBoss(game, "millipede"); expect(game.boss.variant).toBe("millipede"); expect(game.enemies).toHaveLength(0);
	spawnDebugWave(game, defaultComposition()); expect(game.boss).toBeNull(); expect([4, 9, 14].map(c => bossForHive(game.runSeed, c))).toEqual(order);
	spawnDebugBoss(game, "rhinoceros"); game.mode = "dead"; const dead = JSON.stringify(game); advance(game, 1); expect(JSON.stringify(game)).toBe(dead); clearCombat(game); expect(game.boss).toBeNull(); expect(newGame().boss).toBeNull();
});

test("bosses enter bugpedia only when their illuminated body is on screen and persist in browser saves", () => {
	const game = fight("scorpion"); game.player.angle = 0; game.boss.x = game.player.x + 120; game.boss.y = game.player.y;
	recordVisibleEncounters(game, 390, 500); expect(game.encounters).toContain("scorpion");
	game.encounters = []; game.boss.x = game.player.x + 500; recordVisibleEncounters(game, 390, 500); expect(game.encounters).toEqual([]);
	const progress = createEncounterProgress(null); progress.remember(["scorpion", "burrower"]); expect(progress.read()).toContain("scorpion");
	expect(viewFromGame(game).boss.name).toBe("Scorpion"); expect(viewFromGame(game).enemies).toBe(2); // one scheduled spawn plus boss
});


test("area attacks hit shared millipede health once and the nearest boss blocks shots to bugs behind it", () => {
	const game = fight("millipede"), boss = game.boss; boss.phase = "crossing"; boss.segments = Array.from({ length: 8 }, () => ({ x: boss.x - 30, y: boss.y }));
	const before = boss.health; blastBoss(game, boss, 200, 4); expect(before - boss.health).toBe(12);
	const after = boss.health; flameBoss(game, { x: boss.x - 90, y: boss.y }, 0, 250, Math.PI / 4, 2); expect(after - boss.health).toBe(6);
	const blocked = fight("rhinoceros"); blocked.boss.x = blocked.player.x + 80; blocked.boss.phase = "recover"; blocked.boss.remaining = 100;
	const bug = createBug({ variant: "burrower", id: 99, position: { x: blocked.player.x + 180, y: blocked.player.y }, player: blocked.player, time: 0, threat: 1, wave: 1, bounds: FIELD }); bug.speed = 0; blocked.enemies.push(bug);
	blocked.bullets.push({ id: 100, x: blocked.player.x + 25, y: blocked.player.y, vx: 12000, vy: 0, life: 1, weapon: "cannon", damage: 1, blastRadius: 0 });
	const bossHealth = blocked.boss.health; step(blocked, idle, 1 / 120); expect(blocked.boss.health).toBeCloseTo(bossHealth - .1); expect(bug.health).toBe(1);
});


test("schematic cargo unlocks only after the milestone boss, and dying during the duel loses cargo and payment", () => {
	const game = setup(14); game.carriedSchematic = "shotgun"; game.wave = 3; game.intermission = .001;
	step(game, idle, 1 / 120); expect(game.boss).not.toBeNull(); expect(game.carriedSchematic).toBe("shotgun"); expect(game.schematics).not.toContain("shotgun");
	game.boss.health = 0; step(game, idle, 1 / 120); game.intermission = .001; step(game, idle, 1 / 120); expect(game.mode).toBe("base"); expect(game.schematics).toContain("shotgun");
	const dead = fight("rhinoceros"); dead.carriedSchematic = "shotgun"; dead.player.health = 5; dead.player.invulnerable = 0; dead.boss.x = dead.player.x; dead.boss.y = dead.player.y;
	step(dead, idle, 1 / 120); expect(dead.mode).toBe("dead"); expect(dead.money).toBe(0); expect(dead.carriedSchematic).toBeNull(); expect(dead.schematics).not.toContain("shotgun");
});

// Exercise real input and terrain speed, with no armour, upgrades or invulnerability.
// A brief reaction delay is included; standing in the same footprint must get hit.
function attackScene(kind, terrain) {
	const game = fight(kind === "sting" || kind === "claw" || kind === "rightClaw" || kind === "dash" ? "scorpion" : "rhinoceros");
	const boss = game.boss; game.terrain.fill(terrain); game.player.x = 500; game.player.y = 360;
	if (kind === "charge" || kind === "dash" || kind === "claw") { boss.phase = "approach"; boss.remaining = 0; if (kind === "dash") game.player.x = 680; }
	if (kind === "sweep") { boss.x = 1078; boss.angle = Math.PI; boss.phase = "rising"; boss.remaining = 1; boss.rhino.riseAngle = Math.PI; game.player.x = 978; }
	if (kind === "sting" || kind === "rightClaw") { boss.phase = "claw"; boss.remaining = 0; boss.comboStep = kind === "sting" ? 1 : 0; }
	stepBoss(game, 1 / 120, game.player); game.player.health = 100; game.player.invulnerable = 0;
	const duration = boss.remaining;
	return { game, duration };
}

test("rhino/scorpion attacks are escapable with existing movement from good terrain", () => {
	for (const terrain of ["firm"]) for (const kind of ["charge", "sweep", "claw", "rightClaw", "sting", "dash"]) {
		const { game, duration } = attackScene(kind, terrain), boss = game.boss;
		const initialPhase = boss.phase, target = { ...boss.target }, angle = boss.angle;
		const direction = kind === "sweep" ? { x: -1, y: 0 } : kind === "claw" ? { x: 0, y: 1 } : kind === "rightClaw" ? { x: 0, y: -1 } : { x: 0, y: 1 };
		// Let the player recognise the tell before starting movement.
		advance(game, .2);
		for (let i = 0; i < Math.ceil((duration - .2) * 120); i++) {
			if (boss.phase === initialPhase) { expect(boss.target).toEqual(target); expect(boss.angle).toBe(angle); }
			step(game, { ...idle, move: direction }, 1 / 120);
		}
		// Check the committed strike, ending before the next wind-up can resolve.
		advance(game, kind === "charge" || kind === "dash" ? .6 : .25);
		expect(game.player.health, `${kind}/${terrain}: escape`).toBe(100);
		const standing = attackScene(kind, terrain);
		advance(standing.game, standing.duration + (kind === "charge" || kind === "dash" ? .7 : .2));
		// Dash closes space rather than reaching a far-away stationary player.
		if (kind !== "dash") expect(standing.game.player.health, `${kind}/${terrain}: standing`).toBeLessThan(100);
	}
});

test("scorpion plays both claws then delayed sting without passive recovery between hits", () => {
	const game = fight("scorpion"), boss = game.boss; game.player.x = 550; game.player.y = 360; boss.remaining = 0;
	const sequence = []; let previous = "";
	for (let i = 0; i < 6 * 120 && boss.phase !== "embedded"; i++) {
		step(game, idle, 1 / 120);
		const state = `${boss.phase}:${boss.phase.startsWith("claw") ? activeClaw(boss) : ""}`;
		if (state !== previous) sequence.push(state); previous = state;
	}
	expect(sequence).toEqual(["clawWindup:0", "claw:0", "clawWindup:1", "claw:1", "stingWindup:", "sting:", "embedded:"]);
	boss.claws = [0, 0]; boss.phase = "approach"; boss.remaining = 0; stepBoss(game, 1 / 120, game.player); expect(boss.phase).toBe("stingWindup");
});


test("boss timing is fixed across terrain; late escape from a sting in mud gets punished", () => {
	for (const kind of ["charge", "sweep", "claw", "rightClaw", "sting", "dash"]) {
		const firm = attackScene(kind, "firm"), mud = attackScene(kind, "mud"), rubble = attackScene(kind, "rubble");
		expect(firm.duration).toBe(mud.duration); expect(firm.duration).toBe(rubble.duration);
	}
	for (const terrain of ["firm", "mud"]) {
		const { game, duration } = attackScene("sting", terrain);
		advance(game, .2); advance(game, duration - .2 + .05, { ...idle, move: { x: 0, y: 1 } });
		if (terrain === "firm") expect(game.player.health).toBe(100); else expect(game.player.health).toBeLessThan(100);
	}
});

test("rhino always commits a charge rather than granting a combo-count opening", () => {
	for (const distance of [100, 400]) {
		const game = fight("rhinoceros"), boss = game.boss;
		game.player.x = boss.x + distance; game.player.y = boss.y; boss.remaining = 0;
		stepBoss(game, 1 / 120, game.player);
		expect(boss.phase).toBe("chargeWindup"); expect(boss.target.x).toBe(FIELD.width - 42);
		until(game, "stuck"); expect(boss.rhino.rocks.length).toBeGreaterThan(0);
	}
});

test("scorpion selects claws, a gap-closing dash or a ranged sting by distance", () => {
	for (const [distance, expected] of [[120, "clawWindup"], [270, "chargeWindup"], [500, "stingWindup"]]) {
		const game = fight("scorpion"), boss = game.boss; boss.x = 200; boss.remaining = 0;
		game.player.x = boss.x + distance; game.player.y = boss.y;
		stepBoss(game, 1 / 120, game.player); expect(boss.phase).toBe(expected);
		until(game, "embedded", 12); // Distance pressure cannot deny every opening indefinitely.
	}
	const game = fight("scorpion"), boss = game.boss; boss.phase = "claw"; boss.comboStep = 0; boss.remaining = 0;
	game.player.x = 950; stepBoss(game, 1 / 120, game.player); expect(boss.phase).toBe("stingWindup");
});

test("a far sting punishes running straight; reading its locked prediction and reversing evades it", () => {
	for (const reverse of [false, true]) {
		const game = fight("scorpion"), boss = game.boss; boss.x = 200; boss.remaining = 0;
		game.player.x = 800; game.player.y = 300; game.player.invulnerable = 0;
		step(game, { ...idle, move: { x: 0, y: 1 } }, 1 / 120);
		expect(boss.phase).toBe("stingWindup"); const target = { ...boss.target }, angle = boss.angle;
		for (let i = 0; i < 140; i++) {
			if (boss.phase === "stingWindup") { expect(boss.target).toEqual(target); expect(boss.angle).toBe(angle); }
			step(game, { ...idle, move: { x: 0, y: reverse && i > 24 ? -1 : 1 } }, 1 / 120);
		}
		if (reverse) expect(game.player.health).toBe(100); else expect(game.player.health).toBeLessThan(100);
	}
});

test("all weapons can punish the rhino flank and embedded stinger through actual hit detection", () => {
	for (const variant of ["rhinoceros", "scorpion"]) for (const weapon of ["cannon", "shotgun", "rpg", "flamethrower"]) {
		const game = fight(variant), boss = game.boss; game.weapon = weapon;
		boss.phase = variant === "rhinoceros" ? "stuck" : "embedded"; boss.remaining = 5;
		boss.target = { x: 650, y: 360 };
		game.player.x = variant === "rhinoceros" ? boss.x - 12 : boss.target.x;
		game.player.y = variant === "rhinoceros" ? boss.y + 130 : boss.target.y + 100;
		const hit = firstBossHit(boss, game.player, { x: game.player.x, y: 360 });
		expect(hit.circle.part).toBe(variant === "rhinoceros" ? "flank" : "stinger");
		const health = boss.health; advance(game, .4, { ...idle, aim: { x: 0, y: -1 }, fire: true });
		expect(health - boss.health, `${variant}/${weapon}`).toBeGreaterThan(1);
	}
});

test("armoured hits do chip damage; correct recovery targets deal thirty times as much", () => {
	for (const [variant, phase, part] of [["rhinoceros", "stuck", "flank"], ["scorpion", "embedded", "stinger"]]) {
		const boss = createBoss(variant, 4, { x: 560, y: 360 }); boss.phase = "approach";
		let health = boss.health; damageBoss(boss, 4, 0); const chip = health - boss.health;
		boss.phase = phase; health = boss.health; damageBoss(boss, 4, 0, part);
		expect((health - boss.health) / chip).toBeCloseTo(30);
		health = boss.health; damageBoss(boss, 4, 0, "body"); expect(health - boss.health).toBeCloseTo(.8);
	}
	const game = fight("scorpion"), boss = game.boss; boss.phase = "embedded"; boss.remaining = 1;
	boss.target = { ...game.player }; game.player.invulnerable = 0; stepBoss(game, 1 / 120, game.player);
	expect(game.player.health).toBe(100); // The embedded weak point cannot inflict contact damage.
});
