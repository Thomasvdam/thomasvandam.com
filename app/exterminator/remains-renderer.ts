import { BUG_SPECS, type Enemy } from "./bug-types";
import type { Game } from "./game";
import { clamp } from "./math";
import { CORPSE_BURN_TIME, CORPSE_LIFETIME, corpseAlive, type BugRemains } from "./remains";
import { bugSkin, SPRITE_PARTS, type SpritePart, type Skin } from "./sprite-parts";
import type { Sprites } from "./renderer";

function part(ctx: CanvasRenderingContext2D, sprites: Sprites, name: SpritePart | undefined, x = 0, scale = 1) {
	if (!name) return;
	const spec = SPRITE_PARTS[name]; ctx.drawImage(sprites[name], x - spec.pivotX * scale, -spec.pivotY * scale, spec.width * scale, spec.height * scale);
}
type PaintCarcass = (ctx: CanvasRenderingContext2D, skin: Skin, head: boolean) => void;
function paintCarcass(ctx: CanvasRenderingContext2D, sprites: Sprites, skin: Skin, head: boolean) {
	part(ctx, sprites, skin.body, -2); part(ctx, sprites, skin.shell, -3); if (head) part(ctx, sprites, skin.head, 7);
}
export function drawRemains(ctx: CanvasRenderingContext2D, game: Game, sprites: Sprites, paint?: PaintCarcass, fade = true) {
	for (const remains of game.remains) {
		if (!corpseAlive(remains, game.time)) continue;
		const decay = clamp((game.time - remains.diedAt) / CORPSE_LIFETIME, 0, 1), burning = remains.burnAt !== undefined;
		const burn = burning ? clamp((game.time - remains.burnAt!) / CORPSE_BURN_TIME, 0, 1) : 0;
		const skin = bugSkin(remains.variant, remains.id), scale = BUG_SPECS[remains.variant].radius / 15;
		const draw = (x: number, y: number, angle: number, head: boolean) => {
			ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.scale(scale * (1 - burn * .4), scale * .65 * (1 - burn * .4));
			ctx.globalAlpha = .5 * (fade ? 1 - decay : 1) * (1 - burn);
			if (paint) paint(ctx, skin, head); else paintCarcass(ctx, sprites, skin, head);
			ctx.restore();
			if (burning) {
				ctx.save(); ctx.globalAlpha = (1 - burn) * .7; ctx.fillStyle = "#ed9b55";
				for (let i = 0; i < 3; i++) { const flicker = Math.sin(game.time * 24 + i * 2 + remains.id); ctx.fillRect(x - 9 + i * 7, y - 5 - flicker * 3, 3, 4 + flicker * 2); }
				ctx.restore();
			}
		};
		for (let i = remains.segments.length - 1; i >= 0; i--) {
			const point = remains.segments[i], leader = i === 0 ? remains : remains.segments[i - 1];
			draw(point.x, point.y, Math.atan2(leader.y - point.y, leader.x - point.x), false);
		}
		draw(remains.x, remains.y, remains.angle, true);
	}
}
// Static three-second cohorts keep decay cheap even after a crowded battle.
// Collection and fire invalidate only the affected cohort; baking each skin once
// also avoids repeatedly compositing its separate modular parts.
export function createRemainsLayer(makeCanvas: () => HTMLCanvasElement) {
	const canvas = makeCanvas(), ctx = canvas.getContext("2d")!;
	canvas.width = 560; canvas.height = 360;
	const art = new Map<string, HTMLCanvasElement>();
	let activeSprites: Sprites | undefined;
	const paint: PaintCarcass = (destination, skin, head) => {
		const key = `${skin.body}:${skin.shell}:${head ? skin.head : ""}`;
		let image = art.get(key);
		if (!image) {
			image = makeCanvas(); image.width = 64; image.height = 48;
			const painter = image.getContext("2d")!; painter.imageSmoothingEnabled = false;
			painter.translate(32, 24); paintCarcass(painter, activeSprites!, skin, head); art.set(key, image);
		}
		destination.drawImage(image, -32, -24);
	};
	const cohorts = new Map<number, { canvas: HTMLCanvasElement; bodies: BugRemains[]; bornAt: number }>();
	let snapshot: { corpse: BugRemains; burnAt: number | undefined }[] = [], tick = -1;
	return (game: Game, sprites: Sprites) => {
		if (activeSprites !== sprites) { art.clear(); cohorts.clear(); activeSprites = sprites; tick = -1; }
		const nextTick = Math.floor(game.time * 10);
		if (tick !== nextTick || snapshot.length !== game.remains.length || snapshot.some((entry, index) => entry.corpse !== game.remains[index] || entry.burnAt !== game.remains[index].burnAt)) {
			const groups = new Map<number, BugRemains[]>(), burning: BugRemains[] = [];
			for (const body of game.remains) {
				if (!corpseAlive(body, game.time)) continue;
				if (body.burnAt !== undefined) { burning.push(body); continue; }
				const key = Math.floor(body.diedAt / 3), group = groups.get(key);
				if (group) group.push(body); else groups.set(key, [body]);
			}
			for (const key of cohorts.keys()) if (!groups.has(key)) cohorts.delete(key);
			ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.imageSmoothingEnabled = false;
			for (const [key, bodies] of groups) {
				let cohort = cohorts.get(key);
				if (!cohort || cohort.bodies.length !== bodies.length || cohort.bodies.some((body, index) => body !== bodies[index])) {
					const layer = cohort?.canvas ?? makeCanvas(); layer.width = 560; layer.height = 360;
					const painter = layer.getContext("2d")!; painter.imageSmoothingEnabled = false; painter.scale(.5, .5);
					drawRemains(painter, { ...game, remains: bodies }, sprites, paint, false);
					cohort = { canvas: layer, bodies, bornAt: bodies.reduce((sum, body) => sum + body.diedAt, 0) / bodies.length }; cohorts.set(key, cohort);
				}
				ctx.globalAlpha = 1 - clamp((game.time - cohort.bornAt) / CORPSE_LIFETIME, 0, 1); ctx.drawImage(cohort.canvas, 0, 0);
			}
			ctx.save(); ctx.globalAlpha = 1; ctx.scale(.5, .5); drawRemains(ctx, { ...game, remains: burning }, sprites, paint); ctx.restore();
			tick = nextTick; snapshot = game.remains.map(corpse => ({ corpse, burnAt: corpse.burnAt }));
		}
		return canvas;
	};
}
export function drawBackpack(ctx: CanvasRenderingContext2D, game: Game, enemy: Extract<Enemy, { variant: "assassin" }>, sprites: Sprites) {
	ctx.save(); ctx.translate(enemy.x, enemy.y); ctx.rotate(enemy.angle);
	for (let i = 0; i < enemy.state.backpack.length; i++) {
		const plate = enemy.state.backpack[i], skin = bugSkin(plate.variant, plate.id), x = -12 + i % 2 * 10, y = (i - 2) * 5;
		ctx.save(); ctx.translate(x, y); ctx.rotate((i % 2 ? 1 : -1) * .7); ctx.globalAlpha = plate.burnAt === undefined ? .9 : 1 - clamp((game.time - plate.burnAt) / CORPSE_BURN_TIME, 0, 1);
		part(ctx, sprites, skin.shell ?? skin.body, 0, .65); ctx.restore();
		if (plate.burnAt !== undefined) { ctx.fillStyle = "#efab5d"; ctx.fillRect(x, y - 4 + Math.sin(game.time * 20 + i) * 2, 3, 5); }
	}
	ctx.restore();
}
