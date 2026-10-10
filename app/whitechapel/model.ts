export const kinds = {
	crime: { label: "Crime scene", symbol: "◆", help: "The murder location. Night three can have two crime scenes." },
	clue: { label: "Clue found", symbol: "+", help: "Jack visited this location sometime this night, before this search." },
	clear: { label: "No clue", symbol: "×", help: "Jack had not visited this location this night when it was searched. He may visit later." },
	miss: { label: "Missed arrest", symbol: "○", help: "Jack was not here at this turn. This does not rule out an earlier visit." },
	note: { label: "Observation", symbol: "…", help: "Record a theory, special movement, police position, or other public information." },
	escape: { label: "Night ended", symbol: "↳", help: "Record when Jack declared his escape. His hideout stays secret." },
} as const;
export type Kind = keyof typeof kinds;
export type Observation = { id: string; night: number; turn: number; kind: Kind; location: number | null; officer: string; text: string };
export type Case = { version: 1; name: string; events: Observation[]; suspicions: Record<string, "suspect" | "ruled">; notes: string };
export const officers = ["Unassigned", "Blue", "Yellow", "Brown", "Red", "Green"];
export function newCase(): Case {
	return { version: 1, name: "The Whitechapel case", events: [], suspicions: {}, notes: "" };
}
export function validLocation(value: number): boolean { return Number.isInteger(value) && value >= 1 && value <= 195; }
export function visibleEvents(events: Observation[], night: number, turn: number, allNights: boolean): Observation[] {
	return events.filter(event => event.night === night ? event.turn <= turn : allNights && event.night < night)
		.sort((a, b) => a.night - b.night || a.turn - b.turn);
}
export function parseCase(raw: string): Case {
	const value = JSON.parse(raw);
	if (!value || value.version !== 1 || typeof value.name !== "string" || value.name.length > 120 || typeof value.notes !== "string" || value.notes.length > 20000 || !Array.isArray(value.events) || value.events.length > 5000 || !value.suspicions || typeof value.suspicions !== "object" || Array.isArray(value.suspicions)) throw new Error("This is not a supported Whitechapel case file.");
	const ids = new Set<string>();
	for (const event of value.events) {
		if (!event || typeof event.id !== "string" || !event.id || ids.has(event.id) || !Number.isInteger(event.night) || event.night < 1 || event.night > 4 || !Number.isInteger(event.turn) || event.turn < 0 || event.turn > 30 || !Object.hasOwn(kinds, event.kind) || (event.location !== null && !validLocation(event.location)) || (event.location === null && event.kind !== "note" && event.kind !== "escape") || !officers.includes(event.officer) || typeof event.text !== "string" || event.text.length > 2000) throw new Error("The case contains an invalid observation.");
		ids.add(event.id);
	}
	for (const [location, status] of Object.entries(value.suspicions)) {
		if (!validLocation(Number(location)) || String(Number(location)) !== location || (status !== "suspect" && status !== "ruled")) throw new Error("The case contains an invalid hideout annotation.");
	}
	return { version: 1, name: value.name, events: value.events.map((event: Observation) => ({ id: event.id, night: event.night, turn: event.turn, kind: event.kind, location: event.location, officer: event.officer, text: event.text })), suspicions: { ...value.suspicions }, notes: value.notes };
}
