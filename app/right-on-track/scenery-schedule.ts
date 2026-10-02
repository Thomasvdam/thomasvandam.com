export const SCENERY_LENGTH = 220;
export type EncounterKind = "hut" | "lumberjack" | "crossing" | "bears" | "river";
export function encounterAt(seed: number, index: number) {
	let hash = Math.imul(seed ^ Math.imul(index + 1, 0x45d9f3b), 0x27d4eb2d);
	hash = Math.imul(hash ^ hash >>> 16, 0x85ebca6b);
	const random = ((hash ^ hash >>> 13) >>> 0) / 4294967296;
	const kind: EncounterKind | null = random < 0.02 ? "bears" : random < 0.10 ? "river" : random < 0.28 ? "hut" : random < 0.46 ? "lumberjack" : random < 0.64 ? "crossing" : null;
	return { kind, traffic: ((hash >>> 5) % 10) < 2, detail: (Math.imul(hash ^ 0x51ed270b, 0x27d4eb2d) >>> 0), distance: index * SCENERY_LENGTH + 90 + ((hash >>> 8) % 51) - 25, side: hash & 1 ? -1 : 1, cars: (hash >>> 16) % 4 };
}
