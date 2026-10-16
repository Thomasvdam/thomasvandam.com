import { createTerrain, type Terrain } from "./terrain";

export type Hive = { id: string; name: string; activity: "Low" | "Moderate" | "High"; threat: number; payment: number; terrain: Terrain[] };
export function createHives(seed: number, cleared: number): Hive[] {
	const surfaces: Terrain[] = ["firm", "mud", "rubble"];
	const activities = ["Low", "Moderate", "High"] as const;
	return surfaces.map((_, index) => {
		const layout = cleared * 3 + index + 1;
		const surface = surfaces[((seed >>> 0) + cleared + index) % 3];
		const activity = ((seed >>> 0) + cleared * 2 + index * 2) % 3;
		return {
			id: `${cleared}:${index}`, name: `Hive ${String.fromCharCode(65 + index)}`,
			activity: activities[activity], threat: cleared + 1 + activity, payment: 100 + 80 * (cleared + activity),
			terrain: createTerrain(seed, layout, surface),
		};
	});
}
