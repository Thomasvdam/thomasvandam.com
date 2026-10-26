import { describe, expect, test } from "bun:test";
import { addTurn, parseGame, totals } from "./model.ts";

const game = () => ({ version: 1, names: ["Anne", "Bo"], turns: [] });

describe("score log", () => {
	test("adds positive, zero and negative scores to the chosen players", () => {
		let current = game();
		current = addTurn(current, 0, 500);
		current = addTurn(current, 1, 0);
		current = addTurn(current, 0, -200);
		current = addTurn(current, 1, -100);
		expect(totals(current)).toEqual([300, -100]);
		expect(totals({ ...current, turns: current.turns.slice(0, -1) })).toEqual([300, 0]);
		expect(totals(game())).toEqual([0, 0]);
	});
	test("round-trips the log without losing zero or negative entries", () => {
		const current = addTurn(addTurn(game(), 0, 0), 1, -200);
		expect(parseGame(JSON.stringify(current))).toEqual(current);
	});
	test("rejects invalid scores, player indices and unsafe totals", () => {
		for (const value of [NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) expect(() => addTurn(game(), 0, value)).toThrow();
		for (const player of [-1, 2, 0.5]) expect(() => addTurn(game(), player, 100)).toThrow();
		expect(() => addTurn(addTurn(game(), 0, Number.MAX_SAFE_INTEGER), 0, 1)).toThrow();
	});
	test("rejects malformed or unsupported saved games", () => {
		for (const data of [null, { ...game(), version: 2 }, { ...game(), names: ["Anne"] }, { ...game(), names: ["", "Bo"] }, { ...game(), turns: [null] }, { ...game(), turns: [{ player: 3, points: 500 }] }, { ...game(), turns: [{ player: 0, points: "500" }] }, { ...game(), turns: [{ player: 0, points: Number.MAX_SAFE_INTEGER }, { player: 0, points: 1 }] }]) expect(() => parseGame(JSON.stringify(data))).toThrow();
	});
});
