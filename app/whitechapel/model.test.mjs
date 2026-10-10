import { describe, expect, test } from "bun:test";
import { newCase, parseCase, visibleEvents } from "./model.ts";
import map from "./map-data.json";

const event = (id, night, turn, kind = "clue") => ({ id, night, turn, kind, location: 90, officer: "Blue", text: "" });

describe("case history", () => {
	test("reviewing a turn hides later observations and other nights", () => {
		const events = [event("later", 2, 8), event("before", 1, 3), event("now", 2, 4), event("future-night", 3, 1)];
		expect(visibleEvents(events, 2, 4, false).map(e => e.id)).toEqual(["now"]);
		expect(visibleEvents(events, 2, 4, true).map(e => e.id)).toEqual(["before", "now"]);
	});
	test("a negative search followed by a clue keeps both observations", () => {
		const events = [event("negative", 1, 2, "clear"), event("positive", 1, 7, "clue")];
		expect(visibleEvents(events, 1, 3, false).map(e => e.kind)).toEqual(["clear"]);
		expect(visibleEvents(events, 1, 7, false).map(e => e.kind)).toEqual(["clear", "clue"]);
	});
});
describe("case files", () => {
	test("round-trips notes, observations, and hideout theories", () => {
		const data = { ...newCase(), events: [event("a", 3, 0, "crime"), event("b", 3, 0, "crime")], suspicions: { "90": "suspect", "64": "ruled" }, notes: "Two murders tonight" };
		expect(parseCase(JSON.stringify(data))).toEqual(data);
	});
	test("rejects invalid locations, turns, nights, kinds, and duplicate IDs", () => {
		for (const patch of [{ location: 196 }, { location: "90" }, { location: null }, { turn: -1 }, { turn: 31 }, { night: 5 }, { kind: "toString" }, { officer: "Jack" }]) {
			expect(() => parseCase(JSON.stringify({ ...newCase(), events: [{ ...event("a", 1, 1), ...patch }] }))).toThrow();
		}
		expect(() => parseCase(JSON.stringify({ ...newCase(), events: [event("a", 1, 1), event("a", 1, 2)] }))).toThrow();
		expect(() => parseCase(JSON.stringify({ ...newCase(), suspicions: { "196": "suspect" } }))).toThrow();
	});
	test("accepts observations and escape announcements without a location", () => {
		for (const kind of ["note", "escape"]) {
			expect(parseCase(JSON.stringify({ ...newCase(), events: [{ ...event("a", 4, 15, kind), location: null }] })).events[0].location).toBeNull();
		}
	});
});
test("the schematic has all 195 locations and roads reference real locations", () => {
	expect(map.locations.map(node => node.number)).toEqual(Array.from({ length: 195 }, (_, index) => index + 1));
	const ids = new Set(map.locations.map(node => node.number));
	for (const [from, to] of map.roads) { expect(ids.has(from) && ids.has(to) && from !== to).toBe(true); }
});

describe("officer history", () => {
	test("positions carry over nights and change only at the recorded turn", async () => {
		const { officerPositions } = await import("./positions.ts");
		const moves = [{ id: "p1", night: 1, turn: 0, officer: "Blue", crossing: 0 }, { id: "p2", night: 2, turn: 3, officer: "Blue", crossing: 1 }, { id: "p3", night: 2, turn: 4, officer: "Blue", crossing: null }];
		expect(officerPositions(moves, 1, 0)).toEqual({ Blue: 0 });
		expect(officerPositions(moves, 2, 2)).toEqual({ Blue: 0 });
		expect(officerPositions(moves, 2, 3)).toEqual({ Blue: 1 });
		expect(officerPositions(moves, 2, 4)).toEqual({});
	});
	test("same-turn corrections win while other officers remain placed", async () => {
		const { officerPositions } = await import("./positions.ts");
		const moves = [{ id: "a", night: 1, turn: 1, officer: "Blue", crossing: 0 }, { id: "b", night: 1, turn: 1, officer: "Green", crossing: 0 }, { id: "c", night: 1, turn: 1, officer: "Blue", crossing: 1 }];
		expect(officerPositions(moves, 1, 1)).toEqual({ Blue: 1, Green: 0 });
	});
	test("legacy cases gain an empty officer history without losing their data", () => {
		const data = { ...newCase(), notes: "Earlier case notes" }; delete data.placements;
		expect(parseCase(JSON.stringify(data))).toEqual({ ...data, placements: [] });
	});
	test("rejects officers on numbered locations and invalid timestamps", () => {
		const numbered = map.nodes.find(node => node.number !== null).id;
		for (const patch of [{ crossing: numbered }, { crossing: 999 }, { officer: "Jack" }, { turn: -1 }, { night: 5 }]) {
			expect(() => parseCase(JSON.stringify({ ...newCase(), placements: [{ id: "p", night: 1, turn: 0, officer: "Blue", crossing: 0, ...patch }] }))).toThrow();
		}
	});
});
test("street segments join known nodes and the rulebook's yellow crossing adjoins 99, 100 and 120", () => {
	const nodes = new Map(map.nodes.map(node => [node.id, node]));
	for (const [a, b] of map.edges) expect(nodes.has(a) && nodes.has(b) && a !== b).toBe(true);
	const neighbors = new Map();
	for (const [a, b] of map.edges) { neighbors.set(a, [...(neighbors.get(a) ?? []), b]); neighbors.set(b, [...(neighbors.get(b) ?? []), a]); }
	expect(map.nodes.some(node => node.number === null && [99, 100, 120].every(number => neighbors.get(node.id)?.some(id => nodes.get(id).number === number)))).toBe(true);
});
test("hold choices stay neutral without movement and follow visible menu rows", async () => {
	const { dragChoice } = await import("./gestures.ts");
	expect(dragChoice(300, 305, 7, 174)).toBe(-1);
	expect(dragChoice(300, 195, 7, 174)).toBe(0);
	expect(dragChoice(300, 447, 7, 174)).toBe(6);
	expect(dragChoice(40, 300, 7, 88)).toBe(5); // Menu clamped below the screen edge.
	expect(dragChoice(300, 1000, 7, 174)).toBe(6);
});
