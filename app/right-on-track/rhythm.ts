export const PHRASE_LENGTH = 16;

// Seeded per phrase: looking ahead never changes an already visible gap.
export function generatePhrase(seed: number, phrase: number) {
	let state = (seed ^ Math.imul(phrase + 1, 0x9e3779b9)) >>> 0;
	const random = () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let value = Math.imul(state ^ state >>> 15, state | 1);
		value ^= value + Math.imul(value ^ value >>> 7, value | 61);
		return ((value ^ value >>> 14) >>> 0) / 4294967296;
	};
	return Array.from({ length: 4 }, () => {
		const order = [0, 1, 2, 3];
		for (let i = 3; i > 0; i--) {
			const j = Math.floor(random() * (i + 1));
			[order[i], order[j]] = [order[j], order[i]];
		}
		const gaps = 1 + Math.floor(random() * 3);
		return order.map((_, index) => order.slice(0, gaps).includes(index));
	}).flat();
}
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

export function needsTrack(run: Run, beat: number) {
	if (beat < 0) return false;
	const index = Math.floor(beat / PHRASE_LENGTH);
	let phrase = run.phrases.get(index);
	if (!phrase) { phrase = generatePhrase(run.seed, index); run.phrases.set(index, phrase); }
	return phrase[beat % PHRASE_LENGTH];
}

export function tolerance(beat: number) {
	return Math.min(0.095, 60 / tempo(secondsAt(Math.max(0, beat))) * 0.16);
}

export function earlyTolerance(beat: number) {
	return Math.min(0.22, 60 / tempo(secondsAt(Math.max(0, beat))) * 0.38);
}

export type Run = {
	seed: number;
	phrases: Map<number, boolean[]>;
	placement: { beat: number; seconds: number } | null;
	mode: "ready" | "running" | "paused" | "crashed";
	seconds: number;
	checked: number;
	score: number;
	placed: Set<number>;
	reason: string;
};

export function newRun(seed = 0): Run {
	return { seed, phrases: new Map(), placement: null, mode: "ready", seconds: 0, checked: -1, score: 0, placed: new Set(), reason: "" };
}

export function advance(run: Run, seconds: number) {
	if (run.mode !== "running") return;
	run.seconds = seconds;
	while (seconds > secondsAt(run.checked + 1) + tolerance(run.checked + 1)) {
		const beat = ++run.checked;
		if (needsTrack(run, beat) && !run.placed.has(beat)) {
			run.mode = "crashed";
			run.reason = "Too late. The train reached a gap.";
			return;
		}
		run.placed.delete(beat - 12);
		if (beat % PHRASE_LENGTH === 0) run.phrases.delete(Math.floor(beat / PHRASE_LENGTH) - 2);
	}
}

export function layTrack(run: Run, seconds: number) {
	advance(run, seconds);
	if (run.mode !== "running") return;
	const beat = Math.round(phaseAt(seconds)) || 0;
	if (run.placed.has(beat)) {
		run.reason = "Double track. One piece was enough.";
	} else if (beat < 0 || seconds < secondsAt(beat) - earlyTolerance(beat) || seconds > secondsAt(beat) + tolerance(beat)) {
		run.reason = "Off beat. The track landed in the wrong place.";
	} else if (!needsTrack(run, beat)) {
		run.reason = "Duplicate track. That beat already had rails.";
	} else {
		run.placed.add(beat);
		run.score++;
		run.placement = { beat, seconds };
		return;
	}
	run.mode = "crashed";
}
