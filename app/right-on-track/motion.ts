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
