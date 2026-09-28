import { describe, expect, test } from "bun:test";
import { adjacentIndices, isFixed, levels, scrambleLevel, slideTile, traceSignal } from "./patch-puzzle.ts";

describe("sliding signal puzzles", () => {
	test.each([0, 1, 2, 3, 4, 5])("level %i has one gap and a solvable legal scramble", (index) => {
		const level = levels[index];
		expect(level.tiles.length).toBe(level.size * level.size);
		expect(level.tiles.filter((tile) => tile === null)).toHaveLength(1);
		expect(traceSignal(level).won).toBe(true);

		const { board, undo } = scrambleLevel(level);
		expect(board.filter((tile) => tile === null)).toHaveLength(1);
		expect(traceSignal(level, board).won).toBe(false);
		expect(undo.length).toBeGreaterThanOrEqual(level.shuffle);
		level.tiles.forEach((tile, position) => {
			if (tile && isFixed(tile)) expect(board[position]?.id).toBe(position);
		});

		let restored = board;
		for (const position of undo) {
			const next = slideTile(restored, position, level.size);
			expect(next).not.toBeNull();
			restored = next;
		}
		expect(restored.map((tile) => tile?.id ?? null)).toEqual(level.tiles.map((tile, position) => tile ? position : null));
		expect(traceSignal(level, restored).won).toBe(true);
	});

	test("only a movable neighbor can slide into the gap", () => {
		const level = levels[0];
		const { board } = scrambleLevel(level);
		const gap = board.indexOf(null);
		const neighbor = adjacentIndices(gap, level.size).find((position) => board[position] && !isFixed(board[position]));
		expect(neighbor).toBeDefined();
		expect(slideTile(board, neighbor, level.size)).not.toBeNull();
		expect(slideTile(board, board.findIndex((tile) => tile?.type === "source"), level.size)).toBeNull();
		expect(slideTile(board, gap, level.size)).toBeNull();
	});

	test("a slide updates a previously complete signal path", () => {
		const level = levels[0];
		const solved = level.tiles.map((tile, id) => tile ? { ...tile, id } : null);
		expect(traceSignal(level, solved).won).toBe(true);
		const broken = slideTile(solved, 1, level.size);
		expect(broken).not.toBeNull();
		expect(traceSignal(level, broken).won).toBe(false);
	});

	test("the live route rejects the wrong color", () => {
		const level = levels[2];
		const withoutPhase = [...level.tiles];
		withoutPhase[5] = { type: "straight", rotation: 0 };
		const result = traceSignal(level, withoutPhase);
		expect(result.won).toBe(false);
		expect(result.wrong).toContain("B");
	});
});
