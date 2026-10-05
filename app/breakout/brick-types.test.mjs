import { expect, test } from "bun:test";
import { collectPower, forecast, launch, MAX_SPEED, movePaddle, newGame, nextLevel, SLOW_DURATION, SLOW_FACTOR, step } from "./game";
import { BRICK_TYPES } from "./brick-types";
import { LEVELS, levelBricks } from "./levels";
import { bricksForLevel, exportLevel, parseLevel } from "./level-format";

const tick = 1 / 120;
function setup(type, hits = BRICK_TYPES[type].hits) {
	const g = newGame(); launch(g);
	g.bricks = [{ id: 1, x: 9, y: 20, width: 2, height: 1, hits, maxHits: hits, type }, { id: 2, x: 2, y: 23, width: 1, height: 1, hits: 99, maxHits: 99 }];
	return g;
}
function hit(g, effect, side = "bottom") {
	const target = g.bricks[0], b = g.balls[0];
	Object.assign(b, { x: target.x, y: target.y - 0.8, vx: 0, vy: 10, effect });
	if (side === "left") Object.assign(b, { x: target.x - 1.3, y: target.y, vx: 10, vy: 0 });
	if (side === "right") Object.assign(b, { x: target.x + 1.3, y: target.y, vx: -10, vy: 0 });
	if (side === "top") Object.assign(b, { y: target.y + 0.8, vy: -10 });
	step(g, tick); return b;
}
function advance(g, seconds) { for (let i = 0; i < Math.round(seconds * 120); i++) step(g, tick); }

test("speed destruction changes only its ball and survives paddle and ceiling bounces", () => {
	const g = setup("speed"), other = { id: 500, x: 4, y: 8, vx: 5, vy: 0 }; g.balls.push(other);
	const b = hit(g); expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(12); expect(other.vx).toBe(5);
	expect(b.speedBoost).toBeCloseTo(1.2);
	Object.assign(b, { x: 9, y: 2.5, vx: 0, vy: -17 }); step(g, tick); expect(b.vy).toBeGreaterThan(17);
	Object.assign(b, { x: 9, y: 25.5, vx: 0, vy: 17 }); step(g, tick); expect(b.vy).toBe(-17);
	for (let i = 0; i < 15; i++) {
		g.bricks[0].hits = 1; const speed = Math.hypot(b.vx, b.vy); Object.assign(b, { x: 9, y: 19.2, vx: 0, vy: speed }); step(g, tick);
		expect(Math.hypot(b.vx, b.vy)).toBeLessThanOrEqual(MAX_SPEED);
	}
	expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(MAX_SPEED);
	Object.assign(b, { x: 9, y: 2.5, vx: 0, vy: -MAX_SPEED }); step(g, tick); expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(MAX_SPEED);
});

test("slow destruction refreshes without compounding and restores speed in playing time", () => {
	const g = setup("slow"), b = hit(g); expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(10 * SLOW_FACTOR);
	Object.assign(b, { x: 9, y: 8, vx: 6, vy: 0 }); advance(g, 1);
	const firstExpiry = b.slowUntil;
	g.bricks[0].hits = 1; Object.assign(b, { x: 9, y: 19.2, vx: 0, vy: 6 }); step(g, 0.02);
	expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(6); expect(b.slowUntil).toBeGreaterThan(firstExpiry);
	g.mode = "paused"; const time = g.time; step(g, 10); expect(g.time).toBe(time); expect(b.slowUntil).toBeCloseTo(time + SLOW_DURATION);
	g.mode = "playing"; Object.assign(b, { x: 9, y: 8, vx: 6, vy: 0 }); advance(g, SLOW_DURATION + tick);
	expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(10); expect(b.slowUntil).toBeUndefined();
});

test("slow and permanent boosts compose, duplicate independently and survive paddle contact", () => {
	const g = setup("speed"), b = hit(g); g.bricks[0].type = "slow"; g.bricks[0].hits = 1;
	Object.assign(b, { x: 9, y: 19.2, vx: 0, vy: 12 }); step(g, tick);
	expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(7.2); expect(b.speedBoost).toBeCloseTo(1.2);
	Object.assign(b, { x: 9, y: 2.5, vx: 0, vy: -7.2 }); step(g, tick); expect(b.vy).toBeCloseTo(7.2 + 0.12 * SLOW_FACTOR);
	collectPower(g, "duplicate"); const clone = g.balls[1]; expect(clone.slowUntil).toBe(b.slowUntil); expect(clone.speedBoost).toBe(b.speedBoost);
	clone.slowUntil = g.time; Object.assign(b, { x: 9, y: 8, vx: 7.2, vy: 0 }); Object.assign(clone, { x: 4, y: 8, vx: 7.2, vy: 0 }); step(g, tick);
	expect(clone.vx).toBeCloseTo(12); expect(b.vx).toBeCloseTo(7.2);
});

test("moving bricks move away from all four incoming sides, including piercing and fire hits", () => {
	for (const [side, axis, delta] of [["bottom", "y", 0.8], ["top", "y", -0.8], ["left", "x", 0.8], ["right", "x", -0.8]]) {
		const g = setup("moving"), before = g.bricks[0][axis]; hit(g, undefined, side);
		expect(g.bricks[0].hits).toBe(2); expect(g.bricks[0][axis]).toBeCloseTo(before + delta);
	}
	for (const effect of ["piercing", "fire"]) {
		const g = setup("moving"); const b = hit(g, effect); expect(g.bricks[0].y).toBeCloseTo(20.8); expect(g.bricks[0].hits).toBe(effect === "fire" ? 1 : 2);
		expect(Math.sign(b.vy)).toBe(effect === "piercing" ? 1 : -1);
		g.bricks[0].hits = 1; const y = g.bricks[0].y; Object.assign(b, { x: 4, y: 8, vx: 0, vy: 0 }); step(g, tick); hit(g, effect); expect(g.bricks[0].y).toBe(y); expect(g.bricks[0].hits).toBe(0);
	}
});

test("moving bricks stop before live neighbors and playfield boundaries", () => {
	const g = setup("moving"); g.bricks.push({ id: 3, x: 9, y: 21.5, width: 2, height: 1, hits: 1, maxHits: 1 });
	hit(g); expect(g.bricks[0].y).toBeCloseTo(20.49); hit(g); expect(g.bricks[0].y).toBeCloseTo(20.49);
	const wall = setup("moving"); wall.bricks[0].x = 1.4; hit(wall, undefined, "right"); expect(wall.bricks[0].x).toBeCloseTo(0.6);
	const floor = setup("moving"); floor.bricks[0].y = 7.7; hit(floor, undefined, "top"); expect(floor.bricks[0].y - 0.5).toBeGreaterThan(7);
});

test("phasing bricks activate only after a complete crossing and cannot damage that passage", () => {
	for (const side of ["bottom", "left", "right", "top"]) {
		const g = setup("phase"), b = hit(g, undefined, side), target = g.bricks[0];
		expect(target.materialized).toBeUndefined(); expect(target.hits).toBe(1);
		advance(g, 0.3); expect(target.materialized).toBe(true); expect(target.hits).toBe(1);
		expect(side === "bottom" ? b.vy > 0 : side === "top" ? b.vy < 0 : side === "left" ? b.vx > 0 : b.vx < 0).toBe(true);
		hit(g); expect(target.hits).toBe(0); expect(b.vy).toBeLessThan(0);
	}
});

test("a complete phase crossing in one step materializes without an immediate collision", () => {
	const g = setup("phase"); Object.assign(g.balls[0], { x: 9, y: 19, vx: 0, vy: 10 }); step(g, 0.2);
	expect(g.bricks[0].materialized).toBe(true); expect(g.bricks[0].hits).toBe(1); expect(g.balls[0].vy).toBe(10);
});

test("retreating from a phasing brick leaves it intangible; overlapping balls finish safely", () => {
	const retreat = setup("phase"), rb = hit(retreat); rb.vy = -10; advance(retreat, 0.2); expect(retreat.bricks[0].materialized).toBeUndefined();
	const g = setup("phase"), b = hit(g); g.balls.push({ id: 500, x: 9, y: 19.4, vx: 0, vy: 2 });
	advance(g, 0.2); expect(g.bricks[0].materialized).toBe(true); expect(g.bricks[0].hits).toBe(1); expect(g.balls[1].vy).toBe(2);
	advance(g, 0.6); expect(g.bricks[0].hits).toBe(1); expect(b.phaseEntries).toHaveLength(0);
});

test("ghost and piercing passages materialize phase bricks without damaging them", () => {
	for (const effect of ["ghost", "piercing"]) { const g = setup("phase"); hit(g, effect); advance(g, 0.2); expect(g.bricks[0].materialized).toBe(true); expect(g.bricks[0].hits).toBe(1); }
});

test("shock breaks release a visible hazard; catching it freezes steering for one playing second", () => {
	const g = setup("shock"); hit(g); expect(g.drops).toHaveLength(1); expect(g.drops[0].power).toBe("shock"); expect(g.stunUntil).toBe(0);
	g.drops[0].x = g.paddleX; g.drops[0].y = 2.1; step(g, tick); expect(g.stunUntil).toBeCloseTo(g.time + 1);
	const x = g.paddleX; movePaddle(g, 15); expect(g.paddleX).toBe(x);
	g.mode = "paused"; step(g, 10); movePaddle(g, 3); expect(g.paddleX).toBe(x);
	g.mode = "playing"; Object.assign(g.balls[0], { x: 9, y: 8, vx: 1, vy: 0 }); advance(g, 1 + tick); movePaddle(g, 15); expect(g.paddleX).toBe(15);
	const miss = setup("shock"); miss.drops.push({ id: 500, x: 2, y: 2.1, power: "shock" }); step(miss, tick); expect(miss.stunUntil).toBe(0);
});

test("void consumes every ball modifier before damage and reflects ghost and piercing normally", () => {
	for (const effect of ["ghost", "piercing", "fire", "homing", undefined]) {
		const g = setup("void"); collectPower(g, "fire"); const b = hit(g, effect);
		expect(b.effect).toBeUndefined(); expect(b.vy).toBeLessThan(0); expect(g.bricks[0].hits).toBe(1); expect(g.queuedPowers).toEqual(["fire"]);
	}
});

test("brick effects reset on life loss and level transitions without resetting moved/materialized bricks", () => {
	const g = setup("phase"); hit(g); advance(g, 0.2); collectPower(g, "shock"); g.balls[0].y = -2; step(g, tick);
	expect(g.stunUntil).toBe(0); expect(g.bricks[0].materialized).toBe(true); expect(g.balls[0].speedBoost).toBeUndefined(); expect(g.balls[0].slowUntil).toBeUndefined();
	launch(g); collectPower(g, "shock"); g.bricks.forEach(b => b.hits = 0); step(g, tick); nextLevel(g); expect(g.stunUntil).toBe(0);
});

test("forecasts match every brick effect, slow expiry and active stun without mutating live state", () => {
	for (const type of Object.keys(BRICK_TYPES)) {
		const g = setup(type); Object.assign(g.balls[0], { x: 9, y: 19.2, vx: 0, vy: 10, effect: type === "void" ? "ghost" : undefined });
		if (type === "slow") { g.balls[0].slowUntil = g.time + 0.15; g.balls[0].vy = 6; }
		if (type === "phase") step(g, tick);
		collectPower(g, "shock"); const before = JSON.stringify(g), path = forecast(g)[0]; expect(JSON.stringify(g)).toBe(before);
		const live = globalThis.structuredClone(g);
		for (let i = 1; i < path.points.length; i++) {
			step(live, tick, false); const b = live.balls.find(ball => ball.id === path.id); if (!b) break;
			expect(path.points[i].x).toBeCloseTo(b.x, 8); expect(path.points[i].y).toBeCloseTo(b.y, 8);
		}
	}
});

test("all special brick types appear in campaign boards and survive editor source round trips", () => {
	LEVELS.forEach((level, index) => { expect(new Set(levelBricks(index).filter(b => b.type).map(b => b.type))).toEqual(new Set(Object.keys(BRICK_TYPES))); expect(bricksForLevel(parseLevel(exportLevel(level)))).toEqual(levelBricks(index)); });
	for (const [type, spec] of Object.entries(BRICK_TYPES)) { const level = { ...LEVELS[0], columns: 2, pattern: [spec.symbol + "1"] }; expect(bricksForLevel(parseLevel(exportLevel(level)))[0].type).toBe(type); }
});
