import { expect, test } from "bun:test";
import { FIELD, aroundDelta, wrapX } from "./field";
import { collectPower, forecast, launch, movePaddle, newGame, POWER_TYPES, step } from "./game";
import { CELLS, parseLevel } from "./level-format";
import { LEVELS } from "./levels";

const dt = 1 / 120;
function fixture() {
	const g = newGame(); launch(g);
	g.bricks = [{ id: 1000, x: 9, y: 20, width: 1, height: 1, hits: 99, maxHits: 99 }];
	return g;
}

test("rotation wraps in both directions, with the waiting ball under the fixed paddle", () => {
	const g = newGame();
	for (const x of [-0.2, FIELD.width + 0.2, 3 * FIELD.width + 2]) {
		movePaddle(g, x); expect(g.paddleX).toBeCloseTo(wrapX(x)); expect(g.balls[0].x).toBe(g.paddleX);
	}
	expect(aroundDelta(0.1, 17.9)).toBeCloseTo(0.2);
	expect(aroundDelta(17.9, 0.1)).toBeCloseTo(-0.2);
});

test("balls cross the seam without a side-wall bounce and still bounce off the ceiling", () => {
	for (const [x, vx, expected] of [[17.95, 12, 0.05], [0.05, -12, 17.95]]) {
		const g = fixture(), b = g.balls[0]; Object.assign(b, { x, y: 8, vx, vy: 0 });
		const events = []; step(g, dt, true, Math.random, e => events.push(e));
		expect(b.x).toBeCloseTo(expected); expect(b.vx).toBe(vx); expect(events).not.toContain("wall");
		Object.assign(b, { y: 25.5, vy: 12 }); step(g, dt); expect(b.vy).toBe(-12);
	}
});

test("brick collisions and phase crossings see the neighboring image across the seam", () => {
	for (const type of [undefined, "indestructible", "phase", "moving"]) {
		const g = fixture(), b = g.balls[0];
		const brick = { id: 1001, x: 0.2, y: 10, width: 0.4, height: 1, hits: 3, maxHits: 3, type };
		g.bricks.push(brick); Object.assign(b, { x: 17.7, y: 10, vx: 12, vy: 0 });
		step(g, dt);
		if (type === "phase") {
			expect(brick.hits).toBe(3); expect(b.vx).toBe(12);
			for (let i = 0; i < 10; i++) step(g, dt);
			expect(brick.materialized).toBe(true); expect(brick.hits).toBe(3);
		} else {
			expect(b.vx).toBe(-12); expect(brick.hits).toBe(type === "indestructible" ? 3 : 2);
		}
	}
});

test("paddle wings, sticky attachments, drops and laser hits work across the seam", () => {
	const g = fixture(); movePaddle(g, 0.2); collectPower(g, "wide"); collectPower(g, "sticky");
	const b = g.balls[0]; Object.assign(b, { x: 16.3, y: 2.5, vx: 0, vy: -12 });
	step(g, dt); expect(b.vy).toBeGreaterThan(0); expect(g.leftHits).toBe(4); expect(b.attachedOffset).toBeCloseTo(-1.9);
	movePaddle(g, 17.8); expect(b.x).toBeCloseTo(15.9);
	g.drops.push({ id: 1002, x: 0.1, y: 2.1, power: "sight" }); step(g, dt); expect(g.sightUntil).toBeGreaterThan(g.time);
	g.bricks.push({ id: 1003, x: 0.1, y: 10, width: 1, height: 1, hits: 2, maxHits: 2 });
	g.blasts.push({ id: 1004, x: 17.9, y: 9.3 }); step(g, dt); expect(g.bricks.at(-1).hits).toBe(1);
});

test("forecasts wrap exactly like live play without mutating the game", () => {
	const g = fixture(); Object.assign(g.balls[0], { x: 17.9, y: 8, vx: 5, vy: 2 });
	const before = JSON.stringify(g), path = forecast(g)[0], live = globalThis.structuredClone(g);
	for (const p of path.points.slice(1)) {
		step(live, dt, false); expect(p.x).toBeCloseTo(live.balls[0].x, 8); expect(p.y).toBeCloseTo(live.balls[0].y, 8);
	}
	expect(JSON.stringify(g)).toBe(before);
});

test("top paddle is absent from rewards, editor brushes and campaign source", () => {
	expect(POWER_TYPES).not.toContain("top"); expect(CELLS.T).toBeUndefined();
	expect(LEVELS.every(level => !level.pattern.some(row => row.includes("T")))).toBe(true);
	expect(() => parseLevel(JSON.stringify({ ...LEVELS[0], pattern: ["T1111111"] }))).toThrow("Unknown cell symbol");
});
