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
