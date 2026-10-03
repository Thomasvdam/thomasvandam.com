import { railwayHeight, routeCenter, routeHeading, type Junction } from "./motion";

export const WAGON_DISTANCE = 9.8;
export const WAGON_HALF_LENGTH = 2.6;

// Sample both axles behind the locomotive rather than inheriting its rotation.
export function wagonPose(seed: number, distance: number, junctions: Junction[], base = 0) {
	const d = distance - WAGON_DISTANCE;
	const front = d + 1.8, rear = d - 1.8;
	const dx = routeCenter(front, junctions, base) - routeCenter(rear, junctions, base);
	const dy = railwayHeight(seed, front) - railwayHeight(seed, rear);
	const yaw = -Math.atan(dx / 3.6);
	return { x: routeCenter(d, junctions, base) - routeCenter(distance, junctions, base),
		y: (railwayHeight(seed, front) + railwayHeight(seed, rear)) / 2, z: WAGON_DISTANCE,
		yaw, pitch: Math.atan(dy / Math.hypot(3.6, dx)), engineYaw: routeHeading(distance, junctions, base) };
}
