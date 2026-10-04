import { expect, test } from "bun:test";
import { collectPower, forecast, launch, newGame, nextLevel, step } from "./game";
const dt = 1 / 120;
function game() {
	const g = newGame(); launch(g); g.bricks = [{ id: 1, x: 2, y: 23, width: 1, height: 1, hits: 99, maxHits: 99 }];
	Object.assign(g.balls[0], { x: 9, y: 10, vx: 1, vy: 0 }); return g;
}
function advance(g, seconds) { for (let i = 0; i < Math.round(seconds * 120); i++) step(g, dt); }

test("Rewind reverses every active ball at unchanged speed for five playing seconds", () => {
	const g = game(); g.balls.push({ id: 500, x: 5, y: 12, vx: 0, vy: 1 }); collectPower(g, "rewind");
	expect(g.balls.map(b => [b.vx, b.vy])).toEqual([[-1, -0], [-0, -1]]); advance(g, 2);
	expect(g.balls[0].x).toBeCloseTo(7); expect(g.balls[1].y).toBeCloseTo(10);
	g.mode = "paused"; step(g, 20); expect(g.time).toBeCloseTo(2); g.mode = "playing"; advance(g, 3 + dt);
	expect(g.balls[0].vx).toBe(1); expect(g.balls[1].vy).toBe(1); expect(g.balls.every(b => b.rewindUntil === undefined)).toBe(true);
});

test("a destroyed-brick bounce reverses through its empty space without replaying the old bounce", () => {
	const g = game(); const brick = { id: 2, x: 9, y: 20, width: 2, height: 1, hits: 1, maxHits: 1 }; g.bricks.push(brick);
	Object.assign(g.balls[0], { x: 9, y: 19.2, vx: 0, vy: 10 }); step(g, dt); expect(brick.hits).toBe(0); expect(g.balls[0].vy).toBeLessThan(0);
	const score = g.score, deadline = g.nextSightDropAt; collectPower(g, "rewind"); advance(g, 0.2);
	expect(g.balls[0].y).toBeGreaterThan(brick.y + brick.height / 2); expect(g.balls[0].vy).toBeGreaterThan(0); expect(brick.hits).toBe(0); expect(g.score).toBe(score); expect(g.nextSightDropAt).toBe(deadline);
});

test("Rewind refreshes without flipping again and duplicates inherit the remaining effect independently", () => {
	const g = game(); collectPower(g, "rewind"); advance(g, 1); collectPower(g, "rewind"); expect(g.balls[0].vx).toBe(-1); expect(g.balls[0].rewindUntil).toBeCloseTo(6);
	collectPower(g, "duplicate"); expect(g.balls[1].rewindUntil).toBe(g.balls[0].rewindUntil); expect(g.balls[1].vx).toBeLessThan(0);
	g.balls[1].rewindUntil = g.time; step(g, dt); expect(g.balls[1].vx).toBeGreaterThan(0); expect(g.balls[0].vx).toBe(-1);
});

test("ball modifiers and speed persist; Rewind does not restore world, paddle equipment or dead balls", () => {
	const g = game(); Object.assign(g.balls[0], { effect: "piercing", speedBoost: 1.2, vx: 12, slowUntil: 10 }); g.leftHits = 2; g.rightHits = 3; g.score = 300; g.lives = 2;
	collectPower(g, "rewind"); expect(g.balls).toHaveLength(1); expect(g.balls[0].effect).toBe("piercing"); expect(g.balls[0].speedBoost).toBe(1.2); expect(g.balls[0].vx).toBe(-12); expect(g.balls[0].slowUntil).toBe(10);
	expect(g.leftHits + g.rightHits).toBe(5); expect(g.score).toBe(300); expect(g.lives).toBe(2); expect(g.bricks[0].hits).toBe(99);
});

test("Rewind remains bounded through life loss, level transitions and attached Sticky balls", () => {
	const g = game(); collectPower(g, "sticky"); Object.assign(g.balls[0], { y: 2.5, vx: 0, vy: -10 }); step(g, dt); const vy = g.balls[0].vy;
	collectPower(g, "rewind"); expect(g.balls[0].vy).toBe(-vy); expect(g.balls[0].attachedOffset).toBeDefined(); advance(g, 5 + dt); expect(g.balls[0].vy).toBe(vy);
	collectPower(g, "rewind"); g.balls[0].y = -2; g.balls[0].attachedOffset = undefined; step(g, dt); expect(g.balls[0].rewindUntil).toBeUndefined();
	launch(g); collectPower(g, "rewind"); g.bricks[0].hits = 0; step(g, dt); nextLevel(g); expect(g.balls[0].rewindUntil).toBeUndefined();
});

test("Future Sight predicts Rewind motion and expiry without mutating live balls", () => {
	const g = game(); collectPower(g, "rewind"); g.balls[0].rewindUntil = 0.5; const before = JSON.stringify(g), path = forecast(g)[0]; expect(JSON.stringify(g)).toBe(before);
	const copy = globalThis.structuredClone(g); for (let i = 1; i < path.points.length; i++) { step(copy, dt, false); expect(path.points[i].x).toBeCloseTo(copy.balls[0].x, 8); expect(path.points[i].y).toBeCloseTo(copy.balls[0].y, 8); }
});
