export type Tone = "warm" | "cool";
export type TileType = "source" | "target" | "straight" | "elbow" | "tee" | "phase" | "block";
export type Tile = { type: TileType; rotation: number; tone?: Tone; label?: string };
export type Level = { title: string; difficulty: string; brief: string; hint: string; size: number; tiles: (Tile | null)[] };
export type Pulse = { powered: Record<number, Tone[]>; reached: string[]; wrong: string[]; won: boolean };

const tile = (type: TileType, rotation = 0, label?: string, tone?: Tone): Tile => ({ type, rotation, label, tone });

export const levels: Level[] = [
	{
		title: "Find a path", difficulty: "Easy", size: 3,
		brief: "Rotate the tiles to carry the orange pulse from OSC to speaker A.",
		hint: "An elbow turns the pulse. A straight tile carries it across opposite sides.",
		tiles: [
			tile("source", 1, "OSC"), tile("elbow", 1), null,
			null, tile("straight", 3), tile("elbow", 1),
			tile("straight", 0), tile("elbow", 3), tile("target", 3, "A", "warm"),
		],
	},
	{
		title: "Split decision", difficulty: "Hard", size: 4,
		brief: "Light both speakers. A wants orange; B wants green. The phase tile flips a pulse's color.",
		hint: "A tee sends the pulse down every connected branch. Put the phase tile on only one branch.",
		tiles: [
			tile("source", 1, "OSC"), tile("tee", 0), tile("straight", 0), tile("target", 3, "A", "warm"),
			tile("elbow", 1), tile("phase", 1), tile("elbow", 3), tile("straight", 0),
			null, tile("elbow", 1), tile("straight", 0), tile("elbow", 0),
			null, tile("straight", 1), null, tile("target", 0, "B", "cool"),
		],
	},
	{
		title: "Three wishes", difficulty: "Brutal", size: 5,
		brief: "Light all three speakers: A orange, B green, C orange. Two phase tiles can change the color twice.",
		hint: "A color flips each time it passes through a phase tile. Tee branches can carry different colors after they split.",
		tiles: [
			tile("source", 1, "OSC"), tile("tee", 0), tile("straight", 0), tile("straight", 0), tile("target", 3, "A", "warm"),
			tile("elbow", 2), tile("phase", 1), tile("straight", 1), tile("elbow", 1), tile("block"),
			tile("straight", 0), tile("tee", 3), tile("straight", 0), tile("elbow", 0), null,
			tile("elbow", 0), tile("phase", 1), tile("straight", 0), tile("straight", 1), tile("elbow", 2),
			tile("target", 1, "C", "warm"), tile("elbow", 1), tile("straight", 0), tile("elbow", 2), tile("target", 3, "B", "cool"),
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

export function traceSignal(level: Level, rotations: number[]): Pulse {
	const powered: Record<number, Tone[]> = {};
	const reached = new Set<string>();
	const wrong = new Set<string>();
	const seen = new Set<string>();
	const source = level.tiles.findIndex((item) => item?.type === "source");
	if (source === -1) return { powered, reached: [], wrong: [], won: false };
	const queue = [{ index: source, direction: rotations[source], tone: "warm" as Tone }];
	powered[source] = ["warm"];

	for (let head = 0; head < queue.length; head++) {
		const signal = queue[head];
		const row = Math.floor(signal.index / level.size) + directions[signal.direction].row;
		const col = signal.index % level.size + directions[signal.direction].col;
		if (row < 0 || col < 0 || row >= level.size || col >= level.size) continue;
		const index = row * level.size + col;
		const next = level.tiles[index];
		if (!next || next.type === "block" || next.type === "source") continue;
		const entry = (signal.direction + 2) % 4;
		if (!ports(next.type, rotations[index]).includes(entry)) continue;
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
		for (const direction of ports(next.type, rotations[index])) {
			if (direction !== entry) queue.push({ index, direction, tone });
		}
	}

	const targetCount = level.tiles.filter((item) => item?.type === "target").length;
	return { powered, reached: [...reached], wrong: [...wrong], won: reached.size === targetCount && wrong.size === 0 };
}
