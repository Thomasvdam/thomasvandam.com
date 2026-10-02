import { phraseAt, type Run } from "./rhythm";

export const TRACK_LENGTH = 6;
export const PLACEMENT_Z = -4;
export const SCENERY_LENGTH = 220;

// Three neighboring copies cover the view across a wrap without moving visible trees.
export function sceneryOffsets(distance: number) {
	const offset = ((distance % SCENERY_LENGTH) + SCENERY_LENGTH) % SCENERY_LENGTH;
	return [offset - SCENERY_LENGTH, offset, offset + SCENERY_LENGTH];
}

// A slot keeps its beat until it is behind the camera, then returns at the horizon.
export function beatForSlot(slot: number, first: number, count: number) {
	return first + ((slot - first) % count + count) % count;
}

// A landscape belongs to a fixed stretch of railway, including the view ahead.
export function landscapeBands(run: Run, phase: number) {
	let phrase = phraseAt(run, Math.max(0, phase - 24));
	const initial = phrase.landscape === "autumn" ? 1 : 0;
	const changes: { beat: number; value: number }[] = [];
	while (phrase.end < phase + 64) {
		const next = phraseAt(run, phrase.end);
		if (next.landscape !== phrase.landscape) changes.push({ beat: next.start, value: next.landscape === "autumn" ? 1 : 0 });
		phrase = next;
	}
	return { initial, changes };
}

export function landscapeBlend(bands: ReturnType<typeof landscapeBands>, beat: number) {
	let blend = bands.initial;
	for (const change of bands.changes) {
		const progress = Math.max(0, Math.min(1, (beat - change.beat) / 2));
		blend += (change.value - blend) * progress * progress * (3 - 2 * progress);
	}
	return blend;
}

// BoxGeometry's top-face V decreases as world Z increases.
export function surfaceOffset(distance: number, repeats: number, length: number) {
	return distance * repeats / length;
}

// Long, shallow bends keep the next several gaps readable.
export function trackCenter(distance: number) {
	return 3.2 * Math.sin(distance * Math.PI * 2 / 340) + 1.1 * Math.sin(distance * Math.PI * 2 / 190);
}

export function trackHeading(distance: number) {
	const slope = 3.2 * Math.PI * 2 / 340 * Math.cos(distance * Math.PI * 2 / 340)
		+ 1.1 * Math.PI * 2 / 190 * Math.cos(distance * Math.PI * 2 / 190);
	return -Math.atan(slope);
}

export function trackPosition(distance: number, z: number) {
	return trackCenter(distance - z) - trackCenter(distance);
}

export type EncounterKind = "hut" | "lumberjack" | "crossing" | "bears";
export function encounterAt(seed: number, index: number) {
	let hash = Math.imul(seed ^ Math.imul(index + 1, 0x45d9f3b), 0x27d4eb2d);
	hash = Math.imul(hash ^ hash >>> 16, 0x85ebca6b);
	const random = ((hash ^ hash >>> 13) >>> 0) / 4294967296;
	const kind: EncounterKind | null = random < 0.02 ? "bears" : random < 0.22 ? "hut" : random < 0.42 ? "lumberjack" : random < 0.62 ? "crossing" : null;
	return { kind, distance: index * SCENERY_LENGTH + 90 + ((hash >>> 8) % 51) - 25, side: hash & 1 ? -1 : 1, cars: (hash >>> 16) % 4 };
}

// Distant ridges move much more slowly than the forest; no periodic reset.
export function mountainOffset(distance: number, layer: number) {
	return { x: Math.sin(distance / (1400 + layer * 600)) * (16 - layer * 3), z: Math.sin(distance / (1800 + layer * 700)) * 10 };
}
