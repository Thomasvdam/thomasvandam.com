export type Turn = { player: number; points: number; kind?: "skull-island" };
export type Game = { version: 1; names: string[]; turns: Turn[] };
export const MAX_POINTS = Math.floor(Number.MAX_SAFE_INTEGER / 100) * 100;

function applyTurn(scores: number[], turn: Turn): number[] {
	return scores.map((score, player) => score + (turn.kind === "skull-island" ? (player === turn.player ? 0 : -turn.points) : (player === turn.player ? turn.points : 0)));
}

export function totals(game: Game): number[] {
	return game.turns.reduce(applyTurn, game.names.map(() => 0));
}

export function addTurn(game: Game, player: number, points: number, kind?: "skull-island"): Game {
	if (!Number.isInteger(player) || player < 0 || player >= game.names.length || !Number.isSafeInteger(points) || points % 100 !== 0) throw new Error("Choose points in steps of 100 within the supported range.");
	if (kind !== undefined && kind !== "skull-island") throw new Error("Unknown turn type.");
	if (kind === "skull-island" && points < 0) throw new Error("Skull Island points cannot be negative.");
	const turn: Turn = kind ? { player, points, kind } : { player, points };
	if (!applyTurn(totals(game), turn).every(Number.isSafeInteger)) throw new Error("That score would exceed the supported range.");
	return { ...game, turns: [...game.turns, turn] };
}

export function parseGame(raw: string): Game {
	const data = JSON.parse(raw);
	if (data?.version !== 1 || !Array.isArray(data.names) || data.names.length < 2 || data.names.length > 8 || !data.names.every((name: unknown) => typeof name === "string" && name.trim().length > 0 && name.length <= 24) || !Array.isArray(data.turns)) throw new Error("Invalid save");
	let scores = data.names.map(() => 0);
	const turns: Turn[] = [];
	for (const turn of data.turns) {
		if (!turn || !Number.isInteger(turn.player) || turn.player < 0 || turn.player >= data.names.length || !Number.isSafeInteger(turn.points) || (turn.kind !== undefined && turn.kind !== "skull-island")) throw new Error("Invalid turn");
		if (turn.kind === "skull-island" && (turn.points < 0 || turn.points % 100 !== 0)) throw new Error("Invalid Skull Island turn");
		// Existing normal entries remain readable, including scores entered before the wheel.
		const entry: Turn = turn.kind ? { player: turn.player, points: turn.points, kind: turn.kind } : { player: turn.player, points: turn.points };
		scores = applyTurn(scores, entry);
		if (!scores.every(Number.isSafeInteger)) throw new Error("Invalid total");
		turns.push(entry);
	}
	return { version: 1, names: data.names, turns };
}
