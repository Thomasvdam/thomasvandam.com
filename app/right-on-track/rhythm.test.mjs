import { describe, expect, test } from "bun:test";
import { advance, layTrack, newRun, generatePhrase, needsTrack, phraseAt, phraseMeter, isDownbeat, earlyTolerance, phaseAt, secondsAt, tempo, tolerance, trainSpeed } from "./rhythm.ts";

const start = () => ({ ...newRun(), mode: "running" });

describe("railway rhythm", () => {
	test("long runs stay playable across changing sections with bounded history", () => {
		const run = start();
		for (let beat = 0; beat < 160; beat++) {
			if (needsTrack(run, beat)) layTrack(run, secondsAt(beat));
			advance(run, secondsAt(beat) + tolerance(beat) + 0.0001);
			expect(run.mode).toBe("running");
		}
		expect(run.score).toBeGreaterThanOrEqual(40);
		expect(run.score).toBeLessThanOrEqual(120);
		expect(run.phrases.size).toBeLessThanOrEqual(3);
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
		layTrack(early, secondsAt(0) - earlyTolerance(0) - 0.001);
		expect(early.mode).toBe("crashed");
		const accepted = start();
		layTrack(accepted, secondsAt(0) - earlyTolerance(0) + 0.001);
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

	test("early tolerance is wider while late tolerance stays unchanged", () => {
		expect(earlyTolerance(0)).toBe(0.22);
		expect(tolerance(0)).toBe(0.095);
		const run = start(); layTrack(run, secondsAt(0) - 0.2);
		expect(run.score).toBe(1);
		expect(run.placement).toEqual({ beat: 0, seconds: secondsAt(0) - 0.2 });
	});

	test("each bar has gaps and rests; phrases vary across bars and runs", () => {
		const phrases = new Set();
		for (let seed = 0; seed < 50; seed++) {
			for (let phrase = 0; phrase < 8; phrase++) {
				const pattern = generatePhrase(seed, phrase);
				const meter = phraseMeter(seed, phrase);
				expect(pattern).toHaveLength(meter * 4);
				for (let bar = 0; bar < 4; bar++) {
					const gaps = pattern.slice(bar * meter, bar * meter + meter).filter(Boolean).length;
					expect(gaps).toBeGreaterThanOrEqual(1);
					expect(gaps).toBeLessThanOrEqual(meter - 1);
				}
				phrases.add(pattern.join());
			}
		}
		expect(phrases.size).toBeGreaterThan(350);
	});

	test("previewing out of order and regenerating old phrases cannot change gaps", () => {
		const run = start();
		const phrase = phraseAt(run, 48);
		const expected = phrase.pattern;
		for (let beat = phrase.end - 1; beat >= phrase.start; beat--) expect(needsTrack(run, beat)).toBe(expected[beat - phrase.start]);
		run.phrases.clear();
		for (let beat = phrase.start; beat < phrase.end; beat++) expect(needsTrack(run, beat)).toBe(expected[beat - phrase.start]);
	});

	test("3/4 and its landscape last a full phrase, with changes only at boundaries", () => {
		const run = start();
		expect(phraseAt(run, 47).meter).toBe(4);
		const special = phraseAt(run, 48);
		expect(special.start).toBe(48);
		expect(special.end).toBe(60);
		for (let beat = 48; beat < 60; beat++) {
			expect(phraseAt(run, beat).meter).toBe(3);
			expect(phraseAt(run, beat).landscape).toBe("autumn");
			expect(isDownbeat(run, beat)).toBe([48, 51, 54, 57].includes(beat));
		}
		expect(phraseAt(run, 60).meter).toBe(4);
		expect(phraseAt(run, 60).landscape).toBe("forest");
		expect(isDownbeat(run, 60)).toBe(true);
		expect(phraseAt(run, phaseAt(secondsAt(48) - 0.0001)).landscape).toBe("forest");
		expect(phraseAt(run, phaseAt(secondsAt(48) + 0.0001)).landscape).toBe("autumn");
	});

	test("special sections are occasional, never consecutive, and never start a run", () => {
		let special = 0;
		for (let seed = 0; seed < 50; seed++) {
			for (let index = 0; index < 100; index++) {
				const meter = phraseMeter(seed, index);
				if (meter === 3) {
					special++;
					expect(index % 4).toBe(3);
					expect(phraseMeter(seed, index - 1)).toBe(4);
					expect(phraseMeter(seed, index + 1)).toBe(4);
				}
			}
		}
		expect(special).toBeGreaterThan(500);
		expect(special).toBeLessThan(1000);
	});

	test("lookahead across variable phrase lengths agrees with the live journey", () => {
		const run = start();
		const expected = Array.from({ length: 500 }, (_, beat) => needsTrack(run, beat));
		run.phrases.clear();
		for (let beat = 0; beat < expected.length; beat++) {
			expect(needsTrack(run, beat)).toBe(expected[beat]);
			if (expected[beat]) layTrack(run, secondsAt(beat));
			advance(run, secondsAt(beat) + tolerance(beat) + 0.001);
			expect(run.mode).toBe("running");
		}
		expect(run.phrases.size).toBeLessThanOrEqual(3);
	});

	test("tempo increases continuously and caps at 180 BPM", () => {
		expect(tempo(0)).toBe(95);
		expect(tempo(100)).toBe(119);
		expect(tempo(10000)).toBe(180);
	});

	test("paused runs do not advance or accept track", () => {
		const run = start(); run.mode = "paused";
		advance(run, 100); layTrack(run, secondsAt(0));
		expect(run.seconds).toBe(0);
		expect(run.score).toBe(0);
	});
});

test("decorative speed rises in km/h and stays capped", () => { expect(trainSpeed(0)).toBe(28); expect(trainSpeed(60)).toBe(40); expect(trainSpeed(10000)).toBe(96); });
