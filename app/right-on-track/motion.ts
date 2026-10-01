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
