// Four bars of quarter notes. True = missing track, false = existing track.
export const PHRASE = [true, false, true, true, false, true, false, true, true, true, false, true, false, true, true, false];
export const START_BPM = 84;
export const MAX_BPM = 180;
const ACCELERATION = 0.16; // BPM per second, continuous across bar boundaries.
const RAMP_SECONDS = (MAX_BPM - START_BPM) / ACCELERATION;
const RAMP_BEATS = (START_BPM * RAMP_SECONDS + ACCELERATION * RAMP_SECONDS ** 2 / 2) / 60;

export function tempo(seconds: number) {
	return Math.min(MAX_BPM, START_BPM + ACCELERATION * seconds);
}

export function phaseAt(seconds: number) {
	const ramp = Math.min(seconds, RAMP_SECONDS);
	return (START_BPM * ramp + ACCELERATION * ramp ** 2 / 2) / 60 + Math.max(0, seconds - RAMP_SECONDS) * MAX_BPM / 60 - 4;
}

export function secondsAt(beat: number) {
	const beats = beat + 4;
	return beats > RAMP_BEATS ? RAMP_SECONDS + (beats - RAMP_BEATS) * 60 / MAX_BPM
		: (Math.sqrt(START_BPM ** 2 + 120 * ACCELERATION * beats) - START_BPM) / ACCELERATION;
}

export function needsTrack(beat: number) {
	return beat >= 0 && PHRASE[beat % PHRASE.length];
}

export function tolerance(beat: number) {
	return Math.min(0.095, 60 / tempo(secondsAt(Math.max(0, beat))) * 0.16);
}

export type Run = {
	mode: "ready" | "running" | "paused" | "crashed";
	seconds: number;
	checked: number;
	score: number;
	placed: Set<number>;
	reason: string;
};

export function newRun(): Run {
	return { mode: "ready", seconds: 0, checked: -1, score: 0, placed: new Set(), reason: "" };
}

export function advance(run: Run, seconds: number) {
	if (run.mode !== "running") return;
	run.seconds = seconds;
	while (seconds > secondsAt(run.checked + 1) + tolerance(run.checked + 1)) {
		const beat = ++run.checked;
		if (needsTrack(beat) && !run.placed.has(beat)) {
			run.mode = "crashed";
			run.reason = "Too late. The train reached a gap.";
			return;
		}
		run.placed.delete(beat - 12);
	}
}

export function layTrack(run: Run, seconds: number) {
	advance(run, seconds);
	if (run.mode !== "running") return;
	const beat = Math.round(phaseAt(seconds));
	if (run.placed.has(beat)) {
		run.reason = "Double track. One piece was enough.";
	} else if (beat < 0 || Math.abs(seconds - secondsAt(beat)) > tolerance(beat)) {
		run.reason = "Off beat. The track landed in the wrong place.";
	} else if (!needsTrack(beat)) {
		run.reason = "Duplicate track. That beat already had rails.";
	} else {
		run.placed.add(beat);
		run.score++;
		return;
	}
	run.mode = "crashed";
}
