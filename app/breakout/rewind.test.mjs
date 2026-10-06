import { expect, test } from "bun:test";
import { collectPower, forecast, launch, movePaddle, newGame, nextLevel, step } from "./game";
import { recordFrame, rewindAvailable, startRewind } from "./rewind";
const dt = 1 / 120;
function game() {
	const g = newGame(); launch(g); g.bricks = [{ id: 1, x: 2, y: 23, width: 1, height: 1, hits: 99, maxHits: 99 }];
	Object.assign(g.balls[0], { x: 9, y: 10, vx: 1, vy: 0 }); return g;
}
function advance(g, seconds) { for (let i = 0; i < Math.round(seconds * 120); i++) step(g, dt); }

test("Rewind restores each recorded multiball and paddle state instead of simulating reversed velocities", () => {
	const g = game(), frames = [];
	g.balls.push({ id: 500, x: 5, y: 12, vx: 0, vy: 1 });
	for (let i = 0; i < 120; i++) { movePaddle(g, 9 + i / 100); step(g, dt); frames.push({ time: g.time, balls: globalThis.structuredClone(g.balls), paddleX: g.paddleX }); }
	collectPower(g, "rewind");
	for (let i = 118; i >= 0; i--) { step(g, dt); expect(g.time).toBeCloseTo(frames[i].time, 10); expect(g.balls).toEqual(frames[i].balls); expect(g.paddleX).toBe(frames[i].paddleX); }
	step(g, dt); expect(g.rewind).toBe(0); expect(g.balls[0].vx).toBe(1); expect(g.balls[0].x).toBe(9);
	step(g, dt); expect(g.balls[0].x).toBeGreaterThan(9);
});

test("historical bounces on destroyed bricks replay, then the new timeline passes through them", () => {
	const g = game(), brick = { id: 2, x: 9, y: 20, width: 2, height: 1, hits: 1, maxHits: 1 }; g.bricks.push(brick);
	Object.assign(g.balls[0], { x: 9, y: 18, vx: 0, vy: 10 });
	const frames = []; for (let i = 0; i < 48; i++) { step(g, dt); frames.push(globalThis.structuredClone(g.balls[0])); }
	expect(brick.hits).toBe(0); const score = g.score; collectPower(g, "rewind");
	for (let i = 46; i >= 0; i--) { step(g, dt); expect(g.balls[0]).toEqual(frames[i]); expect(brick.hits).toBe(0); expect(g.score).toBe(score); }
	step(g, dt); expect(g.balls[0].vy).toBe(10); advance(g, 0.4);
	expect(g.balls[0].y).toBeGreaterThan(brick.y + brick.height / 2); expect(g.balls[0].vy).toBe(10);
});

test("paddle bounces replay at their recorded positions even after the arena moves", () => {
	const g = game(); Object.assign(g.balls[0], { x: 9, y: 3, vx: 0, vy: -10 });
	const frames = []; for (let i = 0; i < 30; i++) { step(g, dt); frames.push(globalThis.structuredClone(g.balls[0])); }
	movePaddle(g, 3); step(g, dt); collectPower(g, "rewind");
	for (let i = 29; i >= 0; i--) { step(g, dt); expect(g.balls[0]).toEqual(frames[i]); expect(g.paddleX).toBe(9); }
	step(g, dt); expect(g.balls[0].vy).toBe(-10);
});

test("timers, consumed Armour, paddle extensions, queued charges and laser schedules return to the old state", () => {
	const g = game(); ["sight", "sticky", "laser", "armour", "wide", "fire"].forEach(power => collectPower(g, power));
	g.balls[0].slowUntil = 4; recordFrame(g); const initial = globalThis.structuredClone(g);
	advance(g, 0.5); collectPower(g, "shock"); g.leftHits = 0; g.queuedPowers = []; advance(g, 0.5);
	collectPower(g, "rewind"); advance(g, 1);
	for (const key of ["time", "sightUntil", "stickyUntil", "laserUntil", "nextLaserAt", "armour", "leftHits", "rightHits", "queuedPowers", "stunUntil"]) expect(g[key]).toEqual(initial[key]);
	expect(g.balls[0].slowUntil).toBe(4); expect(g.blasts).toHaveLength(0);
});

test("a lost or duplicated ball returns to its historical existence, and life loss can be undone", () => {
	const g = game(); recordFrame(g); advance(g, 0.25); collectPower(g, "duplicate"); advance(g, 0.25);
	g.balls.forEach(ball => ball.y = -2); step(g, dt); expect(g.lives).toBe(2); expect(g.mode).toBe("ready");
	expect(startRewind(g)).toBe(true); advance(g, 0.5 + dt);
	expect(g.lives).toBe(3); expect(g.balls).toHaveLength(1); expect(g.balls[0].x).toBe(9); expect(g.mode).toBe("playing");
});

test("brick rewards become available again but the triggering rewind pickup stays consumed", () => {
	const g = game(); recordFrame(g); advance(g, 0.25);
	g.drops.push({ id: 700, x: 9, y: 2.1, power: "sight", sourceBrickId: 2 }); step(g, dt);
	expect(g.sightUntil).toBeGreaterThan(0); advance(g, 0.25);
	g.drops.push({ id: 701, x: 9, y: 2.1, power: "rewind", sourceBrickId: 3 }); step(g, dt); expect(g.rewind).toBeGreaterThan(0);
	advance(g, 0.5 + 2 * dt); expect(g.rewind).toBe(0); expect(g.sightUntil).toBe(0);
	expect(g.drops.map(drop => drop.id)).toContain(700); expect(g.drops.map(drop => drop.id)).not.toContain(701);
});

test("five-second history is bounded; pauses freeze playback, inputs cannot change it, and forecasts stay pure", () => {
	const g = game(); advance(g, 7); collectPower(g, "rewind"); expect(g.rewind).toBeCloseTo(5);
	advance(g, 1); const before = JSON.stringify(g); expect(forecast(g)).toEqual([]); expect(JSON.stringify(g)).toBe(before);
	const x = g.paddleX; movePaddle(g, 2); collectPower(g, "duplicate"); expect(g.paddleX).toBe(x); expect(g.balls).toHaveLength(1);
	g.mode = "paused"; step(g, 20); expect(g.rewind).toBeCloseTo(4); g.mode = "playing"; advance(g, 4);
	expect(g.time).toBeCloseTo(2); expect(g.rewind).toBe(0); expect(g.balls[0].x).toBeCloseTo(11);
});

test("rewind history never crosses a level boundary or changes preserved moving/materialized bricks", () => {
	const g = game(); advance(g, 0.25); Object.assign(g.bricks[0], { x: 4, materialized: true }); collectPower(g, "rewind"); advance(g, 0.25);
	expect(g.bricks[0].x).toBe(4); expect(g.bricks[0].materialized).toBe(true);
	g.bricks[0].hits = 0; step(g, dt); nextLevel(g); expect(rewindAvailable(g)).toBeFalsy(); expect(startRewind(g)).toBe(false);
});

test("expired timed powers become active again when rewinding to before their expiry", () => {
	const g = game(); g.nextSightDropAt = 1000000; collectPower(g, "laser"); collectPower(g, "sight");
	advance(g, 14); expect(g.laserUntil <= g.time).toBe(true); expect(g.sightUntil <= g.time).toBe(true);
	collectPower(g, "rewind"); advance(g, 5);
	expect(g.time).toBeCloseTo(9); expect(g.laserUntil - g.time).toBeCloseTo(1); expect(g.sightUntil - g.time).toBeCloseTo(3);
});
