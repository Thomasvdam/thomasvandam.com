import { expect, test } from "bun:test";
import { collectPower, destructible, forecast, launch, movePaddle, newGame, nextLevel, paddleBounds, paddleWidth, releaseBalls, step } from "./game";
import { LEVELS, levelBricks } from "./levels";
import { parseLevel, exportLevel, validateLevel } from "./level-format";
const dt = 1 / 120;
function game() {
	const g = newGame(); launch(g);
	g.bricks = [{ id: 1, x: 9, y: 15, width: 2, height: 1, hits: 99, maxHits: 99 }];
	Object.assign(g.balls[0], { x: 3, y: 8, vx: 0, vy: 0 }); return g;
}
function advance(g, seconds, emit) { for (let i = 0; i < Math.round(seconds * 120); i++) step(g, dt, true, () => 0, emit); }
function land(g, x = 9) { Object.assign(g.balls[0], { x, y: 2.5, vx: 0, vy: -10 }); step(g, dt); return g.balls[0]; }

test("Sticky holds the normal outgoing velocity and queued modifier, follows steering, then releases unchanged", () => {
	const normal = game(), expected = land(normal, 9.6);
	const g = game(); collectPower(g, "sticky"); collectPower(g, "fire"); const b = land(g, 9.6);
	expect(b.attachedOffset).toBeCloseTo(0.6); expect(b.vx).toBeCloseTo(expected.vx); expect(b.vy).toBeCloseTo(expected.vy); expect(b.effect).toBe("fire");
	const velocity = [b.vx, b.vy]; movePaddle(g, 12); expect(b.x).toBeCloseTo(12.6); const y = b.y; advance(g, 1); expect(b.y).toBe(y);
	releaseBalls(g); expect(b.attachedOffset).toBeUndefined(); expect([b.vx, b.vy]).toEqual(velocity); step(g, dt); expect(b.y).toBeGreaterThan(y);
});

test("Sticky catches multiple balls, releases them together and expires after twenty playing seconds", () => {
	const g = game(); collectPower(g, "sticky"); land(g); collectPower(g, "duplicate"); expect(g.balls.every(b => b.attachedOffset !== undefined)).toBe(true);
	g.mode = "paused"; step(g, 50); expect(g.time).toBeCloseTo(dt); expect(g.balls.every(b => b.attachedOffset !== undefined)).toBe(true);
	g.mode = "playing"; advance(g, 20); expect(g.balls.every(b => b.attachedOffset === undefined)).toBe(true);
	const fresh = game(); collectPower(fresh, "sticky"); land(fresh); collectPower(fresh, "duplicate"); releaseBalls(fresh); expect(fresh.balls.every(b => b.attachedOffset === undefined && b.vy > 0)).toBe(true);
});

test("laser fires ten straight blasts at one-second intervals and pauses its schedule", () => {
	const g = game(), events = []; collectPower(g, "laser"); advance(g, 0.5, e => events.push(e)); expect(events.filter(e => e === "blast")).toHaveLength(0);
	g.mode = "paused"; step(g, 30); expect(g.time).toBeCloseTo(0.5); g.mode = "playing";
	advance(g, 9.5, e => events.push(e)); expect(events.filter(e => e === "blast")).toHaveLength(10); advance(g, 2, e => events.push(e)); expect(events.filter(e => e === "blast")).toHaveLength(10);
	expect(g.bricks[0].hits).toBe(89);
	const steering = game(); collectPower(steering, "laser"); movePaddle(steering, 5); advance(steering, 1); expect(steering.blasts[0].x).toBe(5); const x = steering.blasts[0].x; movePaddle(steering, 12); step(steering, dt); expect(steering.blasts[0].x).toBe(x);
});

test("a laser damages only its closest solid brick, releases rewards, and pushes moving armor", () => {
	const g = game(); g.bricks = [{ id: 1, x: 9, y: 8, width: 2, height: 1, hits: 1, maxHits: 1, power: "armour" }, { id: 2, x: 9, y: 12, width: 2, height: 1, hits: 3, maxHits: 3 }];
	g.blasts.push({ id: 100, x: 9, y: 7 }); step(g, 0.2); expect(g.bricks[0].hits).toBe(0); expect(g.bricks[1].hits).toBe(3); expect(g.drops[0].power).toBe("armour"); expect(g.blasts).toHaveLength(0);
	const moving = game(); moving.bricks[0].type = "moving"; moving.blasts.push({ id: 100, x: 9, y: 14.3 }); step(moving, dt); expect(moving.bricks[0].hits).toBe(98); expect(moving.bricks[0].y).toBeCloseTo(15.8);
});

test("laser passes intangible phase bricks and is blocked by indestructible bricks", () => {
	const g = game(); g.bricks = [{ id: 1, x: 9, y: 8, width: 2, height: 1, hits: 1, maxHits: 1, type: "phase" }, { id: 2, x: 9, y: 12, width: 2, height: 1, hits: 1, maxHits: 1, type: "indestructible" }, { id: 3, x: 9, y: 15, width: 2, height: 1, hits: 3, maxHits: 3 }];
	g.blasts.push({ id: 100, x: 9, y: 7 }); step(g, 0.2); expect(g.bricks.map(b => b.hits)).toEqual([1, 1, 3]); expect(g.bricks[0].materialized).toBeUndefined(); expect(g.blasts).toHaveLength(0); expect(g.score).toBe(0);
});

test("Armour consumes exactly one Shock or Shrink and never consumes beneficial pickups", () => {
	for (const hazard of ["shock", "shrink"]) {
		const g = game(), events = []; collectPower(g, "armour"); collectPower(g, "laser"); expect(g.armour).toBe(true);
		collectPower(g, hazard, e => events.push(e)); expect(g.armour).toBe(false); expect(g.stunUntil).toBe(0); expect(g.shrinkUntil).toBe(0); expect(events).toEqual(["shield"]);
		collectPower(g, hazard); expect(hazard === "shock" ? g.stunUntil : g.shrinkUntil).toBeGreaterThan(g.time);
	}
	const g = game(); collectPower(g, "armour"); collectPower(g, "armour"); collectPower(g, "shock"); collectPower(g, "shrink"); expect(g.shrinkUntil).toBe(15);
});

test("Armour survives time, life loss and level transitions until used", () => {
	const g = game(); collectPower(g, "armour"); advance(g, 30); expect(g.armour).toBe(true);
	g.balls[0].y = -2; step(g, dt); expect(g.armour).toBe(true); launch(g); g.bricks[0].hits = 0; step(g, dt); nextLevel(g); expect(g.armour).toBe(true); expect(newGame().armour).toBe(false);
});

test("Shrink scales the core and extensions, preserves durability, and restores after fifteen playing seconds", () => {
	const g = game(); collectPower(g, "wide"); const width = paddleWidth(g); collectPower(g, "shrink"); expect(paddleWidth(g)).toBeCloseTo(width * 0.6);
	const bounds = paddleBounds(g); expect(bounds.right - bounds.left).toBeCloseTo(width * 0.6); movePaddle(g, -100); expect(g.paddleX).toBeCloseTo(8);
	g.mode = "paused"; step(g, 30); expect(paddleWidth(g)).toBeCloseTo(width * 0.6); g.mode = "playing"; advance(g, 15 + dt); expect(paddleWidth(g)).toBeCloseTo(width); expect(g.leftHits + g.rightHits).toBe(10); expect(g.paddleX).toBeCloseTo(8);
});

test("shrunk paddle collisions use the new width and Sticky attachments remain on the shrinking surface", () => {
	const miss = game(); collectPower(miss, "shrink"); const missed = land(miss, 10.3); expect(missed.vy).toBeLessThan(0);
	const catchGame = game(); collectPower(catchGame, "shrink"); expect(land(catchGame, 9.8).vy).toBeGreaterThan(0);
	const g = game(); collectPower(g, "wide"); collectPower(g, "sticky"); const b = land(g, 11); collectPower(g, "shrink"); expect(b.x).toBeLessThanOrEqual(paddleBounds(g).right); expect(b.attachedOffset).toBeDefined();
});

test("indestructible bricks never lose HP or award score and do not prevent level completion", () => {
	for (const effect of [undefined, "fire", "ghost", "piercing"]) {
		const g = game(); g.bricks.push({ id: 2, x: 9, y: 20, width: 2, height: 1, hits: 1, maxHits: 1, type: "indestructible" });
		Object.assign(g.balls[0], { x: 9, y: 19.2, vx: 0, vy: 10, effect }); step(g, dt); expect(g.bricks[1].hits).toBe(1); expect(g.score).toBe(0);
		expect(g.balls[0].vy > 0).toBe(effect === "ghost" || effect === "piercing");
		g.bricks[0].hits = 0; step(g, dt); expect(g.mode).toBe("cleared");
	}
});

test("new powers and blockers round-trip from every campaign board; blocker-only editor levels are rejected", () => {
	for (const [index, level] of LEVELS.entries()) { expect(levelBricks(index)).toEqual(newGame(parseLevel(exportLevel(level))).bricks); expect(levelBricks(index).some(b => !destructible(b))).toBe(true); }
	expect(validateLevel({ ...LEVELS[0], columns: 1, pattern: ["I"] }).length).toBeGreaterThan(0);
});

test("Future Sight includes attached balls, expiry, shrinking and laser damage without touching live state", () => {
	for (const attached of [false, true]) {
		const g = game(); collectPower(g, "laser"); collectPower(g, "shrink"); collectPower(g, "sticky"); if (attached) land(g);
		g.stickyUntil = g.time + 0.5; g.shrinkUntil = g.time + 0.2; g.blasts.push({ id: 100, x: 9, y: 14.3 });
		const before = JSON.stringify(g), path = forecast(g)[0]; expect(JSON.stringify(g)).toBe(before); const live = globalThis.structuredClone(g);
		for (let i = 1; i < path.points.length; i++) { step(live, dt, false); const b = live.balls.find(b => b.id === path.id); if (!b) break; expect(path.points[i].x).toBeCloseTo(b.x, 8); expect(path.points[i].y).toBeCloseTo(b.y, 8); }
	}
});

test("timed paddle effects and live blasts clear on life loss and level transitions", () => {
	for (const transition of [false, true]) {
		const g = game(); ["sticky", "laser", "shrink"].forEach(p => collectPower(g, p)); g.blasts.push({ id: 500, x: 9, y: 5 });
		if (transition) { g.bricks[0].hits = 0; step(g, dt); nextLevel(g); } else { g.balls[0].y = -2; step(g, dt); }
		expect(g.stickyUntil + g.laserUntil + g.shrinkUntil + g.nextLaserAt).toBe(0); expect(g.blasts).toHaveLength(0); expect(g.balls).toHaveLength(1);
	}
});

test("simultaneous hazards consume one Armour charge and apply the second hazard", () => {
	const g = game(); collectPower(g, "armour"); g.drops.push({ id: 501, x: 9, y: 2.1, power: "shock" }, { id: 502, x: 9, y: 2.1, power: "shrink" }); step(g, dt);
	expect(g.armour).toBe(false); expect(g.stunUntil).toBe(0); expect(g.shrinkUntil).toBeCloseTo(g.time + 15); expect(g.drops).toHaveLength(0);
});
