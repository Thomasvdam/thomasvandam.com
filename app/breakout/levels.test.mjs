import { expect, test } from "bun:test";
import { LEVELS, levelBricks } from "./levels";
import { collectPower, FIELD, forecast, launch, newGame, nextLevel, POWER_TYPES, step } from "./game";

function advanceLevel(game) {
	launch(game); game.bricks.forEach(brick => brick.hits = 0); step(game, 1 / 120); nextLevel(game);
}

test("three levels increase brick dimensions/count and keep separated bricks inside the playfield", () => {
	const counts = LEVELS.slice(0, 3).map((_, level) => levelBricks(level).length); expect(counts).toEqual([40, 60, 66]);
	LEVELS.forEach((layout, level) => {
		const bricks = levelBricks(level); expect(new Set(bricks.map(b => b.id)).size).toBe(bricks.length);
		if (level && level < 3) { expect(layout.width).toBeGreaterThan(LEVELS[level - 1].width); expect(layout.height).toBeGreaterThan(LEVELS[level - 1].height); }
		for (const brick of bricks) {
			expect(brick.x - brick.width / 2).toBeGreaterThan(0.3); expect(brick.x + brick.width / 2).toBeLessThan(FIELD.width - 0.3);
			expect(brick.y - brick.height / 2).toBeGreaterThan(FIELD.paddleY + 2); expect(brick.y + brick.height / 2).toBeLessThan(FIELD.topPaddleY - 0.5);
			for (const other of bricks) if (brick.id !== other.id) expect(Math.abs(brick.x - other.x) >= (brick.width + other.width) / 2 || Math.abs(brick.y - other.y) >= (brick.height + other.height) / 2).toBe(true);
		}
		expect(new Set(bricks.filter(b => b.power).map(b => b.power))).toEqual(new Set([...POWER_TYPES, "random"]));
		const armorHeights = bricks.filter(b => b.maxHits > 1).map(b => b.y), singleHeights = bricks.filter(b => b.maxHits === 1).map(b => b.y);
		expect(Math.min(...armorHeights)).toBeLessThan(Math.max(...singleHeights));
	});
});

test("Prism has a hollow center and tapered edges; Switchback alternates center and edge channels", () => {
	const prism = levelBricks(1); expect(prism.filter(b => b.y === LEVELS[1].top)).toHaveLength(3);
	const centerRow = LEVELS[1].top - 5 * LEVELS[1].yStep; expect(prism.filter(b => b.y === centerRow)).toHaveLength(4);
	expect(prism.some(b => b.y === centerRow && Math.abs(b.x - 9) < 3)).toBe(false);
	const switchback = levelBricks(2), row1 = LEVELS[2].top - LEVELS[2].yStep, row3 = LEVELS[2].top - 3 * LEVELS[2].yStep;
	expect(switchback.filter(b => b.y === row1).every(b => Math.abs(b.x - 9) > 3)).toBe(true);
	expect(switchback.filter(b => b.y === row3).every(b => Math.abs(b.x - 9) < 5)).toBe(true);
});

test("level transitions preserve score/lives, reset equipment, and win only after the final board", () => {
	const g = newGame(); g.score = 1200; g.lives = 2; collectPower(g, "wide"); collectPower(g, "fire"); collectPower(g, "top");
	launch(g); g.bricks.forEach(b => b.hits = 0); step(g, 1 / 120); expect(g.mode).toBe("cleared");
	const time = g.time; step(g, 20); expect(g.time).toBe(time);
	const previousIds = new Set(g.bricks.map(b => b.id)); nextLevel(g);
	expect(g.level).toBe(1); expect(g.mode).toBe("ready"); expect(g.score).toBe(1200); expect(g.lives).toBe(2); expect(g.bricks).toHaveLength(60);
	expect(g.bricks.every(b => !previousIds.has(b.id))).toBe(true); expect(g.leftHits + g.rightHits).toBe(0); expect(g.topUntil).toBe(0); expect(g.queuedPowers).toHaveLength(0); expect(g.balls).toHaveLength(1);
	expect(new Set([...g.bricks.map(b => b.id), g.balls[0].id]).size).toBe(61);
	advanceLevel(g); expect(g.level).toBe(2); expect(g.bricks).toHaveLength(66);
	while (g.level < LEVELS.length - 1) advanceLevel(g);
	launch(g); g.bricks.forEach(b => b.hits = 0); step(g, 1 / 120); expect(g.mode).toBe("won"); nextLevel(g); expect(g.level).toBe(LEVELS.length - 1); expect(g.mode).toBe("won");
	const reset = newGame(); expect(reset.level).toBe(0); expect(reset.score).toBe(0); expect(reset.lives).toBe(3); expect(reset.bricks).toHaveLength(40);
});

test("larger-brick collisions and ghost clearance use actual dimensions, including forecasts", () => {
	const g = newGame(); advanceLevel(g); const target = g.bricks[0];
	g.bricks.forEach(b => { if (b !== target) b.hits = 0; }); target.hits = 3;
	Object.assign(g.balls[0], { x: target.x + 1.2, y: target.y - 0.82, vx: 0, vy: 10 }); launch(g);
	Object.assign(g.balls[0], { vx: 0, vy: 10 }); const path = forecast(g)[0]; step(g, 1 / 120); step(g, 1 / 120);
	expect(target.hits).toBe(2); expect(g.balls[0].vy).toBeLessThan(0); expect(path.points.some(p => p.y < target.y - 0.82)).toBe(true);
	const ghost = newGame(); advanceLevel(ghost); advanceLevel(ghost); launch(ghost);
	Object.assign(ghost.balls[0], { x: 9, y: 23, vx: 0, vy: 0, effect: "ghost" }); step(ghost, 1 / 120); expect(ghost.balls[0].effect).toBe("ghost");
	ghost.balls[0].y = 23.05; step(ghost, 1 / 120); expect(ghost.balls[0].effect).toBeUndefined();
});

test("a simultaneous last-brick clear and ball loss cannot break advancing to the next level", () => {
	const g = newGame(); launch(g); g.bricks.forEach(b => b.hits = 0); g.balls[0].y = -2; step(g, 1 / 120);
	expect(g.mode).toBe("cleared"); expect(g.balls).toHaveLength(0); expect(() => nextLevel(g)).not.toThrow(); expect(g.balls).toHaveLength(1); expect(g.mode).toBe("ready");
});
