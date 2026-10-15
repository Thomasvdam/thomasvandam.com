export const TILE_SIZE = 80;
export const TERRAIN_COLUMNS = 14;
export const TERRAIN_ROWS = 9;
export type Terrain = "firm" | "mud" | "rubble";
export type Undercarriage = "legs" | "wheels" | "tracks";
export const UNDERCARRIAGES = [
	{ id: "legs", name: "Legs", description: "Balanced on firm ground, mud, and rubble." },
	{ id: "wheels", name: "Wheels", description: "Fast on firm ground. Mud and rubble slow you down." },
	{ id: "tracks", name: "Tracks", description: "Slower, steady movement across every surface." },
] as const;
export const MOVEMENT: Record<Undercarriage, Record<Terrain, number>> = {
	legs: { firm: 1, mud: .85, rubble: .85 },
	wheels: { firm: 1.2, mud: .5, rubble: .65 },
	tracks: { firm: .9, mud: .9, rubble: .9 },
};
// A separate deterministic stream keeps terrain independent of combat/spawn randomness.
export function createTerrain(seed: number, depth: number): Terrain[] {
	let state = (seed ^ Math.imul(depth, 2654435761)) >>> 0;
	const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
	const tiles: Terrain[] = Array(TERRAIN_COLUMNS * TERRAIN_ROWS).fill("firm");
	for (let patch = 0; patch < 8; patch++) {
		const cx = Math.floor(random() * TERRAIN_COLUMNS), cy = Math.floor(random() * TERRAIN_ROWS);
		for (let y = 0; y < TERRAIN_ROWS; y++) for (let x = 0; x < TERRAIN_COLUMNS; x++) {
			if (((x - cx) / 2) ** 2 + ((y - cy) / 1.5) ** 2 <= 1) tiles[y * TERRAIN_COLUMNS + x] = patch % 2 ? "rubble" : "mud";
		}
	}
	// Arrival zone is always firm; other parts of the arena remain traversable.
	for (let y = 3; y <= 5; y++) for (let x = 6; x <= 7; x++) tiles[y * TERRAIN_COLUMNS + x] = "firm";
	return tiles;
}
export function terrainAt(tiles: Terrain[], x: number, y: number): Terrain {
	const column = Math.max(0, Math.min(TERRAIN_COLUMNS - 1, Math.floor(x / TILE_SIZE)));
	const row = Math.max(0, Math.min(TERRAIN_ROWS - 1, Math.floor(y / TILE_SIZE)));
	return tiles[row * TERRAIN_COLUMNS + column];
}
