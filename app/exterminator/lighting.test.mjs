import { expect, test } from "bun:test";
import { chooseHive, clearCombat, FIELD, newGame, openWorkshop, openShop, purchaseService, start, step, workshopServices } from "./game";
import { CORNER_LIGHTS, cornerStrength, lightAt, LIT_THRESHOLD, warningLit } from "./lighting";
import { createBug } from "./bugs";
import { viewFromGame } from "./runtime";
import { render } from "./renderer";

const idle = { move: { x: 0, y: 0 }, aim: { x: 1, y: 0 }, fire: false };
function shop(money = 2000) { const game = newGame(47); start(game); openWorkshop(game); openShop(game); game.money = money; return game; }
function addBug(game, variant, x = 790, y = 360) {
	const enemy = createBug({ variant, id: game.nextId++, position: { x, y }, player: game.player, threat: 1, wave: 1, time: game.time, bounds: FIELD });
	game.enemies.push(enemy); return enemy;
}

test("aim controls the floodlight; rear lights are weaker/shorter, shadow fades to total darkness", () => {
	const game = newGame(); game.player.angle = 0;
	expect(lightAt(game, 790, 360)).toBeGreaterThan(.8);
	expect(lightAt(game, 460, 360)).toBeGreaterThan(LIT_THRESHOLD);
	expect(lightAt(game, 460, 360)).toBeLessThan(lightAt(game, 660, 360));
	const shadow = lightAt(game, 890, 360); expect(shadow).toBeGreaterThan(0); expect(shadow).toBeLessThan(LIT_THRESHOLD);
	expect(lightAt(game, 20, 20)).toBe(0); expect(lightAt(game, game.player.x, game.player.y)).toBeGreaterThan(.8);
	const source = { x: 790, y: 360 }; expect(warningLit(game, source)).toBe(true);
	game.player.moveAngle = Math.PI; expect(warningLit(game, source)).toBe(true);
	game.player.angle = Math.PI; expect(warningLit(game, source)).toBe(false);
	game.player.angle = 0; expect(warningLit(game, source)).toBe(true);
	source.x = 1000; expect(warningLit(game, source)).toBe(false);
});

test("each permanent corner casts a rounded pool; four corners leave the centre dark", () => {
	const game = newGame(); game.player.x = 20; game.player.y = 20; game.player.angle = Math.PI;
	const samples = [[200, 160], [920, 160], [200, 560], [920, 560]];
	for (let i = 0; i < CORNER_LIGHTS.length; i++) {
		for (const corner of CORNER_LIGHTS) game.parts.cornerLights[corner.id] = false;
		game.parts.cornerLights[CORNER_LIGHTS[i].id] = true;
		for (let j = 0; j < samples.length; j++) expect(warningLit(game, { x: samples[j][0], y: samples[j][1] })).toBe(i === j);
	}
	for (const corner of CORNER_LIGHTS) game.parts.cornerLights[corner.id] = true;
	for (const point of [[510, 310], [560, 360], [610, 410]]) expect(lightAt(game, ...point)).toBe(0);
	for (const corner of CORNER_LIGHTS) {
		const x = corner.right ? FIELD.width - 16 : 16, y = corner.bottom ? FIELD.height - 16 : 16;
		const sx = corner.right ? -1 : 1, sy = corner.bottom ? -1 : 1;
		// Equal elliptical radii share a smooth edge along the axes and diagonal.
		const strength = t => cornerStrength(corner, x + sx * FIELD.width * .54 * t, y);
		expect(strength(.75)).toBeCloseTo(.9); expect(strength(1)).toBe(0);
		expect(strength(.85)).toBeGreaterThan(strength(.95));
		expect(cornerStrength(corner, x + sx * FIELD.width * .54 * .9 / Math.SQRT2, y + sy * FIELD.height * .54 * .9 / Math.SQRT2)).toBeCloseTo(strength(.9));
	}
});

test("light purchases enforce funds, rank caps, one purchase per corner, and distinct menu shortcuts", () => {
	const game = shop(29), original = JSON.stringify(game.parts);
	purchaseService(game, "northWest"); purchaseService(game, "lights"); expect(JSON.stringify(game.parts)).toBe(original); expect(game.money).toBe(29);
	game.money = 2000;
	for (const price of [200, 320, 510]) {
		const choice = workshopServices(game).find(c => c.id === "lights"); expect(choice.cost).toBe(price);
		const before = game.money; purchaseService(game, "lights"); expect(game.money).toBe(before - price);
	}
	const capped = game.money; purchaseService(game, "lights"); expect(game.money).toBe(capped); expect(game.parts.lights).toBe(3);
	for (const corner of CORNER_LIGHTS) {
		const before = game.money; purchaseService(game, corner.id); expect(game.money).toBe(before - 30);
		purchaseService(game, corner.id); expect(game.money).toBe(before - 30); expect(workshopServices(game).some(c => c.id === corner.id)).toBe(false);
	}
	const fresh = shop(); const keys = viewFromGame(fresh).choices.map(c => c.key); expect(new Set(keys).size).toBe(keys.length);
	for (const mode of ["ready", "playing", "paused", "base", "workshop", "dead"]) { fresh.mode = mode; const before = JSON.stringify(fresh); purchaseService(fresh, "lights"); purchaseService(fresh, "northWest"); expect(JSON.stringify(fresh)).toBe(before); }
});

test("lighting upgrades extend coverage modestly and survive deployment/cleanup; new runs reset purchases", () => {
	const game = shop(), source = { x: 875, y: 360 }; game.player.angle = 0;
	expect(warningLit(game, source)).toBe(false); purchaseService(game, "lights"); purchaseService(game, "lights"); purchaseService(game, "lights");
	expect(warningLit(game, source)).toBe(true); purchaseService(game, "southEast");
	const purchased = globalThis.structuredClone(game.parts); game.mode = "base"; chooseHive(game, game.hives[0].id); clearCombat(game);
	expect(game.parts).toEqual(purchased); expect(viewFromGame(game).cornerLights.southEast).toBe(true);
	const fresh = newGame(); expect(fresh.parts.lights).toBe(0); expect(Object.values(fresh.parts.cornerLights).some(Boolean)).toBe(false);
});

test("light purchases and aim visibility never change bug simulation or targeting", () => {
	const dark = newGame(47); start(dark); chooseHive(dark, dark.hives[0].id); dark.toSpawn = 1; dark.spawnTimer = 1000;
	for (const [i, variant] of ["lunger", "dragonfly", "spitter", "beetle", "bolasSpider"].entries()) addBug(dark, variant, 850 + i * 30, 200 + i * 60);
	const lit = globalThis.structuredClone(dark); lit.parts.lights = 3; for (const corner of CORNER_LIGHTS) lit.parts.cornerLights[corner.id] = true;
	for (let i = 0; i < 360; i++) { step(dark, idle, 1 / 120); step(lit, idle, 1 / 120); }
	lit.parts = globalThis.structuredClone(dark.parts); expect(lit).toEqual(dark);
});

test("all directed warnings disappear and reappear immediately with source illumination", () => {
	const game = newGame(); game.mode = "paused"; game.player.angle = 0;
	const strokes = [], target = { globalAlpha: 1, stroke: () => strokes.push(target.strokeStyle) };
	const ctx = new Proxy(target, { get: (obj, key) => key in obj ? obj[key] : () => {} });
	const sprites = new Proxy({}, { get: (_, key) => key });
	const warnings = [
		["lunger", "#ed9a6e", { phase: "windup", direction: Math.PI, remaining: .5 }],
		["spitter", "#bce36388", { phase: "windup", target: game.player, remaining: .5 }],
		["bulletAnt", "#bce36388", { phase: "windup", target: game.player, remaining: .5 }],
		["dragonfly", "#8fd6d1", { phase: "windup", target: game.player, remaining: .5 }],
		["bombardier", "#f2b264", { phase: "windup", direction: Math.PI, remaining: .5 }],
		["bolasSpider", "#e0d8b2aa", { phase: "windup", target: game.player, remaining: .5 }],
	];
	for (const [variant, color, state] of warnings) {
		game.enemies = []; const enemy = addBug(game, variant); Object.assign(enemy.state, state);
		for (const [angle, expected] of [[0, true], [Math.PI, false], [0, true]]) { game.player.angle = angle; strokes.length = 0; render(ctx, game, sprites, 1120, 720, 1); expect(strokes.includes(color)).toBe(expected); }
	}
	game.enemies = []; game.spawns = [{ id: 99, x: 790, y: 360, variant: "burrower", remaining: .6 }];
	game.lobs = [{ id: 100, x: 790, y: 360, target: game.player, age: .5 }];
	for (const [angle, expected] of [[0, true], [Math.PI, false], [0, true]]) { game.player.angle = angle; strokes.length = 0; render(ctx, game, sprites, 1120, 720, 1); expect(strokes.includes("#efaa76")).toBe(expected); expect(strokes.includes("#f2c480")).toBe(expected); }
});

test("landing warnings track the living thrower rather than a lit target, including corner illumination", () => {
	const game = newGame(); game.mode = "paused"; game.player.angle = 0;
	const beetle = addBug(game, "beetle", 100, 100);
	game.lobs = [{ id: 50, owner: beetle.id, x: beetle.x, y: beetle.y, target: game.player, age: .5 }];
	let shown = false;
	const target = { globalAlpha: 1, stroke: () => { if (target.strokeStyle === "#f2c480") shown = true; } };
	const ctx = new Proxy(target, { get: (obj, key) => key in obj ? obj[key] : () => {} });
	const sprites = new Proxy({}, { get: (_, key) => key });
	const check = expected => { shown = false; render(ctx, game, sprites, 1120, 720, 1); expect(shown).toBe(expected); };
	check(false); game.parts.cornerLights.northWest = true; check(true);
	game.parts.cornerLights.northWest = false; beetle.x = 790; beetle.y = 360; check(true);
	beetle.health = 0; check(false);
});

test("cached light shapes are reused for movement and aiming and rebuilt only for rank changes", async () => {
	const { createLightingLayer } = await import("./lighting-renderer");
	let uploads = 0;
	const context = new Proxy({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData: () => uploads++ }, { get: (obj, key) => key in obj ? obj[key] : () => {} });
	const layer = createLightingLayer(() => ({ width: 0, height: 0, getContext: () => context })), game = newGame();
	const mask = layer(game), first = uploads; expect(first).toBe(8);
	game.player.x += 40; game.player.angle += 1; game.parts.cornerLights.southEast = true;
	expect(layer(game)).toBe(mask); expect(uploads).toBe(first);
	game.parts.lights = 1; layer(game); expect(uploads).toBe(first + 3);
	layer(game); expect(uploads).toBe(first + 3);
	layer(newGame()); expect(uploads).toBe(first + 6);
});
