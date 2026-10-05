export const FIELD = { width: 18, height: 26, paddleY: 2, brickFloor: 7, brickCeiling: 24, radius: 0.24 };
export const DOME_TRAVEL = FIELD.width / 2;

// Above the cylinder, height is distance along a semicircle to the opposite side.
export function surfacePoint(x: number, y: number, radius: number, dome = false) {
	const angle = x / FIELD.width * Math.PI * 2;
	const progress = dome && y > FIELD.height ? Math.min(Math.PI, (y - FIELD.height) / DOME_TRAVEL * Math.PI) : 0;
	return { x: Math.sin(angle) * radius * Math.cos(progress), y: -Math.cos(angle) * radius * Math.cos(progress), z: progress ? FIELD.height + radius * Math.sin(progress) : y };
}

export function wrapX(x: number) { return ((x % FIELD.width) + FIELD.width) % FIELD.width; }
export function aroundDelta(x: number, origin: number) { return wrapX(x - origin + FIELD.width / 2) - FIELD.width / 2; }
