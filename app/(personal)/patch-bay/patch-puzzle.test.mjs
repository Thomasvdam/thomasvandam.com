import { describe, expect, test } from "bun:test";
import { levels, traceSignal } from "./patch-puzzle.ts";

const solutions = [
	{ 1: 2, 4: 0, 7: 0 },
	{ 1: 2, 5: 0, 9: 0, 10: 1, 11: 2 },
	{ 1: 2, 2: 1, 5: 0, 9: 0, 10: 1, 11: 2 },
	{ 1: 1, 2: 2, 3: 1, 7: 0, 12: 0, 13: 1, 14: 2, 19: 0 },
	{ 1: 2, 2: 1, 3: 1, 6: 0, 11: 1, 12: 1, 13: 2, 16: 0, 18: 0, 21: 3, 23: 0 },
	{ 7: 1, 8: 1, 13: 0, 15: 1, 16: 1, 18: 1, 19: 0, 20: 1, 21: 0, 22: 1, 23: 2, 24: 0, 29: 0 },
];

function rotations(levelIndex) {
	const values = levels[levelIndex].tiles.map((tile) => tile?.rotation ?? 0);
	for (const [index, rotation] of Object.entries(solutions[levelIndex])) values[Number(index)] = rotation;
	return values;
}

describe("authored signal puzzles", () => {
	test.each([0, 1, 2, 3, 4, 5])("level %i starts unsolved and has a working solution", (index) => {
		const level = levels[index];
		expect(traceSignal(level, level.tiles.map((tile) => tile?.rotation ?? 0)).won).toBe(false);
		const result = traceSignal(level, rotations(index));
		expect(result.won).toBe(true);
		expect(result.reached.length).toBe(level.tiles.filter((tile) => tile?.type === "target").length);
		expect(result.wrong).toEqual([]);
	});

	test("an orange pulse cannot satisfy a green receiver", () => {
		const level = levels[2];
		const withoutPhase = { ...level, tiles: [...level.tiles] };
		withoutPhase.tiles[5] = { type: "straight", rotation: 0 };
		const result = traceSignal(withoutPhase, rotations(2));
		expect(result.won).toBe(false);
		expect(result.reached).not.toContain("B");
		expect(result.wrong).toContain("B");
	});

	test("the splitter must feed both branches", () => {
		const level = levels[2];
		const values = rotations(2);
		values[1] = 1;
		const result = traceSignal(level, values);
		expect(result.won).toBe(false);
		expect(result.reached.length).toBeLessThan(2);
	});
});
