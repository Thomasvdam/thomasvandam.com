import { expect, test } from "bun:test";
import { createBoss, stepBoss, bossCircles } from "./bosses";
import { newGame, FIELD, start, chooseHive, step } from "./game";
import { MILLIPEDE_SEGMENT_COUNT, MILLIPEDE_SPACING } from "./boss-types";
import { resolveMillipedeBarrier, followMillipedeTrail } from "./millipede";
function game() { const game = newGame(); game.mode = "playing"; game.player.invulnerable = 100000; game.boss = createBoss("millipede", 4, game.player); return game; }

test("millipede has an articulated body longer than the arena and emerges before becoming solid", () => {
	const g = game(), b = g.boss; expect(b.segments).toHaveLength(MILLIPEDE_SEGMENT_COUNT); expect(b.segments.length * MILLIPEDE_SPACING).toBeGreaterThan(FIELD.width);
	expect(b.phase).toBe("emerge"); const point = { ...b.segments[10] }; expect(resolveMillipedeBarrier(b, point, { ...point })).toBe(false);
	for (const s of b.segments) { expect(s.x).toBeGreaterThanOrEqual(18); expect(s.x).toBeLessThanOrEqual(FIELD.width - 18); expect(s.y).toBeGreaterThanOrEqual(18); expect(s.y).toBeLessThanOrEqual(FIELD.height - 18); }
});

test("long body follows a bounded path for multiple arena sweeps without coiling or segment bunching", () => {
	const g = game(), b = g.boss, phases = new Set(), xs = [], ys = [];
	for (let i = 0; i < 120 * 90; i++) {
		g.time += 1 / 120; g.player.x = 560 + Math.cos(g.time * .47) * 430; g.player.y = 360 + Math.sin(g.time * .31) * 240; stepBoss(g, 1 / 120, g.player); phases.add(b.phase);
		if (i % 120 === 0) { xs.push(b.x); ys.push(b.y); let leader = b; for (const segment of b.segments) { const d = Math.hypot(leader.x - segment.x, leader.y - segment.y); expect(d).toBeLessThanOrEqual(MILLIPEDE_SPACING + .01); expect(d).toBeGreaterThan(15); leader = segment; } }
	}
	expect(phases).toEqual(new Set(["emerge", "crossingWindup", "crossing", "recover"])); expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(750); expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(300);
	expect(b.trail.length).toBeLessThan(410);
});

test("body capsules stop swept crossings and remain escapable when moving away", () => {
	const g = game(), b = g.boss; b.phase = "crossing"; b.x = 200; b.y = 300; b.segments = Array.from({ length: 20 }, (_, i) => ({ x: 200 + (i + 1) * 26, y: 300 }));
	const previous = { x: 450, y: 200 }, mech = { x: 450, y: 400 }; expect(resolveMillipedeBarrier(b, mech, previous)).toBe(true); expect(mech.y).toBeLessThanOrEqual(268);
	const away = { x: mech.x, y: mech.y - 50 }; resolveMillipedeBarrier(b, away, mech); expect(away.y).toBeLessThan(mech.y - 40);
	expect(bossCircles(b).length).toBe(21);
});


test("normal movement input cannot cross the moving body, and contact uses player armour", () => {
	const g = newGame(); start(g); chooseHive(g, g.hives[0].id);
	g.toSpawn = 0; g.spawns = []; g.enemies = []; g.boss = createBoss("millipede", 4, g.player);
	const b = g.boss; b.phase = "crossing"; b.x = 200; b.y = 300;
	b.segments = Array.from({ length: 20 }, (_, i) => ({ x: 200 + (i + 1) * 26, y: 300 }));
	// Keep the path coherent while it starts advancing towards the left edge.
	b.trail = Array.from({ length: 150 }, (_, i) => ({ x: 200 + i * 4, y: 300 }));
	g.player.x = 450; g.player.y = 250; g.player.invulnerable = 0; g.parts.armour = 5;
	const health = g.player.health;
	for (let i = 0; i < 60; i++) step(g, { move: { x: 0, y: 1 }, aim: { x: 0, y: 1 }, fire: false }, 1 / 120);
	expect(g.player.y).toBeLessThan(270); expect(g.player.health).toBeLessThan(health);
	expect(health - g.player.health).toBeLessThanOrEqual(10);
});

test("virtual head sampling preserves breadcrumb ownership and matches an explicit prefix", () => {
	const original = game().boss, explicit = globalThis.structuredClone(original);
	original.x -= 3; explicit.x -= 3;
	const trail = original.trail, saved = globalThis.structuredClone(trail);
	for (const point of trail) expect(Object.keys(point).sort()).toEqual(["x", "y"]);
	explicit.trail.unshift({ x: explicit.x, y: explicit.y });
	followMillipedeTrail(original, true); followMillipedeTrail(explicit);
	expect(original.segments).toEqual(explicit.segments);
	expect(original.trail).toBe(trail); expect(trail).toEqual(saved);
});

test("millipede signals a locked lane, crosses quickly, then stops its entire body for a punish window", () => {
	const g = game(), b = g.boss; b.remaining = 0; stepBoss(g, 1 / 120, g.player);
	expect(b.phase).toBe("crossingWindup"); const locked = { ...b.target }, still = globalThis.structuredClone([b, ...b.segments].map(({ x, y }) => ({ x, y })));
	for (let i = 0; i < 100; i++) { g.player.y += .1; stepBoss(g, 1 / 120, g.player); }
	expect(b.target).toEqual(locked); expect([b, ...b.segments].map(({ x, y }) => ({ x, y }))).toEqual(still);
	while (b.phase !== "crossing") stepBoss(g, 1 / 120, g.player);
	const x = b.x; for (let i = 0; i < 12; i++) stepBoss(g, 1 / 120, g.player); expect(x - b.x).toBeCloseTo(36);
	while (b.phase !== "recover") stepBoss(g, 1 / 120, g.player);
	expect(b.remaining).toBeCloseTo(1.9); const resting = globalThis.structuredClone([b, ...b.segments].map(({ x, y }) => ({ x, y })));
	for (let i = 0; i < 120; i++) stepBoss(g, 1 / 120, g.player);
	expect([b, ...b.segments].map(({ x, y }) => ({ x, y }))).toEqual(resting);
});

test("a signalled millipede crossing can be escaped with unupgraded movement in mud", () => {
	for (const evade of [true, false]) {
		const g = newGame(); start(g); chooseHive(g, g.hives[0].id); g.toSpawn = 1; g.spawnTimer = 1000; g.spawns = []; g.enemies = []; g.terrain.fill("mud");
		g.boss = createBoss("millipede", 4, g.player); g.boss.remaining = 0; g.player.x = 850; g.player.y = 360; g.player.invulnerable = 0;
		for (let i = 0; i < 3.5 * 120; i++) step(g, { move: { x: 0, y: evade && i > .2 * 120 && i < 1.2 * 120 ? 1 : 0 }, aim: { x: 1, y: 0 }, fire: false }, 1 / 120);
		if (evade) expect(g.player.health).toBe(100); else expect(g.player.health).toBeLessThan(100);
	}
});

test("millipede chooses a crossing through the player's side, then commits despite repositioning", () => {
	const targets = [];
	for (const y of [200, 520]) {
		const g = game(), b = g.boss; g.player.x = 560; g.player.y = y; b.remaining = 0;
		stepBoss(g, 1 / 120, g.player); const target = { ...b.target }; targets.push(target);
		const dx = target.x - b.x, dy = target.y - b.y;
		expect(Math.abs((g.player.x - b.x) * dy - (g.player.y - b.y) * dx) / Math.hypot(dx, dy)).toBeLessThan(1);
		g.player.y = 720 - y;
		for (let i = 0; i < 160; i++) stepBoss(g, 1 / 120, g.player);
		expect(b.target).toEqual(target);
	}
	expect(targets[0].y).toBeLessThan(targets[1].y);
});
