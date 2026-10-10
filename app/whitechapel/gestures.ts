export const HOLD_MS = 350;
export const ROW_HEIGHT = 42;
export const MOVE_TOLERANCE = 10;
// Keep the initial hold neutral so releasing without a drag changes nothing.
export function dragChoice(startY: number, currentY: number, count: number, firstRowY: number): number {
	const delta = currentY - startY;
	if (Math.abs(delta) < MOVE_TOLERANCE) return -1;
	return Math.max(0, Math.min(count - 1, Math.floor((currentY - firstRowY) / ROW_HEIGHT)));
}
