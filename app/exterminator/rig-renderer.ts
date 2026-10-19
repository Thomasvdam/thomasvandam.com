import { resolveRig, type Pose, type ResolvedPart, type Rig } from "./animation";
import { SPRITE_PARTS, type Skin } from "./sprite-parts";
import type { Sprites } from "./renderer";

export function drawResolvedParts(ctx: CanvasRenderingContext2D, sprites: Sprites, parts: readonly ResolvedPart[], travel = 0) {
	for (const part of parts) {
		const spec = SPRITE_PARTS[part.sprite];
		ctx.save(); ctx.translate(part.x, part.y); ctx.rotate(part.angle); ctx.scale(part.scaleX, part.scaleY);
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
export function drawRig(ctx: CanvasRenderingContext2D, sprites: Sprites, rig: Rig, skin: Skin, pose: Pose, x: number, y: number, scale = 1, flash = false, travel = 0) {
	ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
	if (flash) ctx.filter = "brightness(1.8)";
	drawResolvedParts(ctx, sprites, resolveRig(rig, skin, pose), travel);
	ctx.restore();
}
