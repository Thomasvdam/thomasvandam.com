import { expect, test } from "bun:test";
import { newRun, secondsAt, advance } from "./rhythm.ts";
import { advancePractice, createPractice, placePractice } from "./tutorial.ts";
import { trackView } from "./track-view.ts";
import { precisionReadout } from "./upgrades.ts";

// Exercise real placements and missed-gap checks, including clocks far past the deadline.
test.each([0, 1, 17, 239])("the first two practice gaps wait indefinitely and always accept a tap (seed %i)", seed => {
	const run = newRun(seed); run.mode = "running";
	const practice = createPractice(run);
	for (let i = 0; i < 2; i++) {
		advancePractice(run, secondsAt(practice.beat) - 0.1, practice);
		expect(placePractice(run, practice)).toBe(false);
		expect(run.score).toBe(i);
		advancePractice(run, 10000, practice);
		expect(run.seconds).toBe(secondsAt(practice.beat));
		expect(run.mode).toBe("running");
		expect(trackView(run, practice).practiceWaiting).toBe(true);
		expect(trackView(run, practice).phase).toBe(practice.beat);
		advancePractice(run, 20000, practice);
		expect(placePractice(run, practice)).toBe(true);
		expect(run.score).toBe(i + 1);
		expect(run.precisionStreak).toBe(0);
		expect(placePractice(run, practice)).toBe(false);
		expect(run.score).toBe(i + 1);
	}
	expect(placePractice(run, practice)).toBe(false);
	advance(run, run.seconds + 100);
	expect(run.mode).toBe("crashed"); // Normal play can miss after practice ends.
});

test("paused practice preserves its position and cannot place a piece", () => {
	const run = newRun(); run.mode = "running";
	const practice = createPractice(run);
	advancePractice(run, 100, practice);
	run.mode = "paused";
	const seconds = run.seconds;
	advancePractice(run, 200, practice);
	expect(run.seconds).toBe(seconds); expect(placePractice(run, practice)).toBe(false);
	run.mode = "running"; expect(placePractice(run, practice)).toBe(true);
});

test("timing feedback has no idle explanation and reports misses", () => {
	const run = newRun();
	expect(precisionReadout(run).feedback).toBe("");
	run.lastHit = { seconds: 0, precise: false, offset: -0.1, brokeCombo: false };
	expect(trackView(run).feedback).toBe("Early");
	run.seconds = 2; expect(trackView(run).feedback).toBe("");
	run.mode = "crashed"; expect(trackView(run)).toMatchObject({ feedback: "Miss", tone: "miss" });
});
