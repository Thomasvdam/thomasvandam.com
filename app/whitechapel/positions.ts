import map from "./map-data.json";
export const officerColors = ["Blue", "Yellow", "Brown", "Red", "Green"] as const;
export type Officer = typeof officerColors[number];
export type Placement = { id: string; night: number; turn: number; officer: Officer; crossing: number | null };
export const crossingIds = new Set(map.nodes.filter(node => node.number === null).map(node => node.id));
export function officerPositions(placements: Placement[], night: number, turn: number): Partial<Record<Officer, number>> {
	const positions: Partial<Record<Officer, number>> = {};
	for (const placement of placements.filter(p => p.night < night || p.night === night && p.turn <= turn).sort((a, b) => a.night - b.night || a.turn - b.turn)) {
		if (placement.crossing === null) delete positions[placement.officer];
		else positions[placement.officer] = placement.crossing;
	}
	return positions;
}
