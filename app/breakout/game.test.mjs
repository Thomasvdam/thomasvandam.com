import { describe, expect, test } from "bun:test";
import { collectPower, launch, movePaddle, newGame, paddleWidth, step } from "./game";

describe("Breakout simulation", () => {
	test("level contains all brick types and a ball follows the paddle before launch", () => {
		const g = newGame(); expect(g.bricks).toHaveLength(40);
		expect(new Set(g.bricks.map(b => b.maxHits))).toEqual(new Set([1, 2, 3]));
		expect(new Set(g.bricks.filter(b => b.power).map(b => b.power))).toEqual(new Set(["wide", "extra"]));
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
	test("wide paddle expires in game time and pauses freeze its duration", () => {
		const g = newGame(); launch(g); collectPower(g, "wide"); expect(paddleWidth(g)).toBe(4.6);
		g.mode = "paused"; step(g, 20); expect(g.time).toBe(0);
		g.mode = "playing"; g.time = 16; expect(paddleWidth(g)).toBe(3);
	});
	test("collecting a drop activates it and extra balls preserve a life until all are lost", () => {
		const g = newGame(); launch(g);
		g.drops.push({ id: 500, x: g.paddleX, y: 2.1, power: "extra" }); step(g, 1 / 120);
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
