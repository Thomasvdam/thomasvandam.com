import type { Sprites } from "./renderer";
import { SPRITE_PARTS } from "./sprite-parts";

const brightened = new WeakMap<Sprites, Sprites>();

// Prewarm during sprite loading. Filtering every articulated part on every hit
// can force hundreds of expensive canvas filter passes per frame.
export function bossHitSprites(sprites: Sprites, makeCanvas = () => document.createElement("canvas")): Sprites {
	const cached = brightened.get(sprites); if (cached) return cached;
	const result = { ...sprites };
	for (const [name, spec] of Object.entries(SPRITE_PARTS)) {
		if (!name.startsWith("boss")) continue;
		const key = name as keyof Sprites, source = sprites[key];
		const canvas = makeCanvas();
		// Boss source art has four pixels per logical rig unit.
		canvas.width = spec.width * 4; canvas.height = spec.height * 4;
		const ctx = canvas.getContext("2d")!;
		ctx.filter = "brightness(1.65)";
		ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
		result[key] = canvas;
	}
	brightened.set(sprites, result);
	return result;
}
