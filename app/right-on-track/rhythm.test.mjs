import { describe, expect, test } from "bun:test";
import { advance, layTrack, newRun, PHRASE, phaseAt, secondsAt, tempo, tolerance } from "./rhythm.ts";

const start = () => ({ ...newRun(), mode: "running" });

describe("railway rhythm", () => {
	test("ten full phrases stay playable while track history stays bounded", () => {
		const run = start();
		for (let beat = 0; beat < 160; beat++) {
			if (PHRASE[beat % 16]) layTrack(run, secondsAt(beat));
			advance(run, secondsAt(beat) + tolerance(beat) + 0.0001);
			expect(run.mode).toBe("running");
		}
		expect(run.score).toBe(100);
		expect(run.placed.size).toBeLessThanOrEqual(12);
	});

	test.each([0, 16, 500, 1600, 3000])("beat %i maps to the same instant in the visual and audio clocks", (beat) => {
		expect(phaseAt(secondsAt(beat))).toBeCloseTo(beat, 8);
	});

	test("a missed gap crashes even when frames skip its deadline", () => {
		const run = start();
		advance(run, secondsAt(4));
		expect(run.mode).toBe("crashed");
		expect(run.reason).toContain("Too late");
	});

	test("early placement outside the window crashes; inside it succeeds", () => {
		const early = start();
		layTrack(early, secondsAt(0) - tolerance(0) - 0.001);
		expect(early.mode).toBe("crashed");
		const accepted = start();
		layTrack(accepted, secondsAt(0) - tolerance(0) + 0.001);
		expect(accepted.score).toBe(1);
		expect(accepted.mode).toBe("running");
	});

	test("late placement inside the window succeeds; outside it crashes", () => {
		const accepted = start();
		layTrack(accepted, secondsAt(0) + tolerance(0) - 0.001);
		expect(accepted.score).toBe(1);
		const late = start();
		layTrack(late, secondsAt(0) + tolerance(0) + 0.001);
		expect(late.mode).toBe("crashed");
	});

	test("a second tap and a tap on existing rails both crash", () => {
		const double = start();
		layTrack(double, secondsAt(0));
		layTrack(double, secondsAt(0) + 0.01);
		expect(double.reason).toContain("Double track");
		const rest = start();
		layTrack(rest, secondsAt(0));
		layTrack(rest, secondsAt(1));
		expect(rest.reason).toContain("Duplicate track");
	});

	test("tempo increases continuously and caps at 180 BPM", () => {
		expect(tempo(0)).toBe(84);
		expect(tempo(100)).toBe(100);
		expect(tempo(10000)).toBe(180);
	});

	test("paused runs do not advance or accept track", () => {
		const run = start(); run.mode = "paused";
		advance(run, 100); layTrack(run, secondsAt(0));
		expect(run.seconds).toBe(0);
		expect(run.score).toBe(0);
	});
});
