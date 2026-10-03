import { FORK_OFFSET } from "./fork-config";
import { encounterAt, SCENERY_LENGTH } from "./scenery-schedule";

export type Meter = 3 | 4;
export type Landscape = "forest" | "autumn";
export type Section = "normal" | "concert" | "fairground" | "quarry" | "yard";
export type Phrase = { index: number; start: number; end: number; meter: Meter; landscape: Landscape; pattern: boolean[]; section: Section };

// A rare pair begins and ends on phrase boundaries, away from the opening tutorial.
export function phraseSection(seed: number, index: number): Section {
	if (index % 48 === 36 || index % 48 === 37) {
		const hash = (Math.imul(seed ^ Math.imul(Math.floor(index / 48) + 1, 0x39a74e1b), 0x27d4eb2d) >>> 0) / 4294967296;
		if (hash < 0.25) return "yard";
	}
	const position = index % 36;
	if ([16, 17, 28, 29].includes(position)) {
		const pair = position < 20 ? 16 : 28;
		const hash = (Math.imul(seed ^ Math.imul(Math.floor(index / 36) + pair, 0x51ed270b), 0x27d4eb2d) >>> 0) / 4294967296;
		if (hash < 0.65) return pair === 16 ? "fairground" : "quarry";
	}
	if (index % 12 !== 8 && index % 12 !== 9) return "normal";
	const group = Math.floor(index / 12);
	const hash = (Math.imul(seed ^ Math.imul(group + 1, 0x6c8e9cf5), 0x27d4eb2d) >>> 0) / 4294967296;
	return hash < 0.4 ? "concert" : "normal";
}
export type ConcertHit = "stomp" | "clap" | "rest";
export function concertHit(beat: number, start: number): ConcertHit {
	return (["stomp", "stomp", "clap", "rest"] as const)[((beat - start) % 4 + 4) % 4];
}

// Only the fourth phrase in a group can use 3/4; named sections stay in 4/4.
export function phraseMeter(seed: number, index: number): Meter {
	if (phraseSection(seed, index) !== "normal" || index % 4 !== 3) return 4;
	let hash = Math.imul(seed ^ Math.imul(index + 1, 0x45d9f3b), 0x27d4eb2d);
	hash = Math.imul(hash ^ hash >>> 16, 0x85ebca6b);
	return ((hash ^ hash >>> 13) >>> 0) / 4294967296 < 0.6 ? 3 : 4;
}

// Seeded per phrase: looking ahead never changes an already visible gap.
export function generatePhrase(seed: number, phrase: number, meter: Meter = phraseMeter(seed, phrase)) {
	const section = phraseSection(seed, phrase);
	if (section === "yard") return Array.from({ length: 16 }, (_, beat) => beat % 4 !== 1);
	if (section === "fairground") return Array.from({ length: 16 }, (_, beat) => [0, 2].includes(beat % 4));
	if (section === "quarry") return Array.from({ length: 16 }, (_, beat) => [0, 1, 3].includes(beat % 4));
	if (section === "concert") return Array.from({ length: 16 }, (_, beat) => concertHit(beat, 0) !== "rest");
	let state = (seed ^ Math.imul(phrase + 1, 0x9e3779b9)) >>> 0;
	const random = () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let value = Math.imul(state ^ state >>> 15, state | 1);
		value ^= value + Math.imul(value ^ value >>> 7, value | 61);
		return ((value ^ value >>> 14) >>> 0) / 4294967296;
	};
	return Array.from({ length: 4 }, () => {
		const order = Array.from({ length: meter }, (_, i) => i);
		for (let i = meter - 1; i > 0; i--) {
			const j = Math.floor(random() * (i + 1));
			[order[i], order[j]] = [order[j], order[i]];
		}
		const gaps = 1 + Math.floor(random() * (meter - 1));
		return order.map((_, index) => order.slice(0, gaps).includes(index));
	}).flat();
}
export const START_BPM = 95;
export const MAX_BPM = 180;
const ACCELERATION = 0.24; // BPM per second, continuous across bar boundaries.
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

export function phraseAt(run: Run, beat: number): Phrase {
	const target = Math.max(0, Math.floor(beat));
	for (const phrase of run.phrases.values()) if (target >= phrase.start && target < phrase.end) return phrase;
	// Normal lookahead is incremental. Old, pruned phrases can be regenerated deterministically.
	let index = target < run.generatedThrough ? 0 : run.generatedIndex;
	let start = target < run.generatedThrough ? 0 : run.generatedThrough;
	while (true) {
		const meter = phraseMeter(run.seed, index);
		const end = start + meter * 4;
		if (end > run.generatedThrough) { run.generatedThrough = end; run.generatedIndex = index + 1; }
		if (target < end) {
			let section = phraseSection(run.seed, index);
			if (section === "yard" && !yardGroundClear(run.seed, start - (index % 48 === 37 ? 16 : 0))) section = "normal";
			const pattern = section === "normal" && phraseSection(run.seed, index) === "yard"
				? generatePhrase(run.seed, index + 2, meter) : generatePhrase(run.seed, index, meter);
			const phrase: Phrase = { index, start, end, meter, landscape: meter === 3 ? "autumn" : "forest", pattern, section };
			run.phrases.set(start, phrase); return phrase;
		}
		start = end; index++;
	}
}

export function yardGroundClear(seed: number, start: number) {
	const dock = (start + 24) * 6 - 9.8;
	const index = Math.floor(dock / SCENERY_LENGTH);
	for (let i = Math.max(0, index - 1); i <= index + 1; i++) {
		const feature = encounterAt(seed, i);
		if ((feature.kind === "river" || feature.kind === "crossing") && Math.abs(feature.distance - dock) < 66) return false;
	}
	return true;
}

// Sparse signals belong to phrases, so lookahead and replay agree.
export function signalBeat(seed: number, index: number, start: number, meter: Meter) {
	const hash = (Math.imul(seed ^ Math.imul(index + 1, 0x51ed270b), 0x27d4eb2d) >>> 0) / 4294967296;
	if (phraseSection(seed, index) !== "normal" || index % 4 !== 1 || hash >= 0.45) return null;
	const beat = start + meter * 2, distance = (beat + 4) * 6 + 4;
	// Keep forks clear of river ramps and crossing gates/cars.
	for (let i = Math.max(0, Math.floor((distance - 43) / SCENERY_LENGTH)); i <= Math.floor((distance + 283) / SCENERY_LENGTH); i++) {
		const encounter = encounterAt(seed, i);
		if ((encounter.kind === "river" || encounter.kind === "crossing") && encounter.distance > distance - 43 && encounter.distance < distance + 283) return null;
	}
	return beat;
}
export function signalsAhead(run: Run, phase: number) {
	const signals: number[] = [];
	let phrase = phraseAt(run, Math.max(0, phase - 40));
	while (phrase.start < phase + 64) {
		const beat = signalBeat(run.seed, phrase.index, phrase.start, phrase.meter);
		if (beat !== null && beat > run.routeThrough) signals.push(beat);
		phrase = phraseAt(run, phrase.end);
	}
	return signals;
}
export function activeSignal(run: Run, seconds = run.seconds) {
	const phase = phaseAt(seconds);
	const phrase = phraseAt(run, Math.max(0, phase));
	const beat = signalBeat(run.seed, phrase.index, phrase.start, phrase.meter);
	return beat !== null && seconds >= secondsAt(beat - 2) && seconds < secondsAt(beat + 0.75) ? beat : null;
}
export function needsTrack(run: Run, beat: number) {
	if (beat < 0) return false;
	const phrase = phraseAt(run, beat);
	const signal = signalBeat(run.seed, phrase.index, phrase.start, phrase.meter);
	if (signal !== null && beat >= signal - 2 && beat <= signal + 1) return false;
	if (signal !== null && beat === signal + 2) return true;
	const offset = beat - phrase.start;
	if (offset % 1 === 0.5) {
		// Fairground: one quick pair per bar. Quarry: a four-hit burst every other bar.
		return phrase.section === "fairground" ? offset % 4 === 0.5
			: phrase.section === "quarry" && [0.5, 1.5].includes(offset % 8);
	}
	return Number.isInteger(offset) && phrase.pattern[offset];
}

export function trackStep(run: Run, beat: number) {
	const section = phraseAt(run, Math.max(0, beat)).section;
	return section === "fairground" || section === "quarry" ? 0.5 : 1;
}

export function nearestTrackBeat(run: Run, phase: number) {
	// Choose between the grids on both sides of a phrase boundary.
	const candidates = [Math.floor(phase), Math.ceil(phase)];
	const half = Math.floor(phase * 2) / 2;
	for (const beat of [half, half + 0.5]) if (trackStep(run, beat) === 0.5) candidates.push(beat);
	return candidates.reduce((best, beat) => Math.abs(beat - phase) <= Math.abs(best - phase) ? beat : best);
}
export function placementEarlyTolerance(run: Run, beat: number) {
	return trackStep(run, beat) === 0.5 || trackStep(run, beat - 0.5) === 0.5 ? Math.min(earlyTolerance(beat), 60 / tempo(secondsAt(beat)) * 0.24) : earlyTolerance(beat);
}

export function isDownbeat(run: Run, beat: number) {
	if (beat < 0) return (beat + 4) % 4 === 0;
	const phrase = phraseAt(run, beat);
	return (beat - phrase.start) % phrase.meter === 0;
}

export function tolerance(beat: number) {
	return Math.min(0.095, 60 / tempo(secondsAt(Math.max(0, beat))) * 0.16);
}

export function earlyTolerance(beat: number) {
	return Math.min(0.22, 60 / tempo(secondsAt(Math.max(0, beat))) * 0.38);
}

export type Run = {
	seed: number;
	phrases: Map<number, Phrase>;
	generatedThrough: number;
	generatedIndex: number;
	placement: { beat: number; seconds: number; side: -1 | 1 | null } | null;
	mode: "ready" | "running" | "paused" | "crashed";
	seconds: number;
	checked: number;
	score: number;
	placed: Set<number>;
	placedSides: Map<number, -1 | 1>;
	routeBase: number;
	routeThrough: number;
	switches: Map<number, -1 | 1>;
	reason: string;
};

export function newRun(seed = 0): Run {
	return { seed, phrases: new Map(), generatedThrough: 0, generatedIndex: 0, placement: null, mode: "ready", seconds: 0, checked: -1, score: 0, placed: new Set(), placedSides: new Map(), routeBase: 0, routeThrough: -1, switches: new Map(), reason: "" };
}

export function advance(run: Run, seconds: number) {
	if (run.mode !== "running") return;
	run.seconds = seconds;
	while (seconds > secondsAt(run.checked + 0.5) + tolerance(run.checked + 0.5)) {
		const beat = run.checked += 0.5;
		if (needsTrack(run, beat) && !run.placed.has(beat)) {
			run.mode = "crashed";
			run.reason = "Too late. The train reached a gap.";
			return;
		}
		run.placed.delete(beat - 12);
		run.placedSides.delete(beat - 12);
		const oldBeat = beat - 40;
		if (oldBeat >= 0) {
			const oldPhrase = phraseAt(run, oldBeat);
			const signal = signalBeat(run.seed, oldPhrase.index, oldPhrase.start, oldPhrase.meter);
			if (signal === oldBeat) {
				run.routeBase += (run.switches.get(signal) ?? -1) * FORK_OFFSET;
				run.routeThrough = signal; run.switches.delete(signal);
			}
		}
		for (const [start, phrase] of run.phrases) if (phrase.end < beat - 48) run.phrases.delete(start);
	}
}

export function layTrack(run: Run, seconds: number) {
	advance(run, seconds);
	if (run.mode !== "running") return;
	const signal = activeSignal(run, seconds);
	if (signal !== null) {
		run.switches.set(signal, (run.switches.get(signal) ?? -1) === -1 ? 1 : -1);
		return;
	}
	const beat = nearestTrackBeat(run, phaseAt(seconds)) || 0;
	if (run.placed.has(beat)) {
		run.reason = "Double track. One piece was enough.";
	} else if (beat < 0 || seconds < secondsAt(beat) - placementEarlyTolerance(run, beat) || seconds > secondsAt(beat) + tolerance(beat)) {
		run.reason = "Too early. The track landed in the wrong place.";
	} else if (!needsTrack(run, beat)) {
		run.reason = "Duplicate track. That beat already had rails.";
	} else {
		run.placed.add(beat);
		run.score++;
		const branch = branchForBeat(run, beat);
		if (branch !== null) run.placedSides.set(beat, run.switches.get(branch) ?? -1);
		run.placement = { beat, seconds, side: branch === null ? null : run.switches.get(branch) ?? -1 };
		return;
	}
	run.mode = "crashed";
}

export function branchForBeat(run: Run, beat: number) {
	return signalsAhead(run, beat).find(signal => beat >= signal + 1 && beat <= signal + 40) ?? null;
}
export function branchLaid(run: Run, beat: number, side: -1 | 1) {
	return !needsTrack(run, beat) || (run.placed.has(beat) && run.placedSides.get(beat) === side);
}

// Decorative railway speed, independent of the world-unit scale.
export function trainSpeed(seconds: number) {
	return Math.round(28 + (tempo(seconds) - START_BPM) * 0.8);
}
