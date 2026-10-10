export const HOLD_MS = 350;
export const ROW_HEIGHT = 42;
export const MOVE_TOLERANCE = 10;
// Keep the initial hold neutral so releasing without a drag changes nothing.
export function dragChoice(startY: number, currentY: number, count: number, firstRowY: number): number {
	const delta = currentY - startY;
	if (Math.abs(delta) < MOVE_TOLERANCE) return -1;
	return Math.max(0, Math.min(count - 1, Math.floor((currentY - firstRowY) / ROW_HEIGHT)));
}

// Content coordinates at the initial midpoint remain under the moving fingers.
export function pinchView(start: { distance: number; zoom: number; x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) {
	const zoom = Math.max(.5, Math.min(2.5, start.zoom * Math.hypot(b.x - a.x, b.y - a.y) / start.distance));
	return { zoom, x: start.x * zoom, y: start.y * zoom, centerX: (a.x + b.x) / 2, centerY: (a.y + b.y) / 2 };
}
