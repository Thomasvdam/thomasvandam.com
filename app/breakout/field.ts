export const FIELD = { width: 18, height: 26, paddleY: 2, brickFloor: 7, brickCeiling: 24, radius: 0.24 };

export function wrapX(x: number) { return ((x % FIELD.width) + FIELD.width) % FIELD.width; }
export function aroundDelta(x: number, origin: number) { return wrapX(x - origin + FIELD.width / 2) - FIELD.width / 2; }
