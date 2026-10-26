import { describe, expect, test } from "bun:test";
import { addTurn, MAX_POINTS, parseGame, totals } from "./model.ts";

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
		for (const value of [NaN, Infinity, 1.5, 50, 150, -150, Number.MAX_SAFE_INTEGER + 1]) expect(() => addTurn(game(), 0, value)).toThrow();
		for (const player of [-1, 2, 0.5]) expect(() => addTurn(game(), player, 100)).toThrow();
		expect(() => addTurn(addTurn(game(), 0, MAX_POINTS), 0, 100)).toThrow();
	});
	test("rejects malformed or unsupported saved games", () => {
		for (const data of [null, { ...game(), version: 2 }, { ...game(), names: ["Anne"] }, { ...game(), names: ["", "Bo"] }, { ...game(), turns: [null] }, { ...game(), turns: [{ player: 3, points: 500 }] }, { ...game(), turns: [{ player: 0, points: "500" }] }, { ...game(), turns: [{ player: 0, points: Number.MAX_SAFE_INTEGER }, { player: 0, points: 1 }] }]) expect(() => parseGame(JSON.stringify(data))).toThrow();
	});
	test("Skull Island deducts from every opponent and leaves the active score alone", () => {
		const initial = { version: 1, names: ["Anne", "Bo", "Chris", "Daan"], turns: [] };
		let current = addTurn(addTurn(initial, 0, 500), 1, 200);
		const before = current;
		current = addTurn(current, 1, 400, "skull-island");
		expect(totals(current)).toEqual([100, 200, -400, -400]);
		expect(current.turns).toHaveLength(3);
		expect(parseGame(JSON.stringify(current))).toEqual(current);
		expect(totals({ ...current, turns: current.turns.slice(0, -1) })).toEqual(totals(before));
		expect(totals(addTurn(current, 2, 100))).toEqual([100, 200, -300, -400]);
	});
	test("Skull Island allows zero but rejects negative or non-hundred points", () => {
		expect(totals(addTurn(game(), 0, 0, "skull-island"))).toEqual([0, 0]);
		for (const points of [-100, 50, 450]) {
			expect(() => addTurn(game(), 0, points, "skull-island")).toThrow();
			expect(() => parseGame(JSON.stringify({ ...game(), turns: [{ player: 0, points, kind: "skull-island" }] }))).toThrow();
		}
	});
	test("checks opponent score overflow before recording Skull Island", () => {
		const current = addTurn(game(), 1, -MAX_POINTS);
		expect(() => addTurn(current, 0, 100, "skull-island")).toThrow();
		expect(current.turns).toHaveLength(1);
		expect(() => parseGame(JSON.stringify({ ...current, turns: [...current.turns, { player: 0, points: 100, kind: "skull-island" }] }))).toThrow();
	});
	test("preserves older manual saves and rejects unknown turn types", () => {
		const legacy = { ...game(), turns: [{ player: 0, points: 125 }] };
		expect(totals(parseGame(JSON.stringify(legacy)))).toEqual([125, 0]);
		expect(() => parseGame(JSON.stringify({ ...game(), turns: [{ player: 0, points: 100, kind: "unknown" }] }))).toThrow();
	});
});
