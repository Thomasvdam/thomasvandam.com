export type Turn = { player: number; points: number };
export type Game = { version: 1; names: string[]; turns: Turn[] };

export function totals(game: Game): number[] {
	return game.turns.reduce((scores, turn) => {
		scores[turn.player] += turn.points;
		return scores;
	}, game.names.map(() => 0));
}

export function addTurn(game: Game, player: number, points: number): Game {
	if (!Number.isInteger(player) || player < 0 || player >= game.names.length || !Number.isSafeInteger(points) || !Number.isSafeInteger(totals(game)[player] + points)) throw new Error("Enter a whole number within the supported range.");
	return { ...game, turns: [...game.turns, { player, points }] };
}

export function parseGame(raw: string): Game {
	const data = JSON.parse(raw);
	if (data?.version !== 1 || !Array.isArray(data.names) || data.names.length < 2 || data.names.length > 8 || !data.names.every((name: unknown) => typeof name === "string" && name.trim().length > 0 && name.length <= 24) || !Array.isArray(data.turns)) throw new Error("Invalid save");
	// Validate accumulated scores as well as each individual entry.
	const scores = data.names.map(() => 0);
	for (const turn of data.turns) {
		if (!turn || !Number.isInteger(turn.player) || turn.player < 0 || turn.player >= data.names.length || !Number.isSafeInteger(turn.points)) throw new Error("Invalid turn");
		scores[turn.player] += turn.points;
		if (!Number.isSafeInteger(scores[turn.player])) throw new Error("Invalid total");
	}
	return { version: 1, names: data.names, turns: data.turns.map(({ player, points }: Turn) => ({ player, points })) };
}
