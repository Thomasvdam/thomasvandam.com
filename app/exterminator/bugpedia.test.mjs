import { expect, test } from "bun:test";
import { BUG_TYPES, BUG_SPECS, createBug } from "./bug-types";
import { bugEntry, BUG_NOTES } from "./bugpedia";
import { BUGPEDIA_STORAGE_KEY, createEncounterProgress, normalizeEncounters, recordVisibleEncounters } from "./encounters";
import { closeBugpedia, openBugpedia, FIELD, newGame, start, step, togglePause } from "./game";
import { lightAt, LIT_THRESHOLD } from "./lighting";
import { nextMenuSelection, viewFromGame } from "./runtime";
const idle = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: false };
function bug(game, variant, x, y) {
	const enemy = createBug({ variant, position: { x, y }, player: game.player, id: game.nextId++, threat: 1, wave: 1, time: 0, bounds: FIELD });
	game.enemies.push(enemy); return enemy;
}
function setup() { const game = newGame(); game.mode = "playing"; game.player.angle = 0; return game; }

test("field guide covers the entire roster and takes body stats from the simulation", () => {
	expect(Object.keys(BUG_NOTES).sort()).toEqual([...BUG_TYPES].sort());
	for (const id of BUG_TYPES) { const entry = bugEntry(id); expect(entry.health).toBe(BUG_SPECS[id].health); expect(entry.speed).toBe(BUG_SPECS[id].speed); for (const field of ["name", "arrival", "behaviour", "advice", "attack"]) expect(entry[field].length).toBeGreaterThan(0); }
});

test("on-screen shadow records a bug; complete darkness, warnings, and off-camera light do not", () => {
	const game = setup(), { x, y } = game.player;
	bug(game, "burrower", x + 100, y); // bright front beam
	bug(game, "moth", x - 170, y); // rear spill/shadow
	bug(game, "flyer", x, y - 300); // total darkness
	bug(game, "spitter", x + 270, y); // lit, but outside mobile camera
	game.spawns.push({ variant: "queen", x, y, remaining: 1, id: game.nextId++ });
	expect(lightAt(game, x - 170, y)).toBeGreaterThan(0); expect(lightAt(game, x - 170, y)).toBeLessThan(LIT_THRESHOLD);
	expect(lightAt(game, x, y - 300)).toBe(0); expect(lightAt(game, x + 270, y)).toBeGreaterThan(0);
	recordVisibleEncounters(game, 390, 500); expect(game.encounters).toEqual(["burrower", "moth"]);
	recordVisibleEncounters(game, 390, 500); expect(game.encounters).toEqual(["burrower", "moth"]);
	recordVisibleEncounters(game, 1120, 720); expect(game.encounters).toContain("spitter"); expect(game.encounters).not.toContain("queen");
});

test("blackout moth cover prevents discovery until illumination returns", () => {
	const game = setup(); bug(game, "lunger", game.player.x + 100, game.player.y);
	game.lightCover.front = 4; game.lightCover.rearLeft = 4; game.lightCover.rearRight = 4;
	recordVisibleEncounters(game, 1120, 720); expect(game.encounters).toEqual([]);
	game.lightCover.front = 0; recordVisibleEncounters(game, 1120, 720); expect(game.encounters).toEqual(["lunger"]);
});

test("visible segments and elevated bodies count, including partial camera edges", () => {
	const game = setup(), { x, y } = game.player;
	const centipede = bug(game, "centipede", x, y - 300); centipede.state.segments = [{ x: x + 50, y }];
	const click = bug(game, "clickBeetle", x + 40, y + 280); click.state.phase = "flight"; click.state.remaining = .35;
	game.parts.cornerLights.southEast = true;
	recordVisibleEncounters(game, 390, 420); expect(game.encounters).toContain("centipede"); expect(game.encounters).toContain("clickBeetle");
	bug(game, "evader", x + 201, y); recordVisibleEncounters(game, 390, 420); expect(game.encounters).toContain("evader");
});

test("bugpedia freezes combat and returns to its originating menu without resuming", () => {
	const game = newGame(); openBugpedia(game); expect(game.mode).toBe("ready");
	start(game); openBugpedia(game); expect(game.mode).toBe("bugpedia"); expect(game.bugpediaFrom).toBe("base");
	step(game, idle, 2); expect(game.time).toBe(0); closeBugpedia(game); expect(game.mode).toBe("base");
	game.mode = "playing"; openBugpedia(game); expect(game.mode).toBe("playing");
	togglePause(game); openBugpedia(game); expect(game.bugpediaFrom).toBe("paused");
	bug(game, "burrower", game.player.x, game.player.y); recordVisibleEncounters(game, 1120, 720); expect(game.encounters).toEqual([]);
	step(game, idle, 2); expect(game.time).toBe(0); closeBugpedia(game); expect(game.mode).toBe("paused");
});

test("menu choices expose only encountered bugs and controller can always reach Back", () => {
	const game = newGame(); start(game); expect(viewFromGame(game).choices.at(-1).kind).toBe("bugpedia");
	openBugpedia(game); expect(viewFromGame(game).choices.map(c => c.kind)).toEqual(["closeBugpedia"]);
	game.encounters = ["egg", "larva"]; const choices = viewFromGame(game).choices;
	expect(choices.map(c => c.id)).toEqual(["egg", "larva", "closeBugpedia"]);
	expect(nextMenuSelection(choices, 1, 1)).toBe(2); expect(nextMenuSelection(choices, 2, 1)).toBe(0);
});

test("encounters survive reloads and merge browser saves without leaking other progress", () => {
	let raw = null;
	const storage = { getItem: key => { expect(key).toBe(BUGPEDIA_STORAGE_KEY); return raw; }, setItem: (key, value) => { expect(key).toBe(BUGPEDIA_STORAGE_KEY); raw = value; } };
	const first = createEncounterProgress(storage), second = createEncounterProgress(storage);
	first.remember(["queen", "larva"]); second.remember(["courier"]);
	expect(first.read().sort()).toEqual(["courier", "larva", "queen"]);
	expect(createEncounterProgress(storage).read()).toEqual(normalizeEncounters(["queen", "larva", "courier"]));
	expect(Object.keys(JSON.parse(raw)).sort()).toEqual(["encounters", "version"]);
});

test("malformed or blocked storage never loses session encounters or crashes the guide", () => {
	expect(normalizeEncounters(["queen", "queen", "not-a-bug", null])).toEqual(["queen"]);
	const malformed = createEncounterProgress({ getItem: () => "{", setItem: () => {} }); expect(malformed.read()).toEqual([]); expect(malformed.persistent).toBe(false);
	const blocked = createEncounterProgress({ getItem: () => { throw Error(); }, setItem: () => { throw Error(); } });
	blocked.remember(["egg"]); expect(blocked.read()).toEqual(["egg"]); expect(blocked.persistent).toBe(false);
	const session = createEncounterProgress(null); session.remember(["larva"]); expect(session.read()).toEqual(["larva"]); expect(session.persistent).toBe(false);
});
