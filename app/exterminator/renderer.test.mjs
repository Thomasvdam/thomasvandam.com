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

test("cached slime retains connected coverage, uses the newest overlapping deposit, and expires independently", async () => {
	const { createSlimeLayer } = await import("./slime-renderer");
	let image, uploads = 0;
	const canvas = { width: 0, height: 0, getContext: () => ({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData: data => { image = data; uploads++; } }) };
	const layer = createSlimeLayer(() => canvas), game = newGame();
	const alpha = (x, y) => image.data[(Math.floor(y / 2) * canvas.width + Math.floor(x / 2)) * 4 + 3];
	const old = { x: 100, y: 100, end: { x: 160, y: 100 }, bornAt: 0 };
	game.slime = [old]; expect(layer(game)).toBe(canvas); expect(alpha(130, 100)).toBeGreaterThan(0); expect(alpha(130, 140)).toBe(0);
	const first = uploads; game.player.x += 100; layer(game); expect(uploads).toBe(first);
	game.time = 10; const fresh = { x: 120, y: 100, end: { x: 200, y: 100 }, bornAt: 10 }; game.slime.push(fresh); layer(game);
	expect(alpha(130, 100)).toBe(alpha(190, 100)); expect(alpha(100, 100)).toBeLessThan(alpha(130, 100));
	game.time = 15; game.slime = [fresh]; layer(game); expect(alpha(100, 100)).toBe(0); expect(alpha(130, 100)).toBeGreaterThan(0);
	game.time = 25; game.slime = []; layer(game); expect(alpha(130, 100)).toBe(0);
});

test("cached slime clears a replaced wave and a restarted clock without leaving old patches", async () => {
	const { createSlimeLayer } = await import("./slime-renderer");
	let image;
	const canvas = { width: 0, height: 0, getContext: () => ({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData: data => { image = data; } }) };
	const layer = createSlimeLayer(() => canvas), game = newGame();
	const alpha = (x, y) => image.data[(Math.floor(y / 2) * canvas.width + Math.floor(x / 2)) * 4 + 3];
	game.time = 2; game.slime = [{ x: 100, y: 100, end: { x: 120, y: 100 }, bornAt: 2 }]; layer(game); expect(alpha(110, 100)).toBeGreaterThan(0);
	game.slime = [{ x: 400, y: 400, end: { x: 420, y: 400 }, bornAt: 2 }]; layer(game);
	expect(alpha(110, 100)).toBe(0); expect(alpha(410, 400)).toBeGreaterThan(0);
	game.time = 0; game.slime = []; layer(game); expect(alpha(410, 400)).toBe(0);
});
