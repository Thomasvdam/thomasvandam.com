import { expect, test } from "bun:test";
import { beatForSlot, sceneryOffsets } from "./motion.ts";

test("visible trees move continuously across scenery wrap boundaries", () => {
	const positions = (distance) => sceneryOffsets(distance).flatMap(offset =>
		Array.from({ length: 60 }, (_, i) => offset - i * 13 % 220))
		.filter(z => z > -170.4 && z < 35.4).sort((a, b) => a - b);
	for (const boundary of [26, 220, 440, 2200]) {
		const before = positions(boundary - 0.01);
		const after = positions(boundary + 0.01);
		expect(after.length).toBe(before.length);
		before.forEach((position, index) => expect(after[index] - position).toBeCloseTo(0.02, 8));
	}
});

test("track models keep their beat when crossing integer beats", () => {
	for (let first = -5; first < 100; first++) {
		const beats = Array.from({ length: 30 }, (_, slot) => beatForSlot(slot, first, 30));
		expect(new Set(beats).size).toBe(30);
		for (let slot = 0; slot < 30; slot++) {
			const next = beatForSlot(slot, first + 1, 30);
			expect(next).toBe(beats[slot] === first ? first + 30 : beats[slot]);
		}
	}
});
