import { describe, expect, test } from "bun:test";
import { levels, traceSignal } from "./patch-puzzle.ts";

const solutions = [
	{ 1: 2, 4: 0, 7: 0 },
	{ 1: 2, 2: 1, 5: 0, 9: 0, 10: 1, 11: 2 },
	{ 1: 2, 2: 1, 3: 1, 6: 0, 11: 1, 12: 1, 13: 2, 16: 0, 18: 0, 21: 3, 23: 0 },
];

function rotations(levelIndex) {
	const values = levels[levelIndex].tiles.map((tile) => tile?.rotation ?? 0);
	for (const [index, rotation] of Object.entries(solutions[levelIndex])) values[Number(index)] = rotation;
	return values;
}

describe("authored signal puzzles", () => {
	test.each([0, 1, 2])("level %i starts unsolved and has a working solution", (index) => {
		const level = levels[index];
		expect(traceSignal(level, level.tiles.map((tile) => tile?.rotation ?? 0)).won).toBe(false);
		const result = traceSignal(level, rotations(index));
		expect(result.won).toBe(true);
		expect(result.reached.length).toBe(index + 1);
		expect(result.wrong).toEqual([]);
	});

	test("an orange pulse cannot satisfy a green receiver", () => {
		const level = levels[1];
		const withoutPhase = { ...level, tiles: [...level.tiles] };
		withoutPhase.tiles[5] = { type: "straight", rotation: 0 };
		const result = traceSignal(withoutPhase, rotations(1));
		expect(result.won).toBe(false);
		expect(result.reached).not.toContain("B");
		expect(result.wrong).toContain("B");
	});

	test("the splitter must feed both branches", () => {
		const level = levels[1];
		const values = rotations(1);
		values[1] = 1;
		const result = traceSignal(level, values);
		expect(result.won).toBe(false);
		expect(result.reached.length).toBeLessThan(2);
	});
});
