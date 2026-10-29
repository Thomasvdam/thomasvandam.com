export const PHASES = [
	"2 sets of 3", "1 set of 3 + 1 run of 4", "1 set of 4 + 1 run of 4",
	"1 run of 7", "1 run of 8", "1 run of 9", "2 sets of 4",
	"7 cards of one color", "1 set of 5 + 1 set of 2", "1 set of 5 + 1 set of 3",
] as const;

export type Entry = { points: number; completed: boolean };
export type Game = {
	version: 1;
	names: string[];
	firstStarter: number;
	rounds: Entry[][];
	draft: Entry[];
	tieWinner: number | null;
};
export const blankRound = (count: number): Entry[] => Array.from({ length: count }, () => ({ points: 0, completed: false }));

export function newGame(names: string[], firstStarter: number): Game {
	if (names.length < 2 || names.length > 6 || names.some(name => !name.trim() || name.trim().length > 24)) throw new Error("Enter 2–6 player names (up to 24 characters each).");
	if (!Number.isInteger(firstStarter) || firstStarter < 0 || firstStarter >= names.length) throw new Error("Choose a starting player.");
	return { version: 1, names: names.map(name => name.trim()), firstStarter, rounds: [], draft: blankRound(names.length), tieWinner: null };
}

export function standings(game: Game) {
	return game.names.map((name, index) => {
		const completed = game.rounds.filter(round => round[index].completed).length;
		return { name, completed, phase: Math.min(completed + 1, 10), score: game.rounds.reduce((sum, round) => sum + round[index].points, 0) };
	});
}

export function finalists(game: Game): number[] {
	const players = standings(game);
	const finished = players.filter(player => player.completed === 10);
	if (!finished.length) return [];
	const lowest = Math.min(...finished.map(player => player.score));
	return players.flatMap((player, index) => player.completed === 10 && player.score === lowest ? [index] : []);
}

export function nextGameStarter(game: Game): number {
	const finishers = finalists(game);
	const winner = game.tieWinner ?? (finishers.length === 1 ? finishers[0] : null);
	return game.names.length === 2 && winner !== null ? 1 - winner : 0;
}

export function roundError(entries: Entry[]): string | null {
	if (entries.some(entry => !Number.isInteger(entry.points) || entry.points < 0 || entry.points > 250 || entry.points % 5 !== 0 || typeof entry.completed !== "boolean")) return "Scores must be 0–250 in steps of 5.";
	if (!entries.some(entry => entry.completed && entry.points === 0)) return "Someone must go out: mark their phase complete and leave their round score at 0.";
	return null;
}

export function saveRound(game: Game): Game {
	if (finalists(game).length) throw new Error("This game has finished.");
	if (game.draft.length !== game.names.length) throw new Error("Missing player scores.");
	const error = roundError(game.draft);
	if (error) throw new Error(error);
	return { ...game, rounds: [...game.rounds, game.draft.map(entry => ({ ...entry }))], draft: blankRound(game.names.length) };
}

export function undoRound(game: Game): Game {
	if (!game.rounds.length) return game;
	return { ...game, rounds: game.rounds.slice(0, -1), draft: game.rounds.at(-1)!.map(entry => ({ ...entry })), tieWinner: null };
}

export function parseGame(raw: string): Game {
	const data = JSON.parse(raw);
	if (!data || data.version !== 1 || !Array.isArray(data.names) || data.names.some((name: unknown) => typeof name !== "string") || !Array.isArray(data.rounds) || !Array.isArray(data.draft)) throw new Error("Invalid saved game.");
	let game = newGame(data.names, data.firstStarter);
	const validEntries = (entries: unknown): entries is Entry[] => Array.isArray(entries) && entries.length === game.names.length && entries.every(entry => entry && typeof entry.completed === "boolean" && Number.isInteger(entry.points) && entry.points >= 0 && entry.points <= 250 && entry.points % 5 === 0);
	for (const round of data.rounds) {
		if (!validEntries(round)) throw new Error("Invalid saved round.");
		game = saveRound({ ...game, draft: round });
	}
	if (!validEntries(data.draft)) throw new Error("Invalid unfinished round.");
	if (data.tieWinner !== null && (!Number.isInteger(data.tieWinner) || finalists(game).length < 2 || !finalists(game).includes(data.tieWinner))) throw new Error("Invalid tie-break winner.");
	return { ...game, draft: data.draft, tieWinner: data.tieWinner };
}
