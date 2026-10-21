import { createRigResolver, type Pose, type ResolvedPart, type Rig } from "./animation";
import { SPRITE_PARTS, type Skin } from "./sprite-parts";
import type { Sprites } from "./renderer";

export function drawResolvedParts(ctx: CanvasRenderingContext2D, sprites: Sprites, parts: readonly ResolvedPart[], travel = 0) {
	for (const part of parts) {
		if (part.opacity <= 0 || part.scaleX === 0 || part.scaleY === 0) continue;
		const spec = SPRITE_PARTS[part.sprite];
		const cos = Math.cos(part.angle), sin = Math.sin(part.angle);
		ctx.save(); ctx.transform(cos * part.scaleX, sin * part.scaleX, -sin * part.scaleY, cos * part.scaleY, part.x, part.y);
		ctx.globalAlpha *= part.opacity;
		ctx.drawImage(sprites[part.sprite], -spec.pivotX, -spec.pivotY, spec.width, spec.height);
		if (part.sprite.endsWith("Wheel") || part.sprite.endsWith("Tread")) {
			ctx.fillStyle = "#9aa78c";
			const left = part.sprite.endsWith("Tread") ? -12 : -7, right = part.sprite.endsWith("Tread") ? 11 : 7;
			for (let x = left + (travel / 2 % 4); x < right; x += 4) { ctx.fillRect(x, -5, 1, 2); ctx.fillRect(x, 5, 1, 2); }
		}
		ctx.restore();
	}
}
// Drawing consumes each borrowed result synchronously. The weak keys keep
// workspaces bounded to the immutable rigs that are still in use.
const rigResolvers = new WeakMap<Rig, ReturnType<typeof createRigResolver>>();
export function drawRig(ctx: CanvasRenderingContext2D, sprites: Sprites, rig: Rig, skin: Skin, pose: Pose, x: number, y: number, scale = 1, flash = false, travel = 0) {
	ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
	if (flash) ctx.filter = "brightness(1.8)";
	let resolve = rigResolvers.get(rig);
	if (!resolve) { resolve = createRigResolver(rig); rigResolvers.set(rig, resolve); }
	drawResolvedParts(ctx, sprites, resolve(skin, pose), travel);
	ctx.restore();
}
