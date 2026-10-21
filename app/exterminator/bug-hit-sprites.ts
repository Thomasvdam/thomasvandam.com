import type { Sprites } from "./renderer";
import { SPRITE_PARTS } from "./sprite-parts";

const brightened = new WeakMap<Sprites, Sprites>();

// Preserve the 1.8× hit flash without filtering every articulated draw during
// combat. Ordinary bug art is 32×32; the cache adds about 1.2 MiB per sprite set.
export function bugHitSprites(sprites: Sprites, makeCanvas = () => document.createElement("canvas")): Sprites {
	const cached = brightened.get(sprites); if (cached) return cached;
	const result = { ...sprites };
	for (const [name, spec] of Object.entries(SPRITE_PARTS)) {
		if (!name.startsWith("bug")) continue;
		const key = name as keyof Sprites, canvas = makeCanvas();
		canvas.width = spec.width; canvas.height = spec.height;
		const ctx = canvas.getContext("2d")!;
		ctx.filter = "brightness(1.8)"; ctx.drawImage(sprites[key], 0, 0, canvas.width, canvas.height);
		result[key] = canvas;
	}
	brightened.set(sprites, result); return result;
}
