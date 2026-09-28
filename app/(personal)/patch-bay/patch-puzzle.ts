export type Tone = "warm" | "cool";
export type TileType = "source" | "target" | "straight" | "elbow" | "tee" | "phase" | "block";
export type Tile = { type: TileType; rotation: number; tone?: Tone; label?: string };
export type Piece = Tile & { id: number };
export type Board = (Piece | null)[];
export type Level = { title: string; difficulty: string; brief: string; hint: string; size: number; seed: number; shuffle: number; tiles: (Tile | null)[] };
export type Pulse = { powered: Record<number, Tone[]>; reached: string[]; wrong: string[]; won: boolean };

const tile = (type: TileType, rotation = 0, label?: string, tone?: Tone): Tile => ({ type, rotation, label, tone });

export const levels: Level[] = [
	{
		title: "Find a path", difficulty: "Easy", size: 3, seed: 11, shuffle: 12,
		brief: "Slide the tiles to carry the orange signal from OSC to speaker A.",
		hint: "An elbow turns the pulse. A straight tile carries it across opposite sides.",
		tiles: [
			tile("source", 1, "OSC"), tile("elbow", 2), null,
			tile("elbow", 2), tile("straight", 0), tile("elbow", 1),
			tile("straight", 0), tile("elbow", 0), tile("target", 3, "A", "warm"),
		],
	},
	{
		title: "Color detour", difficulty: "Medium", size: 4, seed: 8, shuffle: 24,
		brief: "Speaker A wants green. Find a way through the phase tile without losing the route.",
		hint: "The phase tile flips orange to green. It works like a straight tile, so the pulse must enter one end and leave the other.",
		tiles: [
			tile("source", 1, "OSC"), tile("elbow", 2), tile("elbow", 1), null,
			tile("straight", 1), tile("phase", 0), tile("block"), tile("elbow", 3),
			tile("straight", 0), tile("elbow", 0), tile("straight", 1), tile("elbow", 2),
			tile("straight", 0), tile("elbow", 1), tile("straight", 1), tile("target", 0, "A", "cool"),
		],
	},
	{
		title: "Split decision", difficulty: "Hard", size: 4, seed: 48, shuffle: 34,
		brief: "Light both speakers. A wants orange; B wants green. The phase tile flips a pulse's color.",
		hint: "A tee sends the pulse down every connected branch. Put the phase tile on only one branch.",
		tiles: [
			tile("source", 1, "OSC"), tile("tee", 2), tile("straight", 1), tile("target", 3, "A", "warm"),
			tile("elbow", 1), tile("phase", 0), tile("elbow", 3), tile("straight", 0),
			null, tile("elbow", 0), tile("straight", 1), tile("elbow", 2),
			tile("elbow", 1), tile("straight", 1), tile("straight", 0), tile("target", 0, "B", "cool"),
		],
	},
	{
		title: "Double back", difficulty: "Hard", size: 5, seed: 481, shuffle: 48,
		brief: "A wants green; B wants orange. The signal must change color twice before both can light.",
		hint: "Send green to A after the first phase tile. A second phase tile can turn the other branch orange again.",
		tiles: [
			tile("source", 1, "OSC"), tile("phase", 1), tile("tee", 2), tile("straight", 1), tile("target", 3, "A", "cool"),
			tile("elbow", 1), tile("straight", 1), tile("straight", 0), tile("elbow", 3), tile("straight", 1),
			tile("block"), tile("elbow", 2), tile("elbow", 0), tile("phase", 1), tile("elbow", 2),
			tile("straight", 0), tile("tee", 1), tile("straight", 1), tile("elbow", 1), tile("straight", 0),
			null, tile("elbow", 0), tile("straight", 0), tile("block"), tile("target", 0, "B", "warm"),
		],
	},
	{
		title: "Three wishes", difficulty: "Brutal", size: 5, seed: 445, shuffle: 64,
		brief: "Light all three speakers: A orange, B green, C orange. Two phase tiles can change the color twice.",
		hint: "A color flips each time it passes through a phase tile. Tee branches can carry different colors after they split.",
		tiles: [
			tile("source", 1, "OSC"), tile("tee", 2), tile("straight", 1), tile("straight", 1), tile("target", 3, "A", "warm"),
			tile("elbow", 2), tile("phase", 0), tile("straight", 1), tile("elbow", 1), tile("block"),
			tile("straight", 0), tile("tee", 1), tile("straight", 1), tile("elbow", 2), null,
			tile("elbow", 0), tile("phase", 0), tile("straight", 0), tile("straight", 0), tile("elbow", 2),
			tile("target", 1, "C", "warm"), tile("elbow", 3), tile("straight", 0), tile("elbow", 0), tile("target", 3, "B", "cool"),
		],
	},
	{
		title: "The long way home", difficulty: "Brutal", size: 6, seed: 574, shuffle: 90,
		brief: "Light A orange, B green, and C orange. Four phase tiles hide in the branches; every color must arrive right.",
		hint: "The first tee splits orange upward and right. Two flips bring A back to orange; the right branch can split green toward B and C.",
		tiles: [
			null, tile("elbow", 2), tile("straight", 1), tile("block"), tile("elbow", 0), tile("elbow", 1),
			tile("straight", 1), tile("elbow", 1), tile("phase", 1), tile("target", 3, "A", "warm"), tile("straight", 0), tile("elbow", 1),
			tile("block"), tile("phase", 0), tile("block"), tile("elbow", 1), tile("straight", 1), tile("target", 3, "B", "cool"),
			tile("elbow", 1), tile("tee", 0), tile("phase", 1), tile("tee", 0), tile("straight", 1), tile("elbow", 2),
			tile("straight", 0), tile("elbow", 1), tile("straight", 0), tile("block"), tile("elbow", 2), tile("phase", 0),
			tile("source", 0, "OSC"), tile("straight", 0), tile("block"), tile("elbow", 1), tile("straight", 1), tile("target", 0, "C", "warm"),
		],
	},
];

export const directions = [
	{ row: -1, col: 0, x: 50, y: 4 },
	{ row: 0, col: 1, x: 96, y: 50 },
	{ row: 1, col: 0, x: 50, y: 96 },
	{ row: 0, col: -1, x: 4, y: 50 },
];

export function ports(type: TileType, rotation: number): number[] {
	const base = type === "source" || type === "target" ? [0]
		: type === "straight" || type === "phase" ? [0, 2]
		: type === "elbow" ? [0, 1]
		: type === "tee" ? [0, 1, 3] : [];
	return base.map((direction) => (direction + rotation) % 4);
}

export function isFixed(tile: Tile) {
	return tile.type === "source" || tile.type === "target" || tile.type === "block";
}

export function adjacentIndices(index: number, size: number) {
	const row = Math.floor(index / size);
	const col = index % size;
	return directions.flatMap(({ row: dy, col: dx }) => {
		const nextRow = row + dy;
		const nextCol = col + dx;
		return nextRow >= 0 && nextCol >= 0 && nextRow < size && nextCol < size ? [nextRow * size + nextCol] : [];
	});
}

export function slideTile(board: Board, index: number, size: number): Board | null {
	const gap = board.findIndex((tile) => tile === null);
	const piece = board[index];
	if (gap === -1 || !piece || isFixed(piece) || !adjacentIndices(gap, size).includes(index)) return null;
	const next = [...board];
	next[gap] = piece;
	next[index] = null;
	return next;
}

export function scrambleLevel(level: Level): { board: Board; undo: number[] } {
	const board: Board = level.tiles.map((piece, id) => piece ? { ...piece, id } : null);
	if (board.filter((piece) => piece === null).length !== 1) throw new Error(`Level ${level.title} needs exactly one gap`);
	let gap = board.findIndex((piece) => piece === null);
	let previous = -1;
	let seed = level.seed;
	const undo: number[] = [];
	for (let step = 0; step < level.shuffle || traceSignal(level, board).won; step++) {
		const neighbors = adjacentIndices(gap, level.size).filter((index) => board[index] && !isFixed(board[index]!));
		const options = neighbors.filter((index) => index !== previous);
		const choices = options.length ? options : neighbors;
		if (!choices.length) throw new Error(`Level ${level.title} has a trapped gap`);
		seed = (seed * 1664525 + 1013904223) >>> 0;
		const chosen = choices[seed % choices.length];
		board[gap] = board[chosen];
		board[chosen] = null;
		undo.push(gap);
		previous = gap;
		gap = chosen;
		if (step > level.shuffle + 200) throw new Error(`Level ${level.title} could not be scrambled`);
	}
	return { board, undo: undo.reverse() };
}

export function traceSignal(level: Level, board: readonly (Tile | null)[] = level.tiles): Pulse {
	const powered: Record<number, Tone[]> = {};
	const reached = new Set<string>();
	const wrong = new Set<string>();
	const seen = new Set<string>();
	const source = board.findIndex((item) => item?.type === "source");
	if (source === -1) return { powered, reached: [], wrong: [], won: false };
	const queue = [{ index: source, direction: board[source]!.rotation, tone: "warm" as Tone }];
	powered[source] = ["warm"];

	for (let head = 0; head < queue.length; head++) {
		const signal = queue[head];
		const row = Math.floor(signal.index / level.size) + directions[signal.direction].row;
		const col = signal.index % level.size + directions[signal.direction].col;
		if (row < 0 || col < 0 || row >= level.size || col >= level.size) continue;
		const index = row * level.size + col;
		const next = board[index];
		if (!next || next.type === "block" || next.type === "source") continue;
		const entry = (signal.direction + 2) % 4;
		if (!ports(next.type, next.rotation).includes(entry)) continue;
		const tone = next.type === "phase" ? (signal.tone === "warm" ? "cool" : "warm") : signal.tone;
		const key = `${index}:${entry}:${tone}`;
		if (seen.has(key)) continue;
		seen.add(key);
		if (!powered[index]) powered[index] = [];
		if (!powered[index].includes(tone)) powered[index].push(tone);
		if (next.type === "target") {
			if (tone === next.tone) reached.add(next.label!);
			else wrong.add(next.label!);
			continue;
		}
		for (const direction of ports(next.type, next.rotation)) {
			if (direction !== entry) queue.push({ index, direction, tone });
		}
	}

	const targetCount = board.filter((item) => item?.type === "target").length;
	return { powered, reached: [...reached], wrong: [...wrong], won: reached.size === targetCount && wrong.size === 0 };
}
