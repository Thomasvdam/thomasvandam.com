import { MAX_POINTS } from "./model";

export const DEGREES_PER_STEP = 30;
export const MAX_VELOCITY = 1.5; // degrees per millisecond
export const STOP_VELOCITY = 0.015;
const DECAY_TIME = 350;

export type WheelMotion = { rotation: number; remainder: number; points: number };

export function angleDelta(from: number, to: number): number {
	return ((to - from + 540) % 360) - 180;
}

export function rotateWheel(motion: WheelMotion, degrees: number, minimum: number): { motion: WheelMotion; blocked: boolean } {
	const lower = (minimum - motion.points) / 100 * DEGREES_PER_STEP - motion.remainder;
	const upper = (MAX_POINTS - motion.points) / 100 * DEGREES_PER_STEP - motion.remainder;
	const travel = Math.max(lower, Math.min(upper, degrees));
	const accumulated = motion.remainder + travel;
	const steps = Math.sign(accumulated) * Math.floor((Math.abs(accumulated) + 1e-8) / DEGREES_PER_STEP);
	const remainder = accumulated - steps * DEGREES_PER_STEP;
	return {
		motion: { rotation: motion.rotation + travel, remainder: Math.abs(remainder) < 1e-8 ? 0 : remainder, points: Math.max(minimum, Math.min(MAX_POINTS, motion.points + steps * 100)) },
		blocked: travel !== degrees,
	};
}

// Analytic exponential decay makes momentum independent of the display's frame rate.
export function coastStep(velocity: number, elapsed: number): { degrees: number; velocity: number } {
	const decay = Math.exp(-elapsed / DECAY_TIME);
	return { degrees: velocity * DECAY_TIME * (1 - decay), velocity: velocity * decay };
}
