import { expect, test } from "bun:test";
import { bugHitSprites } from "./bug-hit-sprites";
import { BUG_TYPES, createBug } from "./bug-types";
import { FIELD, newGame } from "./game";
import { render } from "./renderer";
import { SPRITE_PARTS } from "./sprite-parts";

function fixtures() {
	const sprites = Object.fromEntries(Object.keys(SPRITE_PARTS).map(name => [name, { name }])), canvases = [];
	const makeCanvas = () => {
		const context = { filter: "none", drawImage: (...args) => { canvas.draw = args; } };
		const canvas = { width: 0, height: 0, getContext: () => context, context }; canvases.push(canvas); return canvas;
	};
	return { sprites, canvases, makeCanvas };
}
test("bug hit art is prepared once at source resolution without changing normal or boss images", () => {
	const { sprites, canvases, makeCanvas } = fixtures(), art = bugHitSprites(sprites, makeCanvas);
	const keys = Object.keys(SPRITE_PARTS).filter(key => key.startsWith("bug")); expect(canvases).toHaveLength(keys.length);
	for (const key of keys) {
		expect(art[key].width).toBe(32); expect(art[key].height).toBe(32); expect(art[key].context.filter).toBe("brightness(1.8)"); expect(art[key].draw[0]).toBe(sprites[key]);
	}
	expect(art.mechFoot).toBe(sprites.mechFoot); expect(art.bossRhinoSheet).toBe(sprites.bossRhinoSheet);
	expect(bugHitSprites(sprites, makeCanvas)).toBe(art); expect(canvases).toHaveLength(keys.length);
});

test("every species including centipede tails draws cached hit art for 80ms with no live filters", () => {
	const { sprites, makeCanvas } = fixtures(), art = bugHitSprites(sprites, makeCanvas);
	for (const variant of BUG_TYPES) {
		const game = newGame(); game.mode = "playing"; game.time = 5;
		const enemy = createBug({ variant, id: 1, position: { x: 650, y: 360 }, player: game.player, threat: 1, wave: 1, time: 0, bounds: FIELD });
		enemy.hitAt = 5; game.enemies.push(enemy);
		const filters = [], images = [];
		const ctx = new Proxy({ globalAlpha: 1, drawImage: image => images.push(image) }, { get: (target, key) => key in target ? target[key] : () => {}, set: (target, key, value) => { if (key === "filter") filters.push(value); target[key] = value; return true; } });
		for (const age of [0, .04, .079, .081, .2]) {
			game.time = 5 + age; images.length = 0; render(ctx, game, sprites, 1120, 720, 1);
			const bugImages = images.filter(image => Object.keys(SPRITE_PARTS).some(key => key.startsWith("bug") && (sprites[key] === image || art[key] === image)));
			expect(bugImages.length, variant).toBeGreaterThan(0);
			const sources = Object.values(age < .08 ? art : sprites); for (const image of bugImages) expect(sources).toContain(image);
		}
		expect(filters).toHaveLength(0);
	}
});
