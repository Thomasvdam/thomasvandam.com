import { describe, expect, test } from "bun:test";
import { blankRound, finalists, newGame, nextGameStarter, parseGame, saveRound, standings, undoRound } from "./model.ts";

const round = (game, entries) => saveRound({ ...game, draft: entries });
const entry = (points, completed) => ({ points, completed });

describe("Phase 10 scorekeeping", () => {
	test("the loser starts the next two-player game once the winner is decided", () => {
		let game = newGame(["A", "B"], 0);
		expect(nextGameStarter(game)).toBe(0);
		for (let i = 0; i < 10; i++) game = round(game, [entry(0, true), entry(0, true)]);
		expect(nextGameStarter(game)).toBe(0);
		expect(nextGameStarter({ ...game, tieWinner: 0 })).toBe(1);
		expect(nextGameStarter({ ...game, tieWinner: 1 })).toBe(0);
		const decisive = { ...game, rounds: game.rounds.map((entries, i) => i === 0 ? [entries[0], entry(5, true)] : entries) };
		expect(nextGameStarter(decisive)).toBe(1);
	});
	test("only completed phases advance; scores accumulate and seats stay in order", () => {
		let game = newGame(["A", "B", "C"], 2);
		game = round(game, [entry(0, true), entry(35, false), entry(10, true)]);
		game = round(game, [entry(25, false), entry(0, true), entry(15, true)]);
		expect(standings(game).map(p => [p.phase, p.score])).toEqual([[2, 25], [2, 35], [3, 25]]);
		expect((game.firstStarter + game.rounds.length) % 3).toBe(1);
	});
	test("finishing phase 10 beats a lower score on an earlier phase", () => {
		let game = newGame(["A", "B"], 0);
		for (let i = 0; i < 9; i++) game = round(game, [entry(5, true), entry(0, true)]);
		game = round(game, [entry(0, true), entry(0, false)]);
		expect(finalists(game)).toEqual([0]);
		expect(() => saveRound(game)).toThrow("finished");
	});
	test("simultaneous finish uses total points, with explicit ties", () => {
		let game = newGame(["A", "B", "C"], 0);
		for (let i = 0; i < 10; i++) game = round(game, [entry(0, true), entry(0, true), entry(5, true)]);
		expect(finalists(game)).toEqual([0, 1]);
		expect(parseGame(JSON.stringify({ ...game, tieWinner: 1 })).tieWinner).toBe(1);
		expect(() => parseGame(JSON.stringify({ ...game, tieWinner: 2 }))).toThrow();
	});
	test("undo restores phase, score, starting seat, and editable round", () => {
		const game = newGame(["A", "B"], 1);
		const draft = [entry(0, true), entry(25, false)];
		const restored = undoRound(round(game, draft));
		expect(restored).toEqual({ ...game, draft });
		expect(saveRound(restored)).toEqual(round(game, draft));
	});
	test("requires someone to go out and accepts only valid card points", () => {
		for (const draft of [[entry(5, true), entry(10, false)], [entry(0, false), entry(5, false)], [entry(0, true), entry(-5, false)], [entry(0, true), entry(3, false)], [entry(0, true), entry(255, false)]]) {
			expect(() => saveRound({ ...newGame(["A", "B"], 0), draft })).toThrow();
		}
	});
	test("saved games round-trip including an unfinished hand; corrupt saves are rejected", () => {
		const game = { ...round(newGame(["A", "B"], 1), [entry(0, true), entry(25, false)]), draft: [entry(15, true), entry(5, false)] };
		expect(parseGame(JSON.stringify(game))).toEqual(game);
		for (const patch of [{ version: 2 }, { names: ["A"] }, { firstStarter: -1 }, { draft: [] }, { draft: [null, null] }, { rounds: [blankRound(2)] }]) {
			expect(() => parseGame(JSON.stringify({ ...game, ...patch }))).toThrow();
		}
	});
});
