import { expect, test } from "bun:test";
import { createBug } from "./bug-types";
import { BOSS_TYPES, bossForHive } from "./boss-types";
import { createBoss, stepBoss, firstBossHit, bossCircles, damageBoss, clawPosition, blastBoss, flameBoss } from "./bosses";
import { chooseHive, clearCombat, newGame, start, step, FIELD } from "./game";
import { createHives } from "./hives";
import { recordVisibleEncounters, createEncounterProgress } from "./encounters";
import { setDebug, spawnDebugBoss, spawnDebugWave, defaultComposition } from "./debug";
import { viewFromGame } from "./runtime";
import { activeClaw, BOSS_ATTACKS } from "./boss-patterns";
const rear = boss => ({ x: boss.x - Math.cos(boss.angle) * 100, y: boss.y - Math.sin(boss.angle) * 100 });
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
	const exposed = boss.health; damageBoss(boss, 4, game.time, "flank", rear(boss)); expect(exposed - boss.health).toBe(12);
});

test("scorpion claws have independent hitboxes and health, removed claws cannot sweep, sting can be dodged", () => {
	const game = fight("scorpion"), boss = game.boss, left = clawPosition(boss, 0), right = clawPosition(boss, 1);
	const hit = firstBossHit(boss, { x: left.x + 90, y: left.y }, left); expect(hit.circle.part).toBe("leftClaw");
	damageBoss(boss, 30, game.time, "leftClaw"); expect(boss.claws).toEqual([0, 30]); expect(bossCircles(boss).some(c => c.part === "leftClaw")).toBe(false); expect(bossCircles(boss).find(c => c.part === "rightClaw").x).toBe(right.x);
	boss.phase = "approach"; boss.remaining = 0; boss.attackIndex = 0; stepBoss(game, .01, game.player); expect(boss.phase).toBe("clawWindup"); expect(activeClaw(boss)).toBe(1);
	until(game, "stingWindup");
	advance(game, .65); const target = { ...boss.target }; game.player.y += 150; advance(game, .55); expect(boss.target).toEqual(target); expect(game.player.health).toBe(100); advance(game, .3); expect(boss.phase).toBe("embedded");
	const before = boss.health; damageBoss(boss, 4, game.time, "stinger"); expect(before - boss.health).toBe(12);
});


test("every weapon can damage every boss and RPG/flame do not multiply damage across millipede segments", () => {
	for (const variant of BOSS_TYPES) for (const weapon of ["cannon", "shotgun", "rpg", "flamethrower"]) {
		const game = fight(variant), boss = game.boss; boss.phase = variant === "millipede" ? "acid" : "recover"; boss.remaining = 100;
		boss.x = game.player.x + 90; boss.y = game.player.y; if (variant === "millipede") boss.segments = Array.from({ length: 8 }, (_, i) => ({ x: boss.x + (i + 1) * 22, y: boss.y }));
		if (variant === "millipede") { game.player.x = 570; game.player.y = 200; }
		if (variant === "scorpion") { boss.phase = "embedded"; boss.target = { x: game.player.x + 40, y: game.player.y }; }
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
	const game = fight("millipede"), boss = game.boss; boss.phase = "acid"; boss.segments = Array.from({ length: 8 }, () => ({ x: boss.x - 30, y: boss.y }));
	const before = boss.health; blastBoss(game, boss, 200, 4); expect(before - boss.health).toBe(4);
	const after = boss.health; flameBoss(game, { x: boss.x - 90, y: boss.y }, 0, 250, Math.PI / 4, 2); expect(after - boss.health).toBe(2);
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
	if (kind === "charge" || kind === "dash" || kind === "claw") { boss.phase = "approach"; boss.remaining = 0; if (kind === "dash") game.player.x = 750; }
	if (kind === "sweep") { boss.x = 1078; boss.angle = Math.PI; boss.phase = "rising"; boss.remaining = 1; boss.rhino.riseAngle = Math.PI; game.player.x = 978; }
	if (kind === "sting" || kind === "rightClaw") { boss.phase = "claw"; boss.remaining = 0; boss.comboStep = kind === "sting" ? 1 : 0; }
	stepBoss(game, 1 / 120, game.player); game.player.health = 100; game.player.invulnerable = 0;
	const duration = boss.remaining;
	return { game, duration };
}

test("rhino/scorpion attacks are escapable with existing movement from good terrain", () => {
	for (const terrain of ["firm"]) for (const kind of ["charge", "sweep", "claw", "rightClaw", "dash"]) {
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
		// A committed dash now travels through the player’s original position.
		expect(standing.game.player.health, `${kind}/${terrain}: standing`).toBeLessThan(100);
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
		advance(game, duration - BOSS_ATTACKS.sting.lockTime + .1); advance(game, BOSS_ATTACKS.sting.lockTime - .05, { ...idle, move: { x: 0, y: 1 } });
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

test("scorpion selects claws or a short-range sting nearby and charges distant players", () => {
	for (const [distance, expected] of [[120, "clawWindup"], [240, "stingWindup"], [500, "chargeWindup"]]) {
		const game = fight("scorpion"), boss = game.boss; boss.x = 200; boss.remaining = 0;
		game.player.x = boss.x + distance; game.player.y = boss.y;
		stepBoss(game, 1 / 120, game.player); expect(boss.phase).toBe(expected);
		until(game, "embedded", 12); // Distance pressure cannot deny every opening indefinitely.
	}
	const game = fight("scorpion"), boss = game.boss; boss.phase = "claw"; boss.comboStep = 0; boss.remaining = 0;
	game.player.x = 950; stepBoss(game, 1 / 120, game.player); expect(boss.phase).toBe("chargeWindup");
});

test("tracking sting catches steady strafing; reversing after the red lock avoids it", () => {
	for (const reverse of [false, true]) {
		const game = fight("scorpion"), boss = game.boss;
		boss.x = 400; boss.y = 360; boss.phase = "stingWindup"; boss.remaining = BOSS_ATTACKS.sting.windup;
		game.player.x = 570; game.player.y = 200; game.player.invulnerable = 0;
		let locked = null, elapsedAfterLock = 0;
		for (let i = 0; i < 150; i++) {
			if (boss.phase === "stingWindup" && boss.remaining <= BOSS_ATTACKS.sting.lockTime) {
				if (!locked) locked = { ...boss.target };
				expect(boss.target).toEqual(locked); elapsedAfterLock += 1 / 120;
			}
			step(game, { ...idle, move: { x: 0, y: reverse && elapsedAfterLock > .12 ? -1 : 1 } }, 1 / 120);
		}
		expect(locked).not.toBeNull();
		if (reverse) expect(game.player.health).toBe(100); else expect(game.player.health).toBeLessThan(100);
	}
});

test("all weapons can punish the rhino rear and embedded stinger through actual hit detection", () => {
	for (const variant of ["rhinoceros", "scorpion"]) for (const weapon of ["cannon", "shotgun", "rpg", "flamethrower"]) {
		const game = fight(variant), boss = game.boss; game.weapon = weapon;
		boss.phase = variant === "rhinoceros" ? "stuck" : "embedded"; boss.remaining = 5;
		boss.target = { x: 650, y: 360 };
		game.player.x = variant === "rhinoceros" ? boss.x - 130 : boss.target.x;
		game.player.y = variant === "rhinoceros" ? boss.y : boss.target.y + 100;
		const hit = firstBossHit(boss, game.player, variant === "rhinoceros" ? boss : { x: game.player.x, y: 360 });
		expect(hit.circle.part).toBe(variant === "rhinoceros" ? "flank" : "stinger");
		const health = boss.health; advance(game, .4, { ...idle, aim: variant === "rhinoceros" ? { x: 1, y: 0 } : { x: 0, y: -1 }, fire: true });
		expect(health - boss.health, `${variant}/${weapon}`).toBeGreaterThan(1);
	}
});

test("scorpion shell blocks damage while its embedded tail takes triple damage", () => {
	for (const [variant, phase, part] of [["rhinoceros", "stuck", "flank"], ["scorpion", "embedded", "stinger"]]) {
		const boss = createBoss(variant, 4, { x: 560, y: 360 }); boss.phase = "approach";
		let health = boss.health; damageBoss(boss, 4, 0); const chip = health - boss.health;
		boss.phase = phase; health = boss.health; damageBoss(boss, 4, 0, part, rear(boss));
		if (variant === "rhinoceros") expect((health - boss.health) / chip).toBeCloseTo(30);
		else { expect(chip).toBe(0); expect(health - boss.health).toBe(12); }
		health = boss.health; damageBoss(boss, 4, 0, "body"); expect(health - boss.health).toBeCloseTo(variant === "rhinoceros" ? .4 : 0);
	}
	const game = fight("scorpion"), boss = game.boss; boss.phase = "embedded"; boss.remaining = 1;
	boss.target = { ...game.player }; game.player.invulnerable = 0; stepBoss(game, 1 / 120, game.player);
	expect(game.player.health).toBe(100); // The embedded weak point cannot inflict contact damage.
});

test("millipede projectile broad phase preserves exhaustive hit order, hidden sections and arena-edge hitboxes", async () => {
	const { circleHitTime } = await import("./math");
	const boss = createBoss("millipede", 14, { x: 560, y: 360 });
	let seed = 47; const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
	for (let i = 0; i < boss.segments.length; i++) { boss.segments[i] = { x: random() * 1300 - 90, y: random() * 900 - 90, hidden: i % 7 === 0 }; }
	boss.x = -24; boss.y = 300;
	for (let i = 0; i < 1000; i++) {
		boss.millipede.headHidden = i % 2 === 0; boss.health = i % 31 === 0 ? 0 : 100;
		const from = { x: random() * 1300 - 90, y: random() * 900 - 90 }, to = { x: random() * 1300 - 90, y: random() * 900 - 90 }, radius = i % 15;
		let time = Infinity, circle = null;
		for (const candidate of bossCircles(boss)) { const t = circleHitTime(to, candidate, candidate.radius, from, radius); if (t < time) { time = t; circle = candidate; } }
		expect(firstBossHit(boss, from, to, radius)).toEqual({ time, circle });
	}
});

test("a close sting exposes its final landing point for a brief counterattack", () => {
	const game = fight("scorpion"), boss = game.boss;
	boss.x = 150; boss.y = 200; boss.remaining = 0;
	game.player.x = 390; game.player.y = 200;
	stepBoss(game, 1 / 120, game.player);
	expect(boss.phase).toBe("stingWindup");
	advance(game, .65); const target = { ...boss.target };
	game.player.y += 100;
	until(game, "embedded", 2);
	expect(boss.target).toEqual(target);
	expect(boss.remaining).toBeCloseTo(1.6);
	const stinger = bossCircles(boss).find(circle => circle.part === "stinger");
	// A glancing shot which missed the old 18-unit weak point now connects.
	expect(firstBossHit(boss, { x: target.x - 60, y: target.y + 22 }, { x: target.x + 60, y: target.y + 22 }, 0).circle).toEqual(stinger);
	advance(game, 1.4); expect(boss.phase).toBe("embedded");
	advance(game, .22); expect(boss.phase).toBe("approach");
});

test("breaking the active claw interrupts both its tell and strike without swipe damage", () => {
	for (const phase of ["clawWindup", "claw"]) for (const index of [0, 1]) {
		const game = fight("scorpion"), boss = game.boss;
		boss.phase = phase; boss.comboStep = index; boss.remaining = .1;
		game.player.x = boss.x + 120; game.player.y = boss.y; game.player.invulnerable = 0;
		damageBoss(boss, 30, game.time, index === 0 ? "leftClaw" : "rightClaw");
		stepBoss(game, 1 / 120, game.player);
		expect(boss.phase).toBe("stingWindup"); expect(game.player.health).toBe(100);
		expect(boss.remaining).toBeGreaterThan(1);
	}
});

test("circling and firing loses the duel; reacting to the lock and aiming at the tail wins", () => {
	for (const reactive of [false, true]) {
		const game = fight("scorpion"), boss = game.boss;
		game.player.invulnerable = 0; game.parts.weapons.cannon.damage = 3;
		boss.x = 250; boss.y = 360; game.player.x = 650; game.player.y = 360;
		let side = 1, reversed = false;
		for (let i = 0; i < 30 * 120 && game.mode === "playing" && boss.health > 0; i++) {
			const dx = game.player.x - boss.x, dy = game.player.y - boss.y, distance = Math.hypot(dx, dy) || 1;
			// Allow 120 ms to react after the final target locks.
			if (reactive && boss.phase === "stingWindup" && boss.remaining < BOSS_ATTACKS.sting.lockTime - .12 && !reversed) { side *= -1; reversed = true; }
			if (boss.phase !== "stingWindup") reversed = false;
			const target = reactive && boss.phase === "embedded" ? boss.target : boss;
			step(game, { move: { x: -dy / distance * side, y: dx / distance * side }, aim: { x: target.x - game.player.x, y: target.y - game.player.y }, fire: true }, 1 / 120);
		}
		if (reactive) { expect(boss.health).toBe(0); expect(game.player.health).toBeGreaterThan(50); }
		else { expect(game.player.health).toBe(0); expect(boss.health).toBe(boss.maxHealth); }
	}
});

test("sting tracking has finite reach and freezes through the final dodge beat", () => {
	const game = fight("scorpion"), boss = game.boss;
	boss.phase = "stingWindup"; boss.remaining = BOSS_ATTACKS.sting.windup;
	game.player.x = boss.x + 600;
	stepBoss(game, .1, { x: game.player.x - 20, y: game.player.y });
	expect(Math.hypot(boss.target.x - boss.x, boss.target.y - boss.y)).toBeCloseTo(BOSS_ATTACKS.sting.reach);
	while (boss.remaining > BOSS_ATTACKS.sting.lockTime) stepBoss(game, 1 / 120, game.player);
	const target = { ...boss.target }, angle = boss.angle;
	game.player.y += 200;
	while (boss.phase === "stingWindup") { stepBoss(game, 1 / 120, game.player); expect(boss.target).toEqual(target); expect(boss.angle).toBe(angle); }
});

test("scorpion dash warning and movement agree at an arena edge", () => {
	const game = fight("scorpion"), boss = game.boss;
	boss.x = 500; boss.y = 500; boss.remaining = 0;
	game.player.x = 1080; game.player.y = 600;
	stepBoss(game, 1 / 120, { x: game.player.x - 2, y: game.player.y - 2 });
	expect(boss.phase).toBe("chargeWindup");
	const target = { ...boss.target }, angle = boss.angle;
	expect(angle).toBeCloseTo(Math.atan2(target.y - boss.y, target.x - boss.x));
	until(game, "charge");
	while (boss.phase === "charge") stepBoss(game, 1 / 120, game.player);
	expect(boss.x).toBeCloseTo(target.x); expect(boss.y).toBeCloseTo(target.y);
});
