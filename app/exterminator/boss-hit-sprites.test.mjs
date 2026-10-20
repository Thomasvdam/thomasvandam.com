import { expect, test } from "bun:test";
import { bossHitSprites } from "./boss-hit-sprites";
import { drawBossFight } from "./boss-renderer";
import { createBoss } from "./bosses";
import { newGame } from "./game";
import { BOSS_TYPES } from "./boss-types";
import { SPRITE_PARTS } from "./sprite-parts";

function fixtures() {
	const sprites = Object.fromEntries(Object.keys(SPRITE_PARTS).map(name => [name, { name }]));
	const canvases = [];
	const makeCanvas = () => {
		const context = { filter: "none", drawImage: (...args) => { canvas.draw = args; } };
		const canvas = { width: 0, height: 0, getContext: () => context, context };
		canvases.push(canvas); return canvas;
	};
	return { sprites, canvases, makeCanvas };
}

test("boss flashes prewarm one full-resolution image per part and reuse it across hits", () => {
	const { sprites, canvases, makeCanvas } = fixtures();
	const art = bossHitSprites(sprites, makeCanvas), parts = Object.keys(SPRITE_PARTS).filter(key => key.startsWith("boss"));
	expect(canvases).toHaveLength(parts.length);
	for (const key of parts) {
		const image = art[key], spec = SPRITE_PARTS[key];
		expect(image).not.toBe(sprites[key]); expect(image.width).toBe(spec.width * 4); expect(image.height).toBe(spec.height * 4);
		expect(image.context.filter).toBe("brightness(1.65)"); expect(image.draw[0]).toBe(sprites[key]);
	}
	expect(art.mechFoot).toBe(sprites.mechFoot);
	for (let i = 0; i < 100; i++) expect(bossHitSprites(sprites, makeCanvas)).toBe(art);
	expect(canvases).toHaveLength(parts.length);
	const other = fixtures(); expect(bossHitSprites(other.sprites, other.makeCanvas)).not.toBe(art);
});

test("all boss hit frames draw cached art without live filters, preserve timing and leave normal sprites unchanged", () => {
	const { sprites, makeCanvas } = fixtures(), art = bossHitSprites(sprites, makeCanvas);
	for (const variant of BOSS_TYPES) {
		const game = newGame(); game.time = 5; game.boss = createBoss(variant, 4, game.player); game.boss.hitAt = 5;
		const filters = [], images = [];
		const ctx = new Proxy({ globalAlpha: 1, drawImage: source => images.push(source) }, {
			get: (target, key) => key in target ? target[key] : () => {},
			set: (target, key, value) => { if (key === "filter") filters.push(value); target[key] = value; return true; },
		});
		for (const age of [0, .04, .079, .081, .2]) {
			game.time = 5 + age; images.length = 0; drawBossFight(ctx, game, sprites);
			expect(images.length).toBeGreaterThan(0);
			const expected = age < .08 ? Object.values(art) : Object.values(sprites);
			for (const image of images) expect(expected).toContain(image);
		}
		expect(filters).toHaveLength(0);
	}
});
