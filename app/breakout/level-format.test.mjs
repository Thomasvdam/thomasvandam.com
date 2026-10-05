import { expect, test } from "bun:test";
import { LEVELS, levelBricks } from "./levels";
import { CELLS, bricksForLevel, exportLevel, parseLevel, validateLevel } from "./level-format";
import { launch, newGame, nextLevel, step } from "./game";

test("built-in levels use explicit symbols and source exports round-trip without altering any bricks", () => {
	LEVELS.forEach((level, index) => {
		expect(validateLevel(level)).toEqual([]);
		const imported = parseLevel(exportLevel(level)); expect(imported).toEqual(level);
		expect(bricksForLevel(imported)).toEqual(levelBricks(index));
		expect(parseLevel(JSON.stringify(level))).toEqual(level);
	});
});

test("every brush encodes exactly its displayed hit count and reward; gaps remain empty", () => {
	for (const [symbol, cell] of Object.entries(CELLS)) {
		if (symbol === ".") continue;
		const level = { name: "Brush test", width: 2, height: 1, columns: 2, xStep: 3, top: 20, yStep: 2, pattern: [symbol + (symbol === "I" ? "1" : ".")] };
		const bricks = bricksForLevel(parseLevel(exportLevel(level)), 500);
		expect(bricks).toHaveLength(symbol === "I" ? 2 : 1); expect(bricks[0].hits).toBe(cell.hits); expect(bricks[0].power).toBe(cell.power); expect(bricks[0].type).toBe(cell.type); expect(bricks[0].id).toBe(500);
	}
});

test("imports reject malformed, empty, oversized, overlapping and out-of-bounds definitions", () => {
	const bad = [null, [], {}, { ...LEVELS[0], name: "" }, { ...LEVELS[0], width: Infinity }, { ...LEVELS[0], columns: 0 }, { ...LEVELS[0], pattern: ["oops"] }, { ...LEVELS[0], pattern: ["########"] }, { ...LEVELS[0], pattern: ["........"] }, { ...LEVELS[0], xStep: 0.1 }, { ...LEVELS[0], top: 30 }, { ...LEVELS[0], pattern: Array(21).fill("11111111") }];
	bad.forEach(level => { expect(validateLevel(level).length).toBeGreaterThan(0); expect(() => parseLevel(JSON.stringify(level))).toThrow(); });
	expect(() => parseLevel("not JSON")).toThrow();
});

test("a custom play-test uses the exact draft and ends after one board without joining the campaign", () => {
	const campaignCount = LEVELS.length;
	const draft = { name: "One brick", width: 2, height: 1, columns: 1, xStep: 3, top: 20, yStep: 2, pattern: ["3"] };
	const g = newGame(draft); expect(g.bricks).toHaveLength(1); expect(g.customLevel.name).toBe("One brick"); launch(g);
	g.bricks[0].hits = 0; step(g, 1 / 120); expect(g.mode).toBe("won"); nextLevel(g); expect(g.mode).toBe("won");
	expect(newGame(draft).bricks[0].hits).toBe(3); expect(LEVELS).toHaveLength(campaignCount);
});

test("appending an exported definition automatically joins campaign progression", () => {
	const extra = parseLevel(exportLevel({ name: "Extra", width: 2, height: 1, columns: 1, xStep: 3, top: 20, yStep: 2, pattern: ["W"] }));
	const originalCount = LEVELS.length; LEVELS.push(extra);
	try {
		const g = newGame();
		for (let i = 0; i < originalCount; i++) { launch(g); g.bricks.forEach(b => b.hits = 0); step(g, 1 / 120); expect(g.mode).toBe("cleared"); nextLevel(g); }
		expect(g.level).toBe(originalCount); expect(g.bricks).toHaveLength(1); expect(g.bricks[0].power).toBe("wide");
		launch(g); g.bricks[0].hits = 0; step(g, 1 / 120); expect(g.mode).toBe("won");
	} finally { LEVELS.pop(); }
});

test("cylindrical layouts allow edge bricks, preserve intentional seams, and reject wrap overlap", () => {
	const ring = { ...LEVELS[0], columns: 9, width: 2, xStep: 2, pattern: ["111111111"] };
	expect(validateLevel(ring)).toEqual([]);
	expect(bricksForLevel(ring)).toHaveLength(9);
	expect(validateLevel({ ...ring, width: 2.1 })).not.toEqual([]);
	const opening = { ...ring, pattern: [".1111111."] };
	expect(bricksForLevel(parseLevel(exportLevel(opening)))).toHaveLength(7);
	const narrow = { ...LEVELS[0], xStep: 2 };
	expect(parseLevel(exportLevel(narrow)).xStep).toBe(2);
});
