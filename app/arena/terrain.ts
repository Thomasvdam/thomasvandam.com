export const TILE_SIZE = 80;
export const TERRAIN_COLUMNS = 14;
export const TERRAIN_ROWS = 9;
export type Terrain = "firm" | "mud" | "rubble";
export type Undercarriage = "legs" | "wheels" | "tracks";
export const UNDERCARRIAGES = [
	{ id: "legs", name: "Legs", description: "Full speed on firm ground and rubble. Mud is difficult." },
	{ id: "wheels", name: "Wheels", description: "Fast on firm ground. Mud and rubble slow you down." },
	{ id: "tracks", name: "Treads", description: "Slower, steady movement across every surface." },
] as const;
export const MOVEMENT: Record<Undercarriage, Record<Terrain, number>> = {
	legs: { firm: 1, mud: .25, rubble: 1 },
	wheels: { firm: 1.5, mud: .375, rubble: .375 },
	tracks: { firm: .75, mud: .75, rubble: .75 },
};
// A separate deterministic stream keeps terrain independent of combat/spawn randomness.
export function createTerrain(seed: number, depth: number): Terrain[] {
	let state = (seed ^ Math.imul(depth, 2654435761)) >>> 0;
	const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
	const types: Terrain[] = ["firm", "mud", "rubble"];
	const dominant = types[((seed >>> 0) + depth - 1) % types.length];
	const other = types.filter(type => type !== dominant);
	const tiles: Terrain[] = Array(TERRAIN_COLUMNS * TERRAIN_ROWS).fill(dominant);
	for (let patch = 0; patch < 4; patch++) {
		const cx = Math.floor(random() * TERRAIN_COLUMNS), cy = Math.floor(random() * TERRAIN_ROWS);
		for (let y = 0; y < TERRAIN_ROWS; y++) for (let x = 0; x < TERRAIN_COLUMNS; x++) {
			if (((x - cx) / 2) ** 2 + ((y - cy) / 1.5) ** 2 <= 1) tiles[y * TERRAIN_COLUMNS + x] = other[patch % other.length];
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

export const TERRAIN_NAMES: Record<Terrain, string> = { firm: "Firm ground", mud: "Mud", rubble: "Rubble" };
export function terrainSummary(tiles: Terrain[]) {
	const summary = (["firm", "mud", "rubble"] as const).map(id => {
		const count = tiles.filter(tile => tile === id).length;
		return { id, name: TERRAIN_NAMES[id], count, percent: Math.floor(count / tiles.length * 100) };
	});
	// Distribute rounding remainders so the displayed coverage adds up to 100%.
	const remaining = 100 - summary.reduce((sum, surface) => sum + surface.percent, 0);
	const byRemainder = [...summary].sort((a, b) => (b.count / tiles.length * 100 - b.percent) - (a.count / tiles.length * 100 - a.percent));
	for (let index = 0; index < remaining; index++) byRemainder[index].percent++;
	return summary.sort((a, b) => b.count - a.count);
}
