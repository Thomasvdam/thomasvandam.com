import { expect, test } from "bun:test";
import { layTrack, newRun, needsTrack, secondsAt, advance, tolerance } from "./rhythm.ts";
import { precisionReadout, PRECISION_WINDOW, rainbowPuff, upgradeAppearance } from "./upgrades.ts";
import { advancePreview, createDebugPreview } from "./debug.ts";

function hit(run, offset = 0) {
	let beat = Math.max(0, run.checked + 0.5);
	while (!needsTrack(run, beat) || run.placed.has(beat)) beat += 0.5;
	layTrack(run, secondsAt(beat) + offset);
	advance(run, secondsAt(beat) + tolerance(beat) + 0.001);
	expect(run.mode).toBe("running");
	return beat;
}
const start = () => { const run = newRun(); run.mode = "running"; return run; };

test("each ten consecutive precise hits unlocks one persistent run upgrade", () => {
	const run = start();
	for (let i = 1; i <= 30; i++) {
		hit(run); expect(run.precisionStreak).toBe(i); expect(run.upgrades).toBe(Math.floor(i / 10));
	}
	expect(run.lastUpgrade.level).toBe(3);
	hit(run, -0.1);
	expect(run.precisionStreak).toBe(0); expect(run.upgrades).toBe(3);
	for (let i = 0; i < 10; i++) hit(run);
	expect(run.upgrades).toBe(4);
	expect(newRun().upgrades).toBe(0); expect(newRun().precisionStreak).toBe(0);
});

test.each([-1, 1])("precision includes the 50 ms boundary on side %i and rejects a looser accepted tap", side => {
	const run = start(); hit(run, side * PRECISION_WINDOW);
	expect(run.precisionStreak).toBe(1);
	hit(run, side * (PRECISION_WINDOW + 0.001));
	expect(run.precisionStreak).toBe(0);
});

test("rests, pauses and switch toggles preserve the streak without awarding hits", () => {
	const run = start();
	for (let beat = 0; beat < 22; beat += 0.5) { if (needsTrack(run, beat)) layTrack(run, secondsAt(beat)); advance(run, secondsAt(beat) + tolerance(beat) + 0.001); }
	const streak = run.precisionStreak, upgrades = run.upgrades;
	layTrack(run, secondsAt(22.2)); layTrack(run, secondsAt(23));
	expect(run.precisionStreak).toBe(streak); expect(run.upgrades).toBe(upgrades);
	run.mode = "paused"; layTrack(run, secondsAt(23.5));
	expect(run.precisionStreak).toBe(streak);
});

test("misses and duplicate taps cannot earn precision upgrades", () => {
	const run = start(); const beat = hit(run);
	const streak = run.precisionStreak, upgrades = run.upgrades;
	layTrack(run, run.seconds);
	expect(run.mode).toBe("crashed"); expect(run.precisionStreak).toBe(streak); expect(run.upgrades).toBe(upgrades);
	const missed = start(); advance(missed, secondsAt(20));
	expect(missed.mode).toBe("crashed"); expect(missed.upgrades).toBe(0);
	expect(beat).toBeGreaterThanOrEqual(0);
});

test("debug autoplay and fast-forward grant no precision while manual preview hits do", () => {
	const preview = createDebugPreview("concert");
	advancePreview(preview.run, secondsAt(preview.autoUntil - 0.1), preview.autoUntil);
	expect(preview.run.upgrades).toBe(0); expect(preview.run.precisionStreak).toBe(0);
	layTrack(preview.run, secondsAt(preview.autoUntil));
	expect(preview.run.precisionStreak).toBe(1);
});

test.each(["fairground", "quarry"])("%s half-beat hits use the same precision window", id => {
	const p = createDebugPreview(id);
	advancePreview(p.run, secondsAt(p.autoUntil - 0.01), p.autoUntil);
	let count = 0;
	for (let beat = p.autoUntil; count < 10; beat += 0.5) {
		if (needsTrack(p.run, beat)) { layTrack(p.run, secondsAt(beat) + 0.049); count++; }
		advance(p.run, secondsAt(beat) + tolerance(beat) + 0.001);
		expect(p.run.mode).toBe("running");
	}
	expect(p.run.precisionStreak).toBe(10); expect(p.run.upgrades).toBe(1);
});

test("cosmetics accumulate through full rainbow smoke, then keep changing", () => {
	let previous = upgradeAppearance(0);
	for (let level = 1; level <= 40; level++) {
		const current = upgradeAppearance(level);
		expect(current).not.toEqual(previous);
		expect(current.gold).toBeGreaterThanOrEqual(previous.gold);
		expect(current.rainbow).toBeGreaterThanOrEqual(previous.rainbow);
		previous = current;
	}
	expect(upgradeAppearance(16)).toMatchObject({ gold: 5, rainbow: 1, wagon: 3 });
});

test("rainbow chance is deterministic and reaches all emitted puffs", () => {
	let colored = 0;
	for (let emission = 0; emission < 100; emission++) for (let puff = 0; puff < 10; puff++) {
		expect(rainbowPuff(4, puff, emission, 0)).toBe(false);
		expect(rainbowPuff(4, puff, emission, 1)).toBe(true);
		if (rainbowPuff(4, puff, emission, 0.2)) colored++;
	}
	expect(colored).toBeGreaterThan(150); expect(colored).toBeLessThan(250);
});


test("precision feedback distinguishes perfect hits and early/late combo resets", () => {
	const run = start(); hit(run);
	expect(precisionReadout(run)).toMatchObject({ progress: 1, feedback: "Perfect!", tone: "perfect" });
	hit(run, -0.08);
	expect(precisionReadout(run)).toMatchObject({ progress: 0, feedback: "Early · combo reset", tone: "loose" });
	hit(run); hit(run, 0.08);
	expect(precisionReadout(run).feedback).toBe("Late · combo reset");
	run.seconds += 2; expect(precisionReadout(run).tone).toBe("idle");
});

test("ten-hit feedback fills the meter and preserves upgrade progress through pauses", () => {
	const run = start(); for (let i = 0; i < 10; i++) hit(run);
	expect(precisionReadout(run)).toMatchObject({ progress: 10, feedback: "Perfect · upgrade earned!" });
	run.mode = "paused"; expect(precisionReadout(run).progress).toBe(10); run.mode = "running";
	hit(run); expect(precisionReadout(run).progress).toBe(1);
	hit(run, 0.08); expect(run.upgrades).toBe(1); expect(precisionReadout(run).progress).toBe(0);
	expect(precisionReadout(newRun()).progress).toBe(0);
});

test("switch toggles and debug autoplay cannot create or replace hit feedback", () => {
	const run = start(); for (let beat = 0; beat < 22; beat += 0.5) { if (needsTrack(run, beat)) layTrack(run, secondsAt(beat)); advance(run, secondsAt(beat) + tolerance(beat) + 0.001); }
	const lastHit = run.lastHit; layTrack(run, secondsAt(23)); expect(run.lastHit).toBe(lastHit);
	const preview = createDebugPreview("concert"); advancePreview(preview.run, secondsAt(preview.autoUntil - 0.1), preview.autoUntil);
	expect(preview.run.lastHit).toBeNull();
});
