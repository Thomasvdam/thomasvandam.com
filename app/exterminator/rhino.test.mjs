import { expect, test } from "bun:test";
import { createBoss, damageBoss, firstBossHit } from "./bosses";
import { bossExposed } from "./boss-patterns";
import { newGame, step, clearCombat, FIELD } from "./game";
import { dropRhinoRocks, RHINO_ROCK, resolveRockBarriers, firstRockHit } from "./rhino-rocks";
import { RHINO_TIMING } from "./rhino";
import { modelBossPose } from "./model-boss-renderer";
import { spawnDebugBoss, spawnDebugWave, defaultComposition } from "./debug";
const rear = boss => ({ x: boss.x - Math.cos(boss.angle) * 100, y: boss.y - Math.sin(boss.angle) * 100 });
const idle = { move: { x: 0, y: 0 }, aim: { x: 1, y: 0 }, fire: false };
function scene() {
	const g = newGame(47); g.mode = "playing"; g.toSpawn = 1; g.spawnTimer = 1000; g.terrain.fill("firm"); g.hivesCleared = 10;
	g.boss = createBoss("rhinoceros", 4, g.player);
	Object.assign(g.boss, { x: 250, y: 360, angle: 0, phase: "approach", remaining: 0 });
	Object.assign(g.player, { x: 750, y: 360, invulnerable: 100 }); return g;
}
function rock(g, x = 500, y = 360, remaining = 0) {
	const r = { id: g.nextId++, x, y, remaining, health: RHINO_ROCK.health, hitAt: -10, landedAt: -10 }; g.boss.rhino.rocks.push(r); return r;
}
function advance(g, seconds, input = idle) { for (let i = 0; i < Math.ceil(seconds * 120); i++) step(g, input, 1 / 120); }
function until(g, phase, seconds = 8) { for (let i = 0; i < seconds * 120 && g.boss.phase !== phase; i++) step(g, idle, 1 / 120); expect(g.boss.phase).toBe(phase); }

test("all four arena walls stop a charge and shake loose one warned cluster at the locked impact-time player position", () => {
	for (const [x, y, px, py] of [[250, 360, 750, 360], [850, 360, 350, 360], [560, 200, 560, 550], [560, 550, 560, 200]]) {
		const g = scene(), b = g.boss; Object.assign(b, { x, y }); Object.assign(g.player, { x: px, y: py });
		step(g, idle, 1 / 120); const target = { ...b.target }; until(g, "charge"); g.player.x = 600; g.player.y = 330;
		until(g, "stuck"); expect(b.x).toBeCloseTo(target.x); expect(b.y).toBeCloseTo(target.y);
		expect(b.rhino.rocks.some(r => r.x === 600 && r.y === 330)).toBe(true);
		expect(b.rhino.rocks.every(r => r.remaining >= RHINO_ROCK.warning)).toBe(true);
		const count = b.rhino.rocks.length; advance(g, .2); expect(b.rhino.rocks).toHaveLength(count);
	}
});

test("charging hits the nearest solid rock along the swept path, smashes only it, and exposes a longer daze without more rockfalls", () => {
	const g = scene(), b = g.boss; const far = rock(g, 650), near = rock(g, 450), falling = rock(g, 350, 360, 10);
	step(g, idle, 1 / 120); until(g, "dazed");
	expect(b.x).toBeCloseTo(450 - RHINO_ROCK.radius - 42); expect(near.health).toBe(0); expect(far.health).toBe(RHINO_ROCK.health); expect(falling.health).toBe(RHINO_ROCK.health);
	expect(b.remaining).toBe(RHINO_TIMING.dazed); expect(b.remaining).toBeGreaterThan(RHINO_TIMING.stuck);
	const before = b.health; damageBoss(b, 4, g.time, "flank", rear(b)); expect(before - b.health).toBe(12);
});

test("falling rock warns, deals scaled armoured AoE once, then persists as a non-damaging obstruction", () => {
	for (const escaped of [false, true]) {
		const g = scene(); g.boss.remaining = 100; g.player.x = 500; g.player.invulnerable = 0; g.parts.armour = 2;
		const r = rock(g, 500, 360, RHINO_ROCK.warning);
		advance(g, 1); expect(g.player.health).toBe(100); expect(r.remaining).toBeGreaterThan(0);
		if (escaped) g.player.y += 150;
		advance(g, .6); expect(g.player.health).toBe(escaped ? 100 : 80);
		const health = g.player.health; advance(g, 6); expect(g.player.health).toBe(health); expect(g.boss.rhino.rocks).toHaveLength(1);
		if (!escaped) expect(Math.hypot(g.player.x - r.x, g.player.y - r.y)).toBeGreaterThanOrEqual(44 - .001);
	}
});

test("movement slides around piles, cannot tunnel with knockback, and falling or destroyed rocks do not block", () => {
	const g = scene(); g.boss.remaining = 100; g.player.x = 420; const r = rock(g);
	advance(g, 1, { ...idle, move: { x: 1, y: 0 } }); expect(g.player.x).toBeCloseTo(456);
	g.player.x = 600; resolveRockBarriers(g, { x: 420, y: 360 }); expect(g.player.x).toBeCloseTo(456);
	g.player.x = 420; g.player.y = 340; advance(g, .6, { ...idle, move: { x: 1, y: -1 } }); expect(g.player.y).toBeLessThan(300);
	for (const falling of [true, false]) { r.remaining = falling ? 10 : 0; r.health = falling ? 6 : 0; g.player.x = 420; g.player.y = 360; advance(g, .7, { ...idle, move: { x: 1, y: 0 } }); expect(g.player.x).toBeGreaterThan(550); }
});

test("rock clusters leave passages and avoid overlaps even after many wall crashes", () => {
	const g = scene(); g.player.x = 20; g.player.y = 20;
	for (let n = 0; n < 100; n++) { g.boss.attackIndex++; dropRhinoRocks(g, g.boss); }
	const rocks = g.boss.rhino.rocks; expect(rocks.length).toBeGreaterThan(0);
	for (const r of rocks) {
		expect(r.x).toBeGreaterThanOrEqual(76); expect(r.y).toBeGreaterThanOrEqual(76); expect(r.x).toBeLessThanOrEqual(FIELD.width - 76); expect(r.y).toBeLessThanOrEqual(FIELD.height - 76);
		for (const other of rocks) if (other !== r) expect(Math.hypot(other.x - r.x, other.y - r.y)).toBeGreaterThanOrEqual(108);
	}
});

test("all weapons destroy piles through real firing and piles intercept shots before the boss", () => {
	for (const weapon of ["cannon", "shotgun", "rpg", "flamethrower"]) {
		const g = scene(); g.boss.remaining = 100; g.boss.x = 1000; g.player.x = 390; g.weapon = weapon;
		const r = rock(g), health = g.boss.health;
		advance(g, 2, { ...idle, fire: true });
		expect(r.health, weapon).toBe(0); expect(g.boss.health, weapon).toBe(health);
	}
	const g = scene(); rock(g, 600); const near = rock(g, 500); const hit = firstRockHit(g.boss, { x: 400, y: 360 }, { x: 800, y: 360 }); expect(hit.rock).toBe(near);
});

test("recovery visibly gets up, stays vulnerable until standing, then sweeps immediately; escaping its reach triggers a warned charge", () => {
	for (const phase of ["stuck", "dazed"]) for (const escape of [false, true]) {
		const g = scene(), b = g.boss; b.phase = phase; b.remaining = 0; g.player.x = b.x + 100; g.player.invulnerable = 0;
		step(g, idle, 1 / 120); expect(b.phase).toBe("rising"); expect(bossExposed(b)).toBe(true); expect(g.player.health).toBe(100);
		const poses = new Set(); for (const t of [.4, .24, .12, .01]) { b.remaining = t; poses.add(JSON.stringify(modelBossPose(b, g.time))); } expect(poses.size).toBeGreaterThan(2);
		b.remaining = .01; if (escape) g.player.x += 300;
		step(g, idle, 1 / 60); expect(bossExposed(b)).toBe(false);
		if (escape) { expect(b.phase).toBe("chargeWindup"); expect(g.player.health).toBe(100); }
		else { expect(b.phase).toBe("sweep"); expect(g.player.health).toBe(75); }
		const health = b.health; damageBoss(b, 4, g.time, "flank", rear(b)); expect(health - b.health).toBeCloseTo(.4);
	}
});

test("moving away during get-up evades the immediate sweep, while remaining in its reach is punished", () => {
	for (const escape of [false, true]) {
		const g = scene(); g.boss.phase = "stuck"; g.boss.remaining = 0; g.player.x = 350; g.player.invulnerable = 0;
		step(g, idle, 1 / 120); advance(g, .05);
		advance(g, .42, escape ? { ...idle, move: { x: 1, y: 0 } } : idle);
		expect(g.player.health).toBe(escape ? 100 : 75);
	}
});

test("vulnerable rear remains actual hittable geometry during daze and rising", () => {
	const g = scene(), b = g.boss;
	for (const phase of ["stuck", "dazed", "rising"]) {
		b.phase = phase; const hit = firstBossHit(b, { x: b.x - 150, y: b.y }, { x: b.x, y: b.y }); expect(hit.circle.part).toBe("flank");
	}
});

test("pause freezes hazards; death cancels them; replacement and cleanup discard the boss-owned rock state", () => {
	const g = scene(); g.boss.remaining = 100; rock(g, 500, 360, .1); g.mode = "paused"; const before = JSON.stringify(g); advance(g, 2); expect(JSON.stringify(g)).toBe(before);
	g.mode = "playing"; g.boss.health = 0; g.player.x = 500; g.player.invulnerable = 0; advance(g, .3); expect(g.player.health).toBe(100);
	clearCombat(g); expect(g.boss).toBeNull();
	g.debug = { queue: [], total: 0, lightSensitivePercent: 0 }; g.hive = { id: "test" }; spawnDebugBoss(g, "rhinoceros"); rock(g); spawnDebugBoss(g, "rhinoceros"); expect(g.boss.rhino.rocks).toHaveLength(0); rock(g); spawnDebugWave(g, defaultComposition()); expect(g.boss).toBeNull();
});

test("the get-up animation is the only sweep warning; the short-lived cone deals damage on its first simulation tick", async () => {
	const { bossCone, BOSS_ATTACKS } = await import("./boss-patterns");
	const g = scene(), b = g.boss; b.phase = "rising"; b.remaining = .5; g.player.x = 350; g.player.invulnerable = 0;
	expect(bossCone(b)).toBeNull(); advance(g, .45); expect(g.player.health).toBe(100); expect(bossCone(b)).toBeNull();
	for (let i = 0; i < 10 && b.phase === "rising"; i++) step(g, idle, 1 / 120);
	expect(b.phase).toBe("sweep"); expect(bossCone(b)).not.toBeNull(); expect(g.player.health).toBe(75);
	expect(BOSS_ATTACKS.sweep.active).toBeLessThanOrEqual(.08);
	advance(g, .1); expect(bossCone(b)).toBeNull();
});

test("every weapon earns the vulnerability bonus only from the rear, for rotated beetles as well", () => {
	for (const heading of [0, Math.PI / 2, Math.PI]) for (const weapon of ["cannon", "shotgun", "rpg", "flamethrower"]) {
		const damages = [];
		for (const bearing of [0, Math.PI / 2, -Math.PI / 2, Math.PI]) {
			const g = scene(), b = g.boss; b.x = 560; b.y = 360; b.angle = heading; b.phase = "stuck"; b.remaining = 10; g.weapon = weapon;
			g.player.x = b.x + Math.cos(heading + bearing) * 120; g.player.y = b.y + Math.sin(heading + bearing) * 120;
			const health = b.health; advance(g, .45, { ...idle, aim: { x: b.x - g.player.x, y: b.y - g.player.y }, fire: true }); damages.push(health - b.health);
		}
		expect(damages[3], `${heading}/${weapon}: rear`).toBeGreaterThan(Math.max(...damages.slice(0, 3)) * 5);
	}
});

test("vulnerable front/side blasts and flames cannot wrap around armour for a bonus, and unknown hit directions get no bonus", async () => {
	const { blastBoss, flameBoss } = await import("./bosses");
	for (const phase of ["approach", "stuck", "dazed", "rising"]) for (const bearing of [0, Math.PI / 2, Math.PI]) {
		const g = scene(), b = g.boss; b.phase = phase; const source = { x: b.x + Math.cos(bearing) * 80, y: b.y + Math.sin(bearing) * 80 };
		const expected = phase !== "approach" && bearing === Math.PI ? 12 : .4;
		let health = b.health; blastBoss(g, source, 160, 4); expect(health - b.health).toBeCloseTo(expected);
		health = b.health; flameBoss(g, source, bearing + Math.PI, 250, Math.PI / 3, 4); expect(health - b.health).toBeCloseTo(expected);
		health = b.health; damageBoss(b, 4, 0, "flank"); expect(health - b.health).toBeCloseTo(.4);
	}
});

test("projectile direction determines a rear hit even if the player moves around the beetle after firing", () => {
	for (const behind of [false, true]) {
		const g = scene(), b = g.boss; b.phase = "stuck"; b.remaining = 10; g.player.x = b.x + (behind ? -120 : 120);
		const health = b.health; step(g, { ...idle, aim: { x: behind ? 1 : -1, y: 0 }, fire: true }, 1 / 120);
		g.player.x = b.x + (behind ? 120 : -120); advance(g, .3);
		expect(health - b.health).toBeCloseTo(behind ? 3 : .1);
	}
});

test("stars disappearing starts a short get-up with no turning or damage; turning belongs to the immediate sweep", async () => {
	const { rhinoRenderAngle } = await import("./rhino");
	const g = scene(), b = g.boss; b.phase = "dazed"; b.remaining = 0; g.player.x = b.x - 100; g.player.invulnerable = 0;
	step(g, idle, 1 / 120); expect(b.phase).toBe("rising"); expect(b.remaining).toBe(.4);
	advance(g, .3); expect(b.angle).toBe(0); expect(rhinoRenderAngle(b)).toBe(0); expect(g.player.health).toBe(100);
	until(g, "sweep", .2); expect(b.angle).toBeCloseTo(Math.PI); expect(g.player.health).toBe(75);
	expect(rhinoRenderAngle(b)).toBeGreaterThan(0); expect(rhinoRenderAngle(b)).toBeLessThan(Math.PI);
	advance(g, .05); expect(rhinoRenderAngle(b)).toBeCloseTo(Math.PI);
});

test("a close rear shot still hits the open abdomen when its muzzle overlaps the body", () => {
	const g = scene(), b = g.boss; b.phase = "stuck"; b.remaining = 10; g.player.x = b.x - 30;
	const health = b.health; advance(g, .05, { ...idle, fire: true }); expect(health - b.health).toBeCloseTo(3);
	expect(firstBossHit(b, { x: -1000, y: -1000 }, { x: -900, y: -900 }).circle).toBeNull();
});
