import { advance, layTrack, needsTrack, secondsAt, type Run } from "./rhythm";

export type Practice = { beat: number; count: number; waiting: boolean };
function nextGap(run: Run, after: number) {
	let beat = after;
	while (!needsTrack(run, beat)) beat++;
	return beat;
}
export function createPractice(run: Run): Practice {
	return { beat: nextGap(run, 0), count: 0, waiting: false };
}
// Cap the actual game clock before checking missed gaps, even after a long frame.
export function advancePractice(run: Run, seconds: number, practice: Practice) {
	if (run.mode !== "running") return;
	const target = secondsAt(practice.beat);
	advance(run, Math.min(seconds, target));
	practice.waiting = seconds >= target;
}
export function placePractice(run: Run, practice: Practice) {
	if (run.mode !== "running" || !practice.waiting || practice.count >= 2) return false;
	layTrack(run, secondsAt(practice.beat), false);
	practice.count++;
	practice.waiting = false;
	if (practice.count < 2) practice.beat = nextGap(run, practice.beat + 1);
	return true;
}
