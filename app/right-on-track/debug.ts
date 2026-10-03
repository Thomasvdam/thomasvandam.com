import { advance, layTrack, needsTrack, newRun, phaseAt, phraseAt, placementEarlyTolerance, secondsAt, signalsAhead, type Run, type Section } from "./rhythm";
import { encounterAt } from "./scenery-schedule";
import { skyAt } from "./aviation";
import { cropVariant, farmMachine, pastureVariant } from "./farmland";
import { waterScene } from "./motion";

type Encounter = ReturnType<typeof encounterAt>;
type Scenario = { id: string; label: string; locate: (seed: number) => { start: number; playFrom?: number } | null };
const ground = (id: string, label: string, match: (event: Encounter) => boolean): Scenario => ({ id, label, locate(seed) {
	const event = encounterAt(seed, 0);
	return match(event) ? { start: Math.max(-4, (event.distance - 60) / 6 - 4) } : null;
} });
const tree = (id: string, label: string, index: number): Scenario => ({ id, label, locate(seed) {
	// Use the existing tree's world anchor, with no road/river/field or fork hiding it.
	const probe = newRun(seed);
	if (encounterAt(seed, 0).kind || encounterAt(seed, 1).kind || signalsAhead(probe, 20).length) return null;
	return { start: Math.max(-4, ((index * 13 % 220) - 55) / 6 - 4) };
} });
const section = (id: string, label: string, match: (section: Section, meter: number) => boolean): Scenario => ({ id, label, locate(seed) {
	const probe = newRun(seed);
	let phrase = phraseAt(probe, 0);
	for (let i = 0; i < 48; i++) {
		if (match(phrase.section, phrase.meter)) return { start: phrase.start - 8, playFrom: phrase.start };
		phrase = phraseAt(probe, phrase.end);
	}
	return null;
} });

// Add a selector here to expose any new seeded scenery or section in the menu.
export const sceneryScenarios: Scenario[] = [
	ground("hut", "Small hut", e => e.kind === "hut"),
	ground("lumberjack", "Lumberjack and cut tree", e => e.kind === "lumberjack"),
	ground("crossing-empty", "Crossing · no waiting cars", e => e.kind === "crossing" && e.cars === 0),
	ground("crossing-cars", "Crossing · waiting cars", e => e.kind === "crossing" && e.cars > 0),
	ground("crossing-traffic", "Crossing · arriving car", e => e.kind === "crossing" && e.traffic),
	ground("bears", "Polar bears at a hole", e => e.kind === "bears"),
	...(["grain", "corn", "vegetables"] as const).map((kind, i) => ground(kind, `${kind} field`, e => e.kind === "crops" && cropVariant(e.detail) === i)),
	...(["tractor", "combine"] as const).map((kind, i) => ground(kind, `${kind} in a field`, e => e.kind === "crops" && farmMachine(e.detail) === i + 1)),
	...(["Spotted cows", "Brown cows", "Sheep"] as const).map((label, i) => ground(`cattle-${i}`, label, e => e.kind === "cattle" && pastureVariant(e.detail) === i)),
	...(["cargo", "sail", "floaty", "ducks", "landing", "takeoff", "ness"] as const).map((kind, i) => ground(`river-${kind}`, `River · ${["cargo ship", "sailboat", "person on floaty", "water birds", "bird landing", "birds taking off", "Loch Ness monster"][i]}`, e => e.kind === "river" && waterScene(e.detail) === kind)),
	...(["balloon", "jet", "prop", "banner"] as const).map((kind, i): Scenario => ({ id: kind, label: ["Hot air balloon", "Jet", "Prop plane", "Prop plane with banner"][i], locate(seed) {
		const event = skyAt(seed, 0);
		return event.kind === kind ? { start: (event.distance - 55) / 6 - 4 } : null;
	} })),
	tree("dead-tree", "Dead tree", 7), tree("bear-cub", "Bear cub under a tree", 8),
	tree("squirrel", "Squirrel on trunk", 9), tree("nest", "Bird nest", 46),
	tree("nest-visitor", "Bird flying into nest", 15), tree("flock", "Flock taking off", 23),
	tree("mushrooms", "Mushrooms", 4), tree("moss", "Mossy tree", 5), tree("log", "Fallen log", 21),
	{ id: "flyby", label: "Small bird flyby", locate(seed) { const phrase = phraseAt(newRun(seed), 16); return { start: phrase.start + phrase.meter - 2 }; } },
];
export const sectionScenarios: Scenario[] = [
	section("concert", "Concert stadium · stomp–stomp–clap", kind => kind === "concert"),
	section("fairground", "Fairground · quick pairs", kind => kind === "fairground"),
	section("quarry", "Quarry · quick runs", kind => kind === "quarry"),
	section("yard", "Construction yard · crane refill", kind => kind === "yard"),
	section("autumn", "Autumn · 3/4 section", (_, meter) => meter === 3),
	{ id: "switch", label: "Track switch", locate(seed) { const beat = signalsAhead(newRun(seed), 0)[0]; return beat === undefined ? null : { start: beat - 8, playFrom: beat - 2 }; } },
];

export type DebugPreview = { id: string; run: Run; autoUntil: number; label: string };
export function previewAcceptsInput(preview: DebugPreview, seconds: number) {
	if (!Number.isFinite(preview.autoUntil)) return false;
	const early = needsTrack(preview.run, preview.autoUntil) ? placementEarlyTolerance(preview.run, preview.autoUntil) : 0;
	return seconds >= secondsAt(preview.autoUntil) - early;
}
export function advancePreview(run: Run, seconds: number, autoUntil: number) {
	if (run.mode !== "running") return;
	// Real placements at their real deadlines, even when a frame spans several hits.
	for (let beat = Math.max(0, Math.ceil((phaseAt(run.seconds) - 1e-7) * 2) / 2); beat < autoUntil && secondsAt(beat) <= seconds; beat += 0.5) {
		if (needsTrack(run, beat) && !run.placed.has(beat)) layTrack(run, secondsAt(beat));
	}
	advance(run, seconds);
}
export function createDebugPreview(id: string): DebugPreview {
	const scenario = [...sceneryScenarios, ...sectionScenarios].find(item => item.id === id);
	if (!scenario) throw new Error("Unknown preview");
	for (let seed = 0; seed < 10000; seed++) {
		const target = scenario.locate(seed);
		if (!target) continue;
		const run = newRun(seed); run.mode = "running";
		advancePreview(run, secondsAt(Math.max(-4, target.start)), Infinity);
		run.score = 0;
		return { id, run, autoUntil: target.playFrom ?? Infinity, label: scenario.label };
	}
	throw new Error("No matching preview found");
}
