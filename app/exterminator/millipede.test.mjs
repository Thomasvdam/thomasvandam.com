import { expect, test } from "bun:test";
import { createBoss, stepBoss, bossCircles, damageBoss, blastBoss, flameBoss } from "./bosses";
import { newGame, FIELD, start, chooseHive, step, clearCombat } from "./game";
import { MILLIPEDE_SEGMENT_COUNT, MILLIPEDE_SPACING } from "./boss-types";
import { resolveMillipedeBarrier, positionMillipede, rampageSafeZone, insideSafeZone, MILLIPEDE_PATTERNS, ACID_POOL_LIFETIME, ACID_POOL_TICK, ACID_BOMB_FLIGHT } from "./millipede";
const idle = { move: { x: 0, y: 0 }, aim: { x: 0, y: -1 }, fire: false };
function game() {
	const g = newGame(47); start(g); chooseHive(g, g.hives[0].id); g.toSpawn = 1; g.spawnTimer = 10000; g.spawns = []; g.enemies = []; g.terrain.fill("firm");
	g.player.y = 500; g.player.invulnerable = 100000; g.boss = createBoss("millipede", 4, g.player); return g;
}
function advance(g, seconds, input = idle) { for (let i = 0; i < Math.round(seconds * 120); i++) step(g, input, 1 / 120); }
function until(g, phase, max = 20) { for (let i = 0; i < max * 120 && g.boss.phase !== phase; i++) step(g, idle, 1 / 120); expect(g.boss.phase).toBe(phase); }

test("millipede suggests almost eight arena-widths of body and opens with acid from the north edge", () => {
	const g = game(), b = g.boss; expect(b.segments.length).toBe(MILLIPEDE_SEGMENT_COUNT); expect(b.segments.length * MILLIPEDE_SPACING).toBeGreaterThan(FIELD.width * 7);
	expect(b.phase).toBe("emerge"); expect(resolveMillipedeBarrier(b, g.player, { ...g.player })).toBe(false);
	advance(g, 3); expect(b.phase).toBe("acid"); expect(b.y).toBe(185); expect(g.acid.length).toBeGreaterThan(0);
	advance(g, 5); expect(b.millipede.bombs.length + b.millipede.pools.length).toBeGreaterThan(0); expect(b.millipede.rampages).toBe(0);
});

test("80/60/40/20 percent thresholds each queue one complete rampage and never repeat", () => {
	const g = game(), b = g.boss, state = b.millipede; b.health = b.maxHealth * .19;
	const patterns = new Set();
	for (let count = 1; count <= 4; count++) {
		until(g, "crossingWindup"); expect(state.rampages).toBe(count); patterns.add(state.pattern);
		const safe = { ...state.safe }, before = g.acid.length; state.bombs = []; state.pools = [];
		advance(g, 1); expect(b.phase).toBe("crossingWindup"); expect(state.safe).toEqual(safe); expect(g.acid.length).toBeLessThanOrEqual(before);
		until(g, "crossing"); advance(g, 7.5); expect(b.phase).toBe("crossing");
		until(g, "return"); until(g, "acid"); expect(state.rampages).toBe(count);
	}
	expect(patterns.size).toBe(3); advance(g, 15); expect(state.rampages).toBe(4); expect(b.y).toBe(185);
});

test("each pattern's reserved zone stays free of the head, bodies and collision bridges for the full rampage", () => {
	for (const pattern of MILLIPEDE_PATTERNS) for (const player of [{ x: 100, y: 150 }, { x: 560, y: 360 }, { x: 1000, y: 650 }]) {
		const g = game(), b = g.boss, state = b.millipede; state.pattern = pattern; state.safe = rampageSafeZone(pattern, player); b.phase = "crossing";
		expect(insideSafeZone(player, state.safe)).toBe(false);
		for (let tick = 0; tick <= 32; tick++) {
			state.elapsed = tick / 4; positionMillipede(b);
			for (const circle of bossCircles(b)) expect(insideSafeZone(circle, state.safe, 14)).toBe(false);
			for (const fx of [.1, .5, .9]) for (const fy of [.1, .5, .9]) {
				const point = { x: state.safe.x + state.safe.width * fx, y: state.safe.y + state.safe.height * fy }, previous = { ...point };
				expect(resolveMillipedeBarrier(b, point, previous)).toBe(false); expect(point).toEqual(previous);
			}
		}
	}
});

test("body previews and returns cannot hurt or block; active ribbons block without connecting separate passes", () => {
	const g = game(), b = g.boss;
	b.segments = [{ x: 200, y: 300, breakBefore: true }, { x: 226, y: 300 }, { x: 800, y: 300, breakBefore: true }];
	for (const phase of ["emerge", "crossingWindup", "return"]) { b.phase = phase; const point = { x: 210, y: 300 }; expect(resolveMillipedeBarrier(b, point, { ...point })).toBe(false); }
	b.phase = "crossing";
	const point = { x: 210, y: 400 }; expect(resolveMillipedeBarrier(b, point, { x: 210, y: 200 })).toBe(true); expect(point.y).toBeLessThan(270);
	const gap = { x: 500, y: 400 }; expect(resolveMillipedeBarrier(b, gap, { x: 500, y: 200 })).toBe(false);
});

test("acid phase head and raised neck are vulnerable; rampages are invulnerable; area weapons hit shared health once", () => {
	const g = game(), b = g.boss;
	function taken(phase, part) { b.phase = phase; const before = b.health; damageBoss(b, 4, g.time, part); return before - b.health; }
	expect(taken("acid", "head")).toBe(4); expect(taken("acid", "body")).toBe(0); expect(taken("acid", "joint")).toBe(4);
	expect(taken("crossing", "body")).toBe(0); expect(taken("crossing", "head")).toBe(0); expect(taken("crossing", "joint")).toBe(0);
	b.phase = "acid"; b.segments = Array.from({ length: 20 }, () => ({ x: b.x, y: b.y }));
	let health = b.health; blastBoss(g, b, 200, 4); expect(health - b.health).toBe(4);
	health = b.health; flameBoss(g, { x: b.x, y: b.y + 70 }, -Math.PI / 2, 250, Math.PI / 4, 2); expect(health - b.health).toBe(2);
});

test("bomb lands at its locked target; pools last ten seconds through rampages and overlapping pools share DOT ticks", () => {
	const g = game(), b = g.boss, state = b.millipede; b.phase = "bombWindup"; b.remaining = .001; state.acidTime = 0;
	b.target = { x: 700, y: 500 }; stepBoss(g, 1 / 120, g.player); expect(state.bombs).toHaveLength(1);
	g.player.x = 800; advance(g, ACID_BOMB_FLIGHT + .1); expect(state.pools[0].x).toBe(700); expect(state.pools[0].y).toBe(500);
	b.health = b.maxHealth * .79; until(g, "crossingWindup"); expect(state.pools).toHaveLength(1);
	g.player.x = 700; g.player.y = 500; g.player.invulnerable = 100; state.poolTick = 0;
	state.pools.push({ ...state.pools[0] }); const health = g.player.health, invulnerability = g.player.invulnerable;
	stepBoss(g, 1 / 120, g.player); expect(health - g.player.health).toBe(2); expect(g.player.invulnerable).toBe(invulnerability);
	for (let i = 0; i < 50; i++) { g.time += 1 / 120; stepBoss(g, 1 / 120, g.player); }
	expect(health - g.player.health).toBe(2);
	for (let i = 0; i < 12; i++) { g.time += 1 / 120; stepBoss(g, 1 / 120, g.player); }
	expect(health - g.player.health).toBe(4); expect(ACID_POOL_TICK).toBe(.5);
	g.time += ACID_POOL_LIFETIME; stepBoss(g, 1 / 120, g.player); expect(state.pools).toHaveLength(0);
});

test("acid DOT respects armour and frame rate, cannot stack, and never grants hit invulnerability", () => {
	for (const fps of [30, 60, 120]) for (const armour of [0, 5]) {
		const g = game(), b = g.boss, state = b.millipede; b.phase = "acid"; g.parts.armour = armour; g.player.invulnerable = 0;
		state.pools = Array.from({ length: 4 }, () => ({ x: g.player.x, y: g.player.y, bornAt: 0 }));
		for (let i = 0; i < fps * 2; i++) { g.time += 1 / fps; stepBoss(g, 1 / fps, g.player); }
		expect(g.player.health).toBe(armour ? 96 : 92); expect(g.player.invulnerable).toBe(0);
	}
});

test("pause freezes phases, projectiles and puddles; death and debug cleanup stop the fight", () => {
	const g = game(); advance(g, 6); g.mode = "paused"; const snapshot = JSON.stringify(g); advance(g, 2); expect(JSON.stringify(g)).toBe(snapshot);
	g.mode = "playing"; g.boss.health = 0; const state = JSON.stringify(g.boss); stepBoss(g, .1, g.player); expect(JSON.stringify(g.boss)).toBe(state);
	clearCombat(g); expect(g.boss).toBeNull(); expect(g.acid).toHaveLength(0);
});

test("reading each rampage preview and moving into its opening evades damage; standing still can be hit", () => {
	for (const pattern of MILLIPEDE_PATTERNS) for (const evade of [false, true]) {
		const g = game(), b = g.boss, state = b.millipede; g.player.invulnerable = 0;
		g.player.x = 560; g.player.y = 360; b.phase = "crossingWindup"; b.remaining = 2.2;
		state.pattern = pattern; state.safe = rampageSafeZone(pattern, g.player); state.rampages = 1; b.health = b.maxHealth * .79;
		const target = { x: state.safe.x + state.safe.width / 2, y: state.safe.y + state.safe.height / 2 };
		for (let i = 0; i < 10 * 120 && g.mode === "playing"; i++) {
			const dx = target.x - g.player.x, dy = target.y - g.player.y, distance = Math.hypot(dx, dy);
			const move = evade && i > 24 && distance > 3 ? { x: dx / distance, y: dy / distance } : idle.move;
			step(g, { ...idle, move }, 1 / 120);
		}
		if (evade) expect(g.player.health, pattern).toBe(100); else expect(g.player.health, pattern).toBeLessThan(100);
	}
});

test("normal stance renders a compact coil with six exposed front sections, not hundreds of parked ribbons", () => {
	const g = game(), b = g.boss; b.phase = "acid"; positionMillipede(b);
	const visible = b.segments.filter(s => !s.hidden);
	expect(visible).toHaveLength(76);
	expect(visible.every(s => s.y < b.y && Math.abs(s.x - b.x) < 230)).toBe(true);
	const circles = bossCircles(b);
	expect(circles.filter(c => c.part === "joint")).toHaveLength(6);
	const body = circles.find(c => c.part === "body");
	let health = b.health; blastBoss(g, body, 1, 2); expect(b.health).toBe(health);
	for (const part of ["head", "joint"]) { health = b.health; damageBoss(b, 2, g.time, part); expect(health - b.health).toBe(2); }
});

test("a threshold immediately absorbs excess damage and interrupts acid; every rampage/withdrawal hit is blocked", () => {
	const g = game(), b = g.boss, state = b.millipede;
	b.phase = "bombWindup"; b.remaining = .001; state.shotTimer = 0;
	damageBoss(b, 10000, g.time, "head"); expect(b.health).toBe(b.maxHealth * .8);
	damageBoss(b, 20, g.time, "joint"); expect(b.health).toBe(b.maxHealth * .8);
	stepBoss(g, .01, g.player); expect(b.phase).toBe("crossingWindup"); expect(state.bombs).toHaveLength(0); expect(g.acid).toHaveLength(0);
	for (const phase of ["crossingWindup", "crossing", "return"]) {
		b.phase = phase; const health = b.health, hitAt = b.hitAt;
		for (const part of ["head", "joint", "body"]) damageBoss(b, 10000, g.time + 1, part);
		blastBoss(g, b, 2000, 10000); flameBoss(g, { x: b.x, y: b.y + 100 }, -Math.PI / 2, 2000, Math.PI, 10000);
		expect(b.health).toBe(health); expect(b.hitAt).toBe(hitAt);
	}
	b.phase = "acid"; damageBoss(b, 1, g.time, "head"); expect(b.health).toBeCloseTo(b.maxHealth * .8 - 1);
});

test("the head builds each pattern at speed; sections appear in travel order and withdraw in reverse order", () => {
	for (const pattern of MILLIPEDE_PATTERNS) {
		const g = game(), b = g.boss, s = b.millipede; s.pattern = pattern; s.safe = { x: -1000, y: -1000, width: 1, height: 1 }; b.phase = "crossing";
		let previous = 0;
		for (const elapsed of [0, .2, 1, 2, 4, 6, 7.5]) {
			s.elapsed = elapsed; positionMillipede(b); const count = b.segments.filter(p => !p.hidden).length;
			expect(count).toBeGreaterThanOrEqual(previous); expect(b.segments.slice(count).every(p => p.hidden)).toBe(true); previous = count;
		}
		expect(previous).toBe(336);
		s.elapsed = .5; positionMillipede(b); const from = { x: b.x, y: b.y }; s.elapsed += 1 / 120; positionMillipede(b);
		expect(Math.hypot(b.x - from.x, b.y - from.y) * 120).toBeGreaterThan(1100);
		b.phase = "return"; s.returnFrom = { x: -168, y: 600 }; previous = 337;
		for (const elapsed of [0, .4, .8, 1.2, 1.8, 2.4]) {
			s.elapsed = elapsed; positionMillipede(b); const count = b.segments.filter(p => !p.hidden).length;
			expect(count).toBeLessThan(previous); expect(b.segments.slice(count).every(p => p.hidden)).toBe(true); previous = count;
		}
		expect(previous).toBe(0); expect(b.x).toBe(FIELD.width / 2); expect(b.y).toBe(185);
	}
});

test("each completed coil opens with one wide acid fan, then resumes ordinary volleys", () => {
	const g = game(), b = g.boss, s = b.millipede; b.phase = "return"; b.remaining = .001; s.elapsed = 2.39; g.acid = [];
	stepBoss(g, .01, g.player); expect(b.phase).toBe("acid"); expect(g.acid).toHaveLength(11);
	const angles = g.acid.map(p => Math.atan2(p.vy, p.vx)); expect(Math.max(...angles) - Math.min(...angles)).toBeCloseTo(2.2);
	stepBoss(g, .01, g.player); expect(g.acid).toHaveLength(11);
	s.shotTimer = 0; stepBoss(g, .01, g.player); expect(g.acid).toHaveLength(14);
});

test("a close player gets a committed recoil warning before the front-leg sweep; retreating beats it", () => {
	for (const evade of [false, true]) {
		const g = game(), b = g.boss, s = b.millipede; b.phase = "acid"; s.shotTimer = 100; s.bombTimer = 100; s.swipeTimer = 0;
		g.player.x = b.x; g.player.y = b.y + 120; g.player.invulnerable = 0;
		advance(g, .2); expect(b.phase).toBe("sweepWindup"); expect(g.player.health).toBe(100);
		advance(g, .6, evade ? { ...idle, move: { x: 0, y: 1 } } : idle);
		expect(g.player.health).toBe(evade ? 100 : 87);
	}
});
