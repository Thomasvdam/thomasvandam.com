import { describe, expect, test } from "bun:test";
import { collectPower, forecast, launch, MAX_BALLS, movePaddle, newGame, paddleBounds, paddleWidth, step } from "./game";

describe("Breakout simulation", () => {
	test("level contains all brick types and a ball follows the paddle before launch", () => {
		const g = newGame(); expect(g.bricks).toHaveLength(40);
		expect(new Set(g.bricks.map(b => b.maxHits))).toEqual(new Set([1, 2, 3]));
		expect(new Set(g.bricks.filter(b => b.power).map(b => b.power))).toEqual(new Set(["sight", "wide", "duplicate"]));
		movePaddle(g, -100); expect(g.balls[0].x).toBe(g.paddleX); expect(g.paddleX).toBeGreaterThan(1.5);
		launch(g); expect(g.mode).toBe("playing"); expect(g.balls[0].vy).toBeGreaterThan(0);
	});
	test("armored bricks need multiple hits and boxes release falling power-ups", () => {
		const g = newGame(); launch(g);
		const brick = g.bricks[0];
		for (let hits = 2; hits >= 0; hits--) {
			Object.assign(g.balls[0], { x: brick.x, y: brick.y - 0.7, vx: 0, vy: 10 }); step(g, 1 / 120);
			expect(brick.hits).toBe(hits);
		}
		const box = g.bricks.find(b => b.power);
		Object.assign(g.balls[0], { x: box.x, y: box.y - 0.7, vx: 0, vy: 10 }); step(g, 1 / 120);
		expect(g.drops[0].power).toBe(box.power);
	});
	test("paddle redirects downward balls upward; walls reflect", () => {
		const g = newGame(); launch(g);
		Object.assign(g.balls[0], { x: g.paddleX + 1, y: 2.5, vx: 0, vy: -10 }); step(g, 1 / 120);
		expect(g.balls[0].vy).toBeGreaterThan(0); expect(g.balls[0].vx).toBeGreaterThan(0);
		Object.assign(g.balls[0], { x: 0.55, y: 10, vx: -10, vy: 1 }); step(g, 1 / 120);
		expect(g.balls[0].vx).toBeGreaterThan(0);
	});
	test("extensions survive time and core hits, then each side breaks down over five hits", () => {
		const g = newGame(); launch(g); collectPower(g, "wide"); expect(paddleWidth(g)).toBeCloseTo(4.6);
		g.time = 100; expect(paddleWidth(g)).toBeCloseTo(4.6);
		Object.assign(g.balls[0], { x: g.paddleX, y: 2.5, vx: 0, vy: -10 }); step(g, 1 / 120);
		expect(g.leftHits).toBe(5); expect(g.rightHits).toBe(5);
		for (const side of ["left", "right"]) for (let remaining = 4; remaining >= 0; remaining--) {
			const bounds = paddleBounds(g);
			Object.assign(g.balls[0], { x: side === "left" ? bounds.left + 0.08 : bounds.right - 0.08, y: 2.5, vx: 0, vy: -10 });
			step(g, 1 / 120); expect(g[side + "Hits"]).toBe(remaining); expect(g.balls[0].vy).toBeGreaterThan(0);
			if (side === "left") expect(g.rightHits).toBe(5);
		}
		expect(paddleWidth(g)).toBe(3);
		collectPower(g, "wide"); expect(g.leftHits).toBe(5); expect(g.rightHits).toBe(5);
	});
	test("asymmetric extensions stay inside the arena and catch power-ups", () => {
		const g = newGame(); launch(g); collectPower(g, "wide"); g.leftHits = 0;
		movePaddle(g, 100); expect(paddleBounds(g).right).toBeCloseTo(17.7);
		movePaddle(g, -100); expect(paddleBounds(g).left).toBeCloseTo(0.3);
		g.drops.push({ id: 1000, x: paddleBounds(g).right - 0.1, y: 2.1, power: "sight" }); step(g, 1 / 120);
		expect(g.sightUntil).toBeGreaterThan(g.time);
	});
	test("duplication clones each active ball with a distinct direction and bounded count", () => {
		const g = newGame(); launch(g); collectPower(g, "duplicate");
		const originals = g.balls.map(b => ({ ...b })); collectPower(g, "duplicate"); expect(g.balls).toHaveLength(4);
		originals.forEach((b, i) => { expect(g.balls[i]).toEqual(b); expect(g.balls[i + 2].id).not.toBe(b.id); expect(g.balls[i + 2].vx).not.toBe(b.vx); expect(Math.hypot(g.balls[i + 2].vx, g.balls[i + 2].vy)).toBeCloseTo(Math.hypot(b.vx, b.vy)); });
		for (let i = 0; i < 10; i++) collectPower(g, "duplicate");
		expect(g.balls).toHaveLength(MAX_BALLS); expect(new Set(g.balls.map(b => b.id)).size).toBe(MAX_BALLS);
	});
	test("Future Sight expires in playing time, pauses freeze it, and life loss clears upgrades", () => {
		const g = newGame(); launch(g); collectPower(g, "sight"); collectPower(g, "wide");
		expect(g.sightUntil).toBe(12); g.mode = "paused"; step(g, 20); expect(g.time).toBe(0);
		g.mode = "playing"; g.time = 12; expect(g.sightUntil > g.time).toBe(false);
		g.balls[0].y = -2; step(g, 1 / 120); expect(g.sightUntil).toBe(0); expect(g.leftHits + g.rightHits).toBe(0);
	});
	test("two-second forecasts follow real wall, brick, and paddle collisions without mutating play", () => {
		const g = newGame(); launch(g); collectPower(g, "wide");
		Object.assign(g.balls[0], { x: 1, y: 10, vx: -7, vy: 8 });
		g.balls.push({ id: g.nextId++, x: 9, y: 5, vx: 0, vy: -10 });
		g.balls.push({ id: g.nextId++, x: 2, y: 21, vx: 0, vy: 10 });
		const before = structuredClone(g), paths = forecast(g);
		expect(g).toEqual(before); expect(paths).toHaveLength(3);
		for (let i = 0; i < 240; i++) step(before, 1 / 120, false);
		paths.forEach(path => {
			const ball = before.balls.find(b => b.id === path.id);
			expect(path.points).toHaveLength(241);
			expect(path.points.at(-1).x).toBeCloseTo(ball.x, 10); expect(path.points.at(-1).y).toBeCloseTo(ball.y, 10);
		});
		expect(paths[0].points.some(p => p.x > 2)).toBe(true);
		expect(paths[1].points.at(-1).y).toBeGreaterThan(5);
		expect(before.bricks[8].hits).toBeLessThan(g.bricks[8].hits);
	});
	test("forecast responds to steering and terminates a missed ball without inventing its next life", () => {
		const g = newGame(); launch(g); Object.assign(g.balls[0], { x: 9, y: 5, vx: 0, vy: -10 });
		const catchPath = forecast(g)[0]; movePaddle(g, 3); const missPath = forecast(g)[0];
		expect(catchPath.points.at(-1).y).toBeGreaterThan(2); expect(missPath.points.length).toBeLessThan(241); expect(g.lives).toBe(3);
	});
	test("collecting a drop activates it and extra balls preserve a life until all are lost", () => {
		const g = newGame(); launch(g);
		g.drops.push({ id: 500, x: g.paddleX, y: 2.1, power: "duplicate" }); step(g, 1 / 120);
		expect(g.balls).toHaveLength(2); expect(g.drops).toHaveLength(0);
		g.balls[0].y = -2; step(g, 1 / 120); expect(g.lives).toBe(3);
		g.balls[0].y = -2; step(g, 1 / 120); expect(g.lives).toBe(2); expect(g.mode).toBe("ready");
	});
	test("last brick wins, last life loses, and restart restores the level", () => {
		const g = newGame(); launch(g); g.bricks.forEach(b => b.hits = 0); step(g, 1 / 120); expect(g.mode).toBe("won");
		const lost = newGame(); launch(lost); lost.lives = 1; lost.balls[0].y = -2; step(lost, 1 / 120); expect(lost.mode).toBe("lost");
		expect(newGame().lives).toBe(3);
	});
});
