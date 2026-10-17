import { expect, test } from "bun:test";
import { createRenderer } from "./renderer";
import { newGame } from "./game";
import { BUG_RIG, resolveRig } from "./animation";
import { BUG_SKINS } from "./sprite-parts";
function context(properties = {}) { return new Proxy({ globalAlpha: 1, ...properties }, { get: (target, key) => key in target ? target[key] : () => {} }); }

test("terrain cache follows job layout, lighting parity and pixel density, while cameras reuse it", () => {
	let tilesDrawn = 0;
	const background = { width: 0, height: 0, getContext: () => context({ fillRect: () => tilesDrawn++ }) };
	const render = createRenderer(() => background), ctx = context(), sprites = new Proxy({}, { get: (_, key) => key });
	const game = newGame(47); game.mode = "playing";
	render(ctx, game, sprites, 800, 500, 1); const first = tilesDrawn; expect(first).toBeGreaterThan(0);
	game.player.x += 50; render(ctx, game, sprites, 390, 500, 1); expect(tilesDrawn).toBe(first);
	game.terrain = [...game.terrain]; render(ctx, game, sprites, 390, 500, 1); expect(tilesDrawn).toBe(first * 2);
	game.hivesCleared++; render(ctx, game, sprites, 390, 500, 1); expect(tilesDrawn).toBe(first * 3);
	render(ctx, game, sprites, 390, 500, 2); expect(tilesDrawn).toBe(first * 4); expect(background.width).toBe(2240); expect(background.height).toBe(1440);
	game.mode = "workshop"; game.terrain = [...game.terrain]; render(ctx, game, sprites, 390, 500, 2); expect(tilesDrawn).toBe(first * 4);
	game.mode = "playing"; render(ctx, game, sprites, 390, 500, 2); expect(tilesDrawn).toBe(first * 5);
});

test("compiled rigs preserve hierarchy transforms, optional parts and layer order across skins and poses", () => {
	const rig = [
		{ id: "root", x: 10, y: 20, angle: Math.PI / 2, layer: 5, slot: "body" },
		{ id: "child", parent: "root", x: 4, y: 0, layer: 0, slot: "head" },
	];
	for (const skin of [BUG_SKINS.burrower, BUG_SKINS.spitter]) {
		const parts = resolveRig(rig, skin, {}); expect(parts.map(part => part.bone)).toEqual(["child", "root"]);
		expect(parts[0].x).toBeCloseTo(10); expect(parts[0].y).toBeCloseTo(24);
		const changed = resolveRig(rig, { ...skin, head: undefined }, { root: { x: 5 } }); expect(changed).toHaveLength(1); expect(changed[0].x).toBe(15);
	}
	expect(() => resolveRig([{ id: "orphan", parent: "missing", x: 0, y: 0, layer: 0 }], {}, {})).toThrow("must precede");
	expect(resolveRig(BUG_RIG, BUG_SKINS.flyer, {}).filter(part => part.bone.startsWith("wing"))).toHaveLength(2);
});
