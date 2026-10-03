import { expect, test } from "bun:test";
import { advancePreview, createDebugPreview, sceneryScenarios, sectionScenarios } from "./debug.ts";
import { needsTrack, phaseAt, secondsAt, tolerance } from "./rhythm.ts";
import { encounterAt } from "./scenery-schedule.ts";
import { waterScene } from "./motion.ts";

test.each(sceneryScenarios.map(s => [s.id]))("scenery preview %s survives skipped frames using real placements", id => {
	const { run, autoUntil } = createDebugPreview(id);
	expect(run.mode).toBe("running");
	expect(run.score).toBe(0);
	advancePreview(run, run.seconds + 20, autoUntil);
	expect(run.mode).toBe("running");
	expect(run.score).toBeGreaterThan(0);
	expect(run.phrases.size).toBeLessThan(14);
});

test.each(sectionScenarios.map(s => [s.id]))("section preview %s hands input back at its real start", id => {
	const { run, autoUntil } = createDebugPreview(id);
	expect(phaseAt(run.seconds)).toBeCloseTo(autoUntil - (id === "switch" ? 6 : 8), 7);
	advancePreview(run, secondsAt(autoUntil - 0.01), autoUntil);
	expect(run.mode).toBe("running");
	let firstGap = autoUntil;
	while (!needsTrack(run, firstGap)) firstGap += 0.5;
	expect(run.placed.has(firstGap)).toBe(false);
	advancePreview(run, secondsAt(firstGap) + tolerance(firstGap) + 0.001, autoUntil);
	expect(run.mode).toBe("crashed");
});

test("rare previews select matching scenery and replay deterministically", () => {
	const first = createDebugPreview("river-ness"), second = createDebugPreview("river-ness");
	const event = encounterAt(first.run.seed, 0);
	expect(event.kind).toBe("river");
	expect(waterScene(event.detail)).toBe("ness");
	expect(second.run).toEqual(first.run);
	expect(() => createDebugPreview("invalid")).toThrow("Unknown preview");
});

test("preview autoplay respects pause and never places twice at a frame boundary", () => {
	const { run, autoUntil } = createDebugPreview("hut");
	let gap = Math.ceil(phaseAt(run.seconds));
	while (!needsTrack(run, gap)) gap++;
	advancePreview(run, secondsAt(gap), autoUntil);
	const score = run.score;
	advancePreview(run, secondsAt(gap), autoUntil);
	expect(run.mode).toBe("running");
	expect(run.score).toBe(score);
	run.mode = "paused";
	const seconds = run.seconds;
	advancePreview(run, seconds + 30, autoUntil);
	expect(run.seconds).toBe(seconds);
	expect(run.score).toBe(score);
});
