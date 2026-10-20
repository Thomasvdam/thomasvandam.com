import { expect, test } from "bun:test";
import { drawMillipede, prepareMillipedeSprites } from "./millipede-art";
import { drawMillipedeAcid } from "./millipede-hazards-renderer";
import { createBoss, bossCircles } from "./bosses";
import { SPRITE_PARTS } from "./sprite-parts";
import { newGame } from "./game";
import { positionMillipede } from "./millipede";
const sprites = new Proxy({}, { get: (_, id) => id });
function recorder() {
	const calls = { images: [], positions: [], scales: [], arcs: [] };
	const context = new Proxy({ globalAlpha: 1, drawImage: (...args) => calls.images.push(args), translate: (...args) => calls.positions.push(args), scale: (...args) => calls.scales.push(args), arc: (...args) => calls.arcs.push(args) }, { get: (target, key) => key in target ? target[key] : () => {} });
	return { context, calls };
}

test("millipede repeat cache bakes seven shell types and four articulated gaits once per sprite set", () => {
	const set = Object.fromEntries(Object.keys(SPRITE_PARTS).map(name => [name, name])), canvases = [];
	prepareMillipedeSprites(set, () => { const { context, calls } = recorder(); const canvas = { width: 0, height: 0, calls, getContext: () => context }; canvases.push(canvas); return canvas; });
	expect(canvases).toHaveLength(28);
	expect(new Set(canvases.flatMap(canvas => canvas.calls.images.map(args => args[0])))).toContain(set.bossMillipedeLeg);
	prepareMillipedeSprites(set, () => { throw new Error("cache rebaked during combat"); });
	const boss = createBoss("millipede", 4, { x: 560, y: 360 }), draw = recorder();
	drawMillipede(draw.context, set, boss, 0, (x, y) => x >= 0 && x <= 1120 && y >= 0 && y <= 720);
	const bodyDraws = draw.calls.images.filter(args => canvases.includes(args[0]));
	expect(bodyDraws.length).toBeGreaterThan(50); expect(bodyDraws.length).toBeLessThan(110);
	expect(bodyDraws.every(args => args.length === 5)).toBe(true);
});

test("visible section centres and rotations match body collision; hidden sections and off-camera ribbons never draw", () => {
	const boss = createBoss("millipede", 4, { x: 560, y: 360 }); boss.phase = "crossing"; boss.millipede.elapsed = 1.7;
	positionMillipede(boss); const draw = recorder();
	const visible = (x, y) => x >= 0 && x <= 390 && y >= 200 && y <= 600;
	drawMillipede(draw.context, sprites, boss, 0, visible);
	const circles = bossCircles(boss);
	for (const [x, y] of draw.calls.positions) if (visible(x, y)) expect(circles.some(circle => circle.x === x && circle.y === y)).toBe(true);
	for (const segment of boss.segments.filter(point => point.hidden)) expect(draw.calls.positions).not.toContainEqual([segment.x, segment.y]);
	expect(draw.calls.images.length).toBeLessThan(336);
});

test("bomb tell swells the mouth and each rampage previews its empty escape zone without charging meters", () => {
	const boss = createBoss("millipede", 4, { x: 560, y: 360 }); boss.phase = "bombWindup";
	const before = recorder(), after = recorder(); boss.remaining = .75; drawMillipede(before.context, sprites, boss, 0);
	boss.remaining = 0; drawMillipede(after.context, sprites, boss, 0); expect(after.calls.scales.at(-1)[0]).toBeGreaterThan(before.calls.scales.at(-1)[0]);
	boss.phase = "crossingWindup"; positionMillipede(boss); const tell = recorder(); drawMillipede(tell.context, sprites, boss, 0);
	expect(tell.calls.arcs).toHaveLength(0);
});

test("acid bomb landing warnings continuously require a lit source, while actual puddles remain world geometry", () => {
	const game = newGame(); game.player.angle = 0; game.boss = createBoss("millipede", 4, game.player);
	Object.assign(game.boss, { x: game.player.x + 100, y: game.player.y, phase: "bombWindup", target: { x: 300, y: 300 } });
	let draw = recorder(); drawMillipedeAcid(draw.context, game); expect(draw.calls.arcs).toHaveLength(1);
	game.lightCover.front = 4; game.lightCover.rearLeft = 4; game.lightCover.rearRight = 4;
	draw = recorder(); drawMillipedeAcid(draw.context, game); expect(draw.calls.arcs).toHaveLength(0);
	game.boss.millipede.pools.push({ x: 300, y: 300, bornAt: game.time }); drawMillipedeAcid(draw.context, game); expect(draw.calls.arcs.length).toBeGreaterThan(0);
});
