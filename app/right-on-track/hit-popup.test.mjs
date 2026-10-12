import { expect, test } from "bun:test";
import { newRun } from "./rhythm.ts";
import { hitPopup } from "./hit-popup.ts";
import { trackView, sameTrackView } from "./track-view.ts";

const hit = () => { const run = newRun(57); run.mode = "running"; run.score = 1; run.seconds = 3; run.lastHit = { seconds: 3, precise: true, offset: 0, brokeCombo: false }; return run; };

test("a popup keeps its identity, word and tilt while idling or pausing", () => {
	const run = hit(), popup = hitPopup(run);
	run.seconds += 2;
	expect(hitPopup(run)).toEqual(popup);
	run.mode = "paused"; expect(hitPopup(run)).toEqual(popup);
	const previous = trackView(run);
	run.lastHit = { ...run.lastHit, seconds: 5.5 };
	expect(sameTrackView(previous, trackView(run))).toBe(false);
	expect(hitPopup(run).id).not.toBe(popup.id);
});

test("on-time hits vary their praise and small tilt across hit identities", () => {
	const run = hit(), words = new Set(), tilts = new Set();
	for (let i = 0; i < 100; i++) {
		run.score++; run.lastHit.seconds += 0.63;
		const popup = hitPopup(run);
		expect(popup.text).toMatch(/^(Great|Good|Amazing|Wonderful|Excellent|Lovely)!$/);
		expect(popup.tilt).toBeGreaterThanOrEqual(-5.5); expect(popup.tilt).toBeLessThanOrEqual(5.5);
		words.add(popup.text); tilts.add(popup.tilt);
	}
	expect(words.size).toBe(6); expect(tilts.size).toBeGreaterThan(50);
});

test("early, late and missed placements retain unambiguous labels; idle starts empty", () => {
	expect(hitPopup(newRun())).toBeNull();
	const run = hit(); run.lastHit.precise = false; run.lastHit.offset = -0.1;
	expect(hitPopup(run)).toMatchObject({ text: "Early", tone: "loose" });
	run.lastHit.offset = 0.08; expect(hitPopup(run).text).toBe("Late");
	run.mode = "crashed"; expect(hitPopup(run)).toMatchObject({ text: "Miss", tone: "miss" });
});
