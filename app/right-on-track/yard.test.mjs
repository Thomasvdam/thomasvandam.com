import { expect, test } from "bun:test";
import { advance, layTrack, needsTrack, newRun, phraseAt, phraseSection, secondsAt, tolerance, yardGroundClear } from "./rhythm.ts";
import { stockLayers, yardsAhead } from "./yard.ts";
import { wagonPose, WAGON_DISTANCE } from "./wagon.ts";
import { encounterAt, railwayHeight, routeCenter, SCENERY_LENGTH } from "./motion.ts";

const fixture = () => { const run = newRun(2); run.mode = "running"; return { run, event: yardsAhead(run, 540)[0] }; };

test("yard sections are rare seeded pairs with a distinct tap-rest-tap-tap pattern", () => {
	let pairs = 0, blocked = 0;
	for (let seed = 0; seed < 60; seed++) {
		const run = newRun(seed);
		for (let index = 0, beat = 0; index < 96; index++) {
			const phrase = phraseAt(run, beat);
			if (phrase.section === "yard") {
				expect([36, 37]).toContain(index % 48);
				expect(phrase.meter).toBe(4);
				if (index % 48 === 36) { pairs++; expect(phraseAt(run, phrase.end).section).toBe("yard"); }
				for (let offset = 0; offset < 16; offset++) expect(needsTrack(run, beat + offset)).toBe(offset % 4 !== 1);
			} else if (phraseSection(seed, index) === "yard") blocked++;
			beat = phrase.end;
		}
	}
	expect(pairs).toBeGreaterThan(5); expect(pairs).toBeLessThan(45); expect(blocked).toBeGreaterThan(0);
});

test("stock stays full ordinarily, depletes on taps in the yard, and refills with a reserve", () => {
	const { run, event } = fixture(); expect(event).toBeDefined();
	expect(event.end - event.start).toBe(32); expect(yardGroundClear(run.seed, event.start)).toBe(true);
	let previous = 8, minimum = 8;
	for (let beat = 0; beat < event.end + 2; beat += 0.5) {
		if (needsTrack(run, beat)) layTrack(run, secondsAt(beat));
		advance(run, secondsAt(beat) + tolerance(beat) + 0.001);
		expect(run.mode).toBe("running");
		const stock = stockLayers(run, event, beat);
		if (beat < event.start || beat >= event.start + 20) expect(stock).toBe(8);
		else { expect(stock).toBeLessThanOrEqual(previous); previous = stock; minimum = Math.min(minimum, stock); }
		expect(stock).toBeGreaterThan(0);
	}
	expect(minimum).toBe(1);
	expect(stockLayers(run, undefined, 10000)).toBe(8);
});

test("wagon follows its own axles through either fork instead of inheriting engine heading", () => {
	for (const side of [-1, 1]) {
		const junctions = [{ beat: 24, side }], distance = (30 + 4) * 6;
		const pose = wagonPose(0, distance, junctions);
		expect(pose.x).toBeCloseTo(routeCenter(distance - WAGON_DISTANCE, junctions) - routeCenter(distance, junctions), 8);
		expect(Math.abs(pose.yaw - pose.engineYaw)).toBeGreaterThan(0.025);
		const next = wagonPose(0, distance + 0.006, junctions);
		expect(Math.abs(next.x - pose.x)).toBeLessThan(0.01);
		expect(Math.abs(next.yaw - pose.yaw)).toBeLessThan(0.001);
	}
});

test("wagon reaches bridge ramps later than the locomotive", () => {
	let river;
	for (let index = 0; index < 100 && !river; index++) { const event = encounterAt(0, index); if (event.kind === "river") river = event; }
	expect(river).toBeDefined();
	const distance = river.distance - 25, pose = wagonPose(0, distance, []);
	expect(pose.y).toBeLessThan(railwayHeight(0, distance)); expect(pose.pitch).toBeGreaterThan(0);
});

test("yard footprint stays clear of crossings and river embankments", () => {
	const { run, event } = fixture(), index = Math.floor(event.distance / SCENERY_LENGTH);
	for (let i = index - 1; i <= index + 1; i++) {
		const feature = encounterAt(run.seed, i);
		if (["river", "crossing"].includes(feature.kind)) expect(Math.abs(event.distance - feature.distance)).toBeGreaterThanOrEqual(66);
	}
});
