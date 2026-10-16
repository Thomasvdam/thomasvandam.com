import { createTerrain, type Terrain } from "./terrain";

export type Hive = { id: string; name: string; activity: "Low" | "Moderate" | "High"; threat: number; payment: number; terrain: Terrain[] };
export function createHives(seed: number, cleared: number): Hive[] {
	// Shuffle terrain and activity independently; modulo rotations tied their pairing together.
	let state = (seed ^ Math.imul(cleared + 1, 2654435761)) >>> 0;
	const random = () => { state += 0x6D2B79F5; let n = Math.imul(state ^ state >>> 15, state | 1); n ^= n + Math.imul(n ^ n >>> 7, n | 61); return ((n ^ n >>> 14) >>> 0) / 4294967296; };
	const shuffle = <T,>(values: T[]) => { for (let i = values.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [values[i], values[j]] = [values[j], values[i]]; } return values; };
	const surfaces = shuffle<Terrain>(["firm", "mud", "rubble"]);
	const activities = shuffle([0, 1, 2]);
	const names = ["Low", "Moderate", "High"] as const;
	return surfaces.map((_, index) => {
		const layout = cleared * 3 + index + 1;
		const surface = surfaces[index], activity = activities[index];
		return {
			id: `${cleared}:${index}`, name: `Hive ${String.fromCharCode(65 + index)}`,
			activity: names[activity], threat: cleared + 1 + activity, payment: 100 + 80 * (cleared + activity),
			terrain: createTerrain(seed, layout, surface),
		};
	});
}
