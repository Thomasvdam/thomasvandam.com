import { describe, expect, test } from "bun:test";
import { MAX_POINTS } from "./model.ts";
import { angleDelta, coastStep, rotateWheel } from "./wheel-motion.ts";

const initial = points => ({ rotation: 0, remainder: 0, points });

describe("continuous wheel motion", () => {
	test("moves visually before a threshold, then changes the score by 100", () => {
		let { motion } = rotateWheel(initial(100), 12.5, -MAX_POINTS);
		expect(motion.rotation).toBe(12.5);
		expect(motion.points).toBe(100);
		motion = rotateWheel(motion, 17.5, -MAX_POINTS).motion;
		expect(motion.rotation).toBe(30);
		expect(motion.points).toBe(200);
		expect(motion.remainder).toBe(0);
		motion = rotateWheel(motion, 65, -MAX_POINTS).motion;
		expect(motion).toEqual({ rotation: 95, remainder: 5, points: 400 });
	});
	test("handles reverse rotation, negative scores and crossing the angle seam", () => {
		expect(angleDelta(175, -175)).toBe(10);
		expect(angleDelta(-175, 175)).toBe(-10);
		let { motion } = rotateWheel(initial(100), -65, -MAX_POINTS);
		expect(motion).toEqual({ rotation: -65, remainder: -5, points: -100 });
		motion = rotateWheel(motion, 35, -MAX_POINTS).motion;
		expect(motion).toEqual({ rotation: -30, remainder: 0, points: 0 });
	});
	test("small pointer movements accumulate without losing thresholds to rounding", () => {
		let motion = initial(100);
		for (let i = 0; i < 300; i++) motion = rotateWheel(motion, 0.1, -MAX_POINTS).motion;
		expect(motion.rotation).toBeCloseTo(30);
		expect(motion.points).toBe(200);
		expect(motion.remainder).toBe(0);
	});
	test("Skull Island stops at zero and reverses immediately without unwinding overshoot", () => {
		const { motion, blocked } = rotateWheel(initial(400), -300, 0);
		expect(blocked).toBe(true);
		expect(motion).toEqual({ rotation: -120, remainder: 0, points: 0 });
		const next = rotateWheel(motion, 30, 0);
		expect(next.motion.points).toBe(100);
		expect(next.blocked).toBe(false);
	});
	test("both score limits also constrain fractional rotation", () => {
		const minimum = rotateWheel(initial(0), -5, 0);
		expect(minimum.motion.rotation).toBe(0);
		expect(minimum.blocked).toBe(true);
		const maximum = rotateWheel(initial(MAX_POINTS - 100), 50, 0);
		expect(maximum.motion).toEqual({ rotation: 30, remainder: 0, points: MAX_POINTS });
		expect(maximum.blocked).toBe(true);
	});
});

describe("wheel inertia", () => {
	test("continues after release while slowing down in either direction", () => {
		for (const velocity of [-1, 1]) {
			const first = coastStep(velocity, 16);
			const second = coastStep(first.velocity, 16);
			expect(Math.sign(first.degrees)).toBe(Math.sign(velocity));
			expect(Math.abs(first.degrees)).toBeGreaterThan(Math.abs(second.degrees));
			expect(Math.abs(first.velocity)).toBeLessThan(Math.abs(velocity));
			expect(Math.abs(coastStep(velocity, 3000).velocity)).toBeLessThan(0.015);
		}
	});
	test("produces the same travel and score at different frame rates", () => {
		function coast(frames) {
			let velocity = 1;
			let motion = initial(100);
			for (let i = 0; i < frames; i++) {
				const step = coastStep(velocity, 1000 / frames);
				velocity = step.velocity;
				motion = rotateWheel(motion, step.degrees, -MAX_POINTS).motion;
			}
			return { motion, velocity };
		}
		const slow = coast(30), fast = coast(144);
		expect(slow.motion.rotation).toBeCloseTo(fast.motion.rotation, 8);
		expect(slow.velocity).toBeCloseTo(fast.velocity, 8);
		expect(slow.motion.points).toBe(fast.motion.points);
		expect(slow.motion.points).toBeGreaterThan(100);
	});
});
