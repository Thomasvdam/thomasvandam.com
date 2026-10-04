import { describe, expect, test } from "bun:test";
import { collectPower, forecast, launch, MAX_BALLS, movePaddle, newGame, paddleBounds, paddleWidth, BALL_POWER_TYPES, POWER_TYPES, step } from "./game";

describe("Breakout simulation", () => {
	test("level contains all brick types and a ball follows the paddle before launch", () => {
		const g = newGame(); expect(g.bricks).toHaveLength(40);
		expect(new Set(g.bricks.map(b => b.maxHits))).toEqual(new Set([1, 2, 3]));
		expect(new Set(g.bricks.filter(b => b.power).map(b => b.power))).toEqual(new Set([...POWER_TYPES, "random"]));
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
	test("Future Sight pickups add their full duration, including simultaneous drops and expired effects", () => {
		const g = newGame(); launch(g);
		g.drops.push({ id: 1000, x: g.paddleX, y: 2.1, power: "sight" }, { id: 1001, x: g.paddleX, y: 2.1, power: "sight" });
		step(g, 1 / 120); expect(g.sightUntil - g.time).toBeCloseTo(24);
		g.time += 2; collectPower(g, "sight"); expect(g.sightUntil - g.time).toBeCloseTo(34);
		g.time = g.sightUntil + 5; collectPower(g, "sight"); expect(g.sightUntil - g.time).toBeCloseTo(12);
	});
	test("ten seconds without brick hits drops collectible Future Sight and repeats every ten seconds", () => {
		const g = newGame(); launch(g); Object.assign(g.balls[0], { x: 9, y: 5, vx: 0, vy: 0 });
		step(g, 9.99); expect(g.drops).toHaveLength(0); step(g, 0.01);
		expect(g.drops).toHaveLength(1); expect(g.drops[0].power).toBe("sight"); expect(g.drops[0].x).toBe(g.paddleX);
		const firstId = g.drops[0].id;
		for (let i = 0; i < 360; i++) step(g, 1 / 120);
		expect(g.sightUntil).toBeGreaterThan(g.time); expect(g.drops).toHaveLength(0);
		step(g, 6.99); expect(g.drops).toHaveLength(0); step(g, 0.02);
		expect(g.drops).toHaveLength(1); expect(g.drops[0].id).not.toBe(firstId);
	});
	test("any armored-brick hit restarts the idle timer, even at the drop deadline", () => {
		const g = newGame(); launch(g); g.time = 9.99;
		const brick = g.bricks[0]; Object.assign(g.balls[0], { x: brick.x, y: brick.y - 0.7, vx: 0, vy: 10 });
		step(g, 0.01); expect(brick.hits).toBe(2); expect(g.drops).toHaveLength(0);
		Object.assign(g.balls[0], { x: 9, y: 5, vx: 0, vy: 0 }); step(g, 9.99); expect(g.drops).toHaveLength(0);
		step(g, 0.01); expect(g.drops).toHaveLength(1);
	});
	test("idle assistance freezes while paused, restarts on a new life, and is absent from forecasts", () => {
		const g = newGame(); launch(g); Object.assign(g.balls[0], { x: 9, y: 5, vx: 0, vy: 0 });
		step(g, 9); g.mode = "paused"; step(g, 30); expect(g.time).toBe(9); expect(g.drops).toHaveLength(0);
		g.mode = "playing"; const before = JSON.parse(JSON.stringify(g)); forecast(g); expect(g).toEqual(before);
		step(g, 2, false); expect(g.drops).toHaveLength(0);
		g.balls[0].y = -2; step(g, 1 / 120); expect(g.mode).toBe("ready"); expect(g.drops).toHaveLength(0);
		launch(g); Object.assign(g.balls[0], { x: 9, y: 5, vx: 0, vy: 0 });
		step(g, 9.99); expect(g.drops).toHaveLength(0); step(g, 0.02); expect(g.drops).toHaveLength(1);
	});
	test("the top paddle follows steering and redirects upward balls only while active", () => {
		const g = newGame(); launch(g); collectPower(g, "top"); expect(g.topUntil).toBe(7);
		movePaddle(g, 12); Object.assign(g.balls[0], { x: 12.8, y: 23.5, vx: 0, vy: 10 }); step(g, 1 / 120);
		expect(g.balls[0].vy).toBeLessThan(0); expect(g.balls[0].vx).toBeGreaterThan(0);
		Object.assign(g.balls[0], { x: 8, y: 23.5, vx: 0, vy: 10 }); step(g, 1 / 120); expect(g.balls[0].vy).toBeGreaterThan(0);
		g.time = 7; Object.assign(g.balls[0], { x: 12, y: 23.5, vx: 0, vy: 10 }); step(g, 1 / 120); expect(g.balls[0].vy).toBeGreaterThan(0);
	});
	test("top-paddle duration pauses, refreshes on pickup, and clears on life loss", () => {
		const g = newGame(); launch(g); collectPower(g, "top"); g.mode = "paused"; step(g, 20); expect(g.topUntil - g.time).toBe(7);
		g.mode = "playing"; g.time = 3; collectPower(g, "top"); expect(g.topUntil - g.time).toBe(7);
		g.balls[0].y = -2; step(g, 1 / 120); expect(g.topUntil).toBe(0);
	});
	test("forecasts include the top paddle and its expiration within the next two seconds", () => {
		const g = newGame(); launch(g); collectPower(g, "top"); Object.assign(g.balls[0], { x: 9, y: 23.5, vx: 0, vy: 1 });
		const paths = forecast(g), copy = JSON.parse(JSON.stringify(g));
		for (let i = 0; i < 240; i++) step(copy, 1 / 120, false);
		expect(paths[0].points.at(-1).y).toBeCloseTo(copy.balls[0].y, 10); expect(paths[0].points.slice(0, 40).some(p => p.y < 23.5)).toBe(true);
		g.topUntil = g.time + 0.02; const expiredPath = forecast(g)[0]; expect(expiredPath.points.at(-1).y).toBeGreaterThan(25);
	});
	test("mystery bricks roll on destruction and drop a concrete power from the full pool", () => {
		POWER_TYPES.forEach((power, index) => {
			const g = newGame(); launch(g); const brick = g.bricks.find(b => b.power === "random");
			Object.assign(g.balls[0], { x: brick.x, y: brick.y - 0.7, vx: 0, vy: 10 });
			let rolls = 0; step(g, 1 / 120, true, () => { rolls++; return (index + 0.5) / POWER_TYPES.length; });
			expect(rolls).toBe(1); expect(g.drops).toHaveLength(1); expect(g.drops[0].power).toBe(power);
			Object.assign(g.balls[0], { x: 9, y: 5, vx: 0, vy: 0 });
			g.drops[0].x = g.paddleX; g.drops[0].y = 2.1; step(g, 1 / 120);
			expect(g.drops).toHaveLength(0);
			if (power === "top") expect(g.topUntil - g.time).toBe(7);
		});
	});
	test("forecast simulation never rolls mystery rewards", () => {
		const g = newGame(); launch(g); const brick = g.bricks.find(b => b.power === "random");
		Object.assign(g.balls[0], { x: brick.x, y: brick.y - 0.7, vx: 0, vy: 10 });
		step(g, 1 / 120, false, () => { throw new Error("Forecast rolled a reward"); });
		expect(brick.hits).toBe(0); expect(g.drops).toHaveLength(0);
	});
	test("ball pickups queue in order and one charge transfers only at a lower-paddle hit", () => {
		const g = newGame(); launch(g); collectPower(g, "fire"); collectPower(g, "piercing");
		expect(g.queuedPowers).toEqual(["fire", "piercing"]); expect(g.balls[0].effect).toBeUndefined();
		collectPower(g, "top"); Object.assign(g.balls[0], { x: 9, y: 23.5, vx: 0, vy: 10 }); step(g, 1 / 120);
		expect(g.queuedPowers).toHaveLength(2); expect(g.balls[0].effect).toBeUndefined();
		Object.assign(g.balls[0], { x: 9, y: 2.5, vx: 0, vy: -10 }); step(g, 1 / 120);
		expect(g.balls[0].effect).toBe("fire"); expect(g.queuedPowers).toEqual(["piercing"]);
		Object.assign(g.balls[0], { x: 9, y: 2.5, vx: 0, vy: -10 }); step(g, 1 / 120);
		expect(g.balls[0].effect).toBe("piercing"); expect(g.queuedPowers).toHaveLength(0);
	});
	test("a single stored charge goes to just one of two balls arriving together", () => {
		const g = newGame(); launch(g); collectPower(g, "duplicate"); collectPower(g, "homing");
		g.balls.forEach(b => Object.assign(b, { x: 9, y: 2.5, vx: 0, vy: -10 })); step(g, 1 / 120);
		expect(g.balls.filter(b => b.effect === "homing")).toHaveLength(1); expect(g.queuedPowers).toHaveLength(0);
	});
	test("piercing deals one damage per passage without reflecting, then can hit again on re-entry", () => {
		const g = newGame(); launch(g); const brick = g.bricks[0], ball = g.balls[0];
		Object.assign(ball, { effect: "piercing", x: brick.x, y: brick.y - 0.7, vx: 0, vy: 10 }); step(g, 1 / 120);
		expect(brick.hits).toBe(2); expect(ball.vy).toBe(10);
		for (let i = 0; i < 10; i++) step(g, 1 / 120);
		expect(brick.hits).toBe(2);
		for (let i = 0; i < 10; i++) step(g, 1 / 120);
		ball.vy = -10; for (let i = 0; i < 10; i++) step(g, 1 / 120);
		expect(brick.hits).toBe(1); expect(ball.vy).toBe(-10);
	});
	test("fire deals two brick damage and two damage to the extension it hits, without negatives", () => {
		const g = newGame(); launch(g); const brick = g.bricks[0], ball = g.balls[0];
		Object.assign(ball, { effect: "fire", x: brick.x, y: brick.y - 0.7, vx: 0, vy: 10 }); step(g, 1 / 120);
		expect(brick.hits).toBe(1); expect(ball.vy).toBeLessThan(0);
		collectPower(g, "wide"); Object.assign(ball, { x: g.paddleX - 2, y: 2.5, vx: 0, vy: -10 }); step(g, 1 / 120);
		expect(g.leftHits).toBe(3); expect(g.rightHits).toBe(5);
		g.rightHits = 1; Object.assign(ball, { x: paddleBounds(g).right - 0.08, y: 2.5, vx: 0, vy: -10 }); step(g, 1 / 120);
		expect(g.rightHits).toBe(0);
		Object.assign(ball, { x: brick.x, y: brick.y - 0.7, vx: 0, vy: 10 }); step(g, 1 / 120); expect(brick.hits).toBe(0);
	});
	test("ghost passes through bricks without damage and becomes normal only when fully above the highest live row", () => {
		const g = newGame(); launch(g); const ball = g.balls[0], brick = g.bricks[0];
		Object.assign(ball, { effect: "ghost", x: brick.x, y: brick.y - 0.7, vx: 0, vy: 10 }); step(g, 1 / 120);
		expect(brick.hits).toBe(3); expect(ball.vy).toBe(10); expect(ball.effect).toBe("ghost");
		for (let i = 0; i < 18; i++) step(g, 1 / 120); expect(ball.effect).toBeUndefined(); expect(brick.hits).toBe(3);
		Object.assign(ball, { x: brick.x, y: brick.y + 0.7, vx: 0, vy: -10 }); step(g, 1 / 120); expect(brick.hits).toBe(2); expect(ball.vy).toBeGreaterThan(0);
	});
	test("homing selects the closest live brick, turns gently, and preserves speed", () => {
		const g = newGame(); launch(g); g.bricks.forEach(b => b.hits = 0); g.bricks[0].hits = 3;
		Object.assign(g.bricks[0], { x: 12, y: 15 }); Object.assign(g.bricks[1], { x: 2, y: 22, hits: 2 }); Object.assign(g.bricks[2], { x: 8, y: 10, hits: 0 }); const ball = g.balls[0];
		Object.assign(ball, { effect: "homing", x: 9, y: 10, vx: 0, vy: 10 }); step(g, 1 / 120);
		expect(ball.vx).toBeGreaterThan(0); expect(ball.vx).toBeLessThan(0.04); expect(Math.hypot(ball.vx, ball.vy)).toBeCloseTo(10);
	});
	test("duplication preserves ball modifiers and independent contact history; life loss clears stored charges", () => {
		const g = newGame(); launch(g); Object.assign(g.balls[0], { effect: "piercing", contacts: [0] }); collectPower(g, "duplicate");
		expect(g.balls[1].effect).toBe("piercing"); expect(g.balls[1].contacts).toEqual([0]); expect(g.balls[1].contacts).not.toBe(g.balls[0].contacts);
		collectPower(g, "fire"); g.balls.forEach(b => b.y = -2); step(g, 1 / 120); expect(g.queuedPowers).toHaveLength(0); expect(g.balls[0].effect).toBeUndefined();
	});
	test("forecasts match modified trajectories and queued paddle transfers without consuming live charges", () => {
		for (const effect of BALL_POWER_TYPES) {
			const g = newGame(); launch(g); Object.assign(g.balls[0], { effect, x: 2, y: 20, vx: 0, vy: 10 });
			collectPower(g, "fire"); const before = JSON.parse(JSON.stringify(g)), path = forecast(g)[0]; expect(g).toEqual(before);
			for (let i = 0; i < path.points.length - 1; i++) step(before, 1 / 120, false);
			expect(path.points.at(-1).x).toBeCloseTo(before.balls[0].x, 10); expect(path.points.at(-1).y).toBeCloseTo(before.balls[0].y, 10);
		}
		const g = newGame(); launch(g); collectPower(g, "ghost"); Object.assign(g.balls[0], { x: 9, y: 3, vx: 0, vy: -10 });
		const before = JSON.parse(JSON.stringify(g)), path = forecast(g)[0]; expect(g.queuedPowers).toEqual(["ghost"]);
		for (let i = 0; i < path.points.length - 1; i++) step(before, 1 / 120, false);
		expect(before.queuedPowers).toHaveLength(0); expect(path.points.at(-1).y).toBeCloseTo(before.balls[0].y, 10);
	});
	test("two-second forecasts follow real wall, brick, and paddle collisions without mutating play", () => {
		const g = newGame(); launch(g); collectPower(g, "wide");
		Object.assign(g.balls[0], { x: 1, y: 10, vx: -7, vy: 8 });
		g.balls.push({ id: g.nextId++, x: 9, y: 5, vx: 0, vy: -10 });
		g.balls.push({ id: g.nextId++, x: 2, y: 21, vx: 0, vy: 10 });
		const before = JSON.parse(JSON.stringify(g)), paths = forecast(g);
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
