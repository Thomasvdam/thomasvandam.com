import { expect, test } from "bun:test";
import { collectPower, domeLevel, forecast, launch, newGame, step } from "./game";
import { DOME_TRAVEL, FIELD, surfacePoint, wrapX } from "./field";
import { LEVELS } from "./levels";
import { exportLevel, parseLevel, validateLevel } from "./level-format";

const tick = 1 / 120;
function setup() {
	const game = newGame(LEVELS.at(-1)); launch(game);
	game.bricks = [{ id: 1000, x: 9, y: 10, width: 1, height: 1, hits: 999, maxHits: 999 }];
	return game;
}

test("dome crossing travels over the top and descends at the antipode without a wall hit or lost speed", () => {
	const game = setup(), ball = game.balls[0], events = [];
	Object.assign(ball, { x: 14, y: FIELD.height - 0.01, vx: 0, vy: 8 });
	step(game, tick, true, Math.random, event => events.push(event));
	expect(ball.y).toBeGreaterThan(FIELD.height); expect(ball.vy).toBe(8); expect(ball.x).toBe(14);
	let highest = ball.y;
	for (let i = 0; i < 135; i++) { step(game, tick, true, Math.random, event => events.push(event)); highest = Math.max(highest, ball.y); }
	expect(highest).toBeGreaterThan(FIELD.height + DOME_TRAVEL - 0.1);
	expect(ball.x).toBe(wrapX(14 + FIELD.width / 2)); expect(ball.y).toBeLessThan(FIELD.height); expect(ball.vy).toBe(-8);
	expect(events).not.toContain("wall"); expect(game.lives).toBe(3);
});

test("Rewind retraces dome crossings and removes later duplicated balls", () => {
	const game = setup(); Object.assign(game.balls[0], { x: 3, y: FIELD.height + 2, vx: 0, vy: 8, effect: "fire" });
	const frames = [];
	for (let i = 0; i < 120; i++) { step(game, tick); frames.push(globalThis.structuredClone(game.balls[0])); }
	collectPower(game, "duplicate"); step(game, tick); collectPower(game, "rewind");
	for (let i = 119; i >= 0; i--) { step(game, tick); expect(game.balls).toHaveLength(1); expect(game.balls[0]).toEqual(frames[i]); }
	step(game, tick); expect(game.balls[0].x).toBe(3); expect(game.balls[0].y).toBe(FIELD.height + 2); expect(game.balls[0].vy).toBe(8);
});

test("Future Sight follows the curved crossing and return exactly without mutating live state", () => {
	const game = setup(); Object.assign(game.balls[0], { x: 17.9, y: FIELD.height - 0.1, vx: 2, vy: 8 });
	const snapshot = JSON.stringify(game), path = forecast(game)[0]; expect(JSON.stringify(game)).toBe(snapshot);
	expect(path.points.some(point => point.y > FIELD.height + DOME_TRAVEL / 2)).toBe(true);
	for (let i = 1; i < path.points.length; i++) {
		step(game, tick, false); expect(path.points[i].x).toBeCloseTo(game.balls[0].x, 10); expect(path.points[i].y).toBeCloseTo(game.balls[0].y, 10);
	}
});

test("surface projection is continuous at both dome joins, reaches the apex and switches visible sides", () => {
	const radius = 7.4, x = 4, epsilon = 0.00001;
	const entry = surfacePoint(x, FIELD.height, radius, true), start = surfacePoint(x, FIELD.height + epsilon, radius, true);
	const end = surfacePoint(x, FIELD.height + DOME_TRAVEL - epsilon, radius, true), exit = surfacePoint(x + FIELD.width / 2, FIELD.height - epsilon, radius, true);
	for (const axis of ["x", "y", "z"]) { expect(start[axis]).toBeCloseTo(entry[axis], 3); expect(end[axis]).toBeCloseTo(exit[axis], 3); }
	const apex = surfacePoint(x, FIELD.height + DOME_TRAVEL / 2, radius, true);
	expect(apex.x).toBeCloseTo(0); expect(apex.y).toBeCloseTo(0); expect(apex.z).toBeCloseTo(FIELD.height + radius);
	expect(Math.sign(end.y)).toBe(-Math.sign(start.y));
});

test("dome metadata round-trips through editor exports, with an early introduction and selected later domes", () => {
	const level = parseLevel(exportLevel(LEVELS.at(-1))); expect(level.ceiling).toBe("dome"); expect(domeLevel(newGame(level))).toBe(true);
	expect(validateLevel({ ...level, ceiling: "open" })).toContain("Ceiling must be flat or dome.");
	expect(LEVELS.flatMap((level, i) => level.ceiling === "dome" ? [i + 1] : [])).toEqual([2, 4, 6, 9, 11]);
	const game = newGame(), events = []; launch(game); Object.assign(game.balls[0], { y: FIELD.height - 0.1, vx: 0, vy: 8 });
	step(game, tick, true, Math.random, event => events.push(event)); expect(game.balls[0].vy).toBe(-8); expect(events).toContain("wall");
});
