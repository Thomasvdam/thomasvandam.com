import { clamp, type Vector } from "./math";
import { FIELD } from "./game";

export type Camera = { x: number; y: number; width: number; height: number; offsetX: number; offsetY: number };
export function cameraFor(player: Vector, width: number, height: number): Camera {
	return {
		x: width < FIELD.width ? clamp(player.x - width / 2, 0, FIELD.width - width) : 0,
		y: height < FIELD.height ? clamp(player.y - height / 2, 0, FIELD.height - height) : 0,
		width, height, offsetX: Math.max(0, (width - FIELD.width) / 2), offsetY: Math.max(0, (height - FIELD.height) / 2),
	};
}
export function screenToWorld(point: Vector, camera: Camera): Vector {
	return { x: point.x + camera.x - camera.offsetX, y: point.y + camera.y - camera.offsetY };
}
