import { expect, test } from "bun:test";
import { drawRig } from "./rig-renderer";
import { drawBossFight } from "./boss-renderer";
import { createBoss } from "./bosses";
import { newGame } from "./game";
import { BOSS_TYPES } from "./boss-types";
function ctx() {
	const calls = { arcs: 0, images: 0, strokes: 0 };
	const context = new Proxy({ globalAlpha: 1, arc: () => calls.arcs++, stroke: () => calls.strokes++, strokeRect: () => calls.strokes++, drawImage: () => calls.images++ }, { get: (target, key) => key in target ? target[key] : () => {} });
	return { context, calls };
}
const sprites = new Proxy({}, { get: (_, id) => id });

test("boss warnings continuously require a lit source, including locked sting targets and emerging body sections", () => {
	for (const [variant, phase] of [["rhinoceros", "chargeWindup"], ["scorpion", "stingWindup"], ["millipede", "emerge"], ["millipede", "crossingWindup"]]) {
		const game = newGame(); game.player.angle = 0; game.boss = createBoss(variant, 4, game.player); game.boss.phase = phase;
		game.boss.x = game.player.x + 130; game.boss.y = game.player.y; game.boss.target = { x: game.player.x, y: game.player.y };
		const lit = ctx(); drawBossFight(lit.context, game, sprites); expect(lit.calls.arcs + lit.calls.strokes).toBeGreaterThan(0); expect(lit.calls.images).toBeGreaterThan(0);
		game.lightCover.front = 4; game.lightCover.rearLeft = 4; game.lightCover.rearRight = 4;
		const dark = ctx(); drawBossFight(dark.context, game, sprites); expect(dark.calls.arcs + dark.calls.strokes).toBe(0); expect(dark.calls.images).toBeGreaterThan(0); // Final world mask hides the body.
		game.lightCover.front = 0; const restored = ctx(); drawBossFight(restored.context, game, sprites); expect(restored.calls.arcs + restored.calls.strokes).toBeGreaterThan(0);
	}
});

test("all boss rigs draw during life and death without creating per-frame sprite assets", () => {
	for (const variant of BOSS_TYPES) {
		const game = newGame(); game.boss = createBoss(variant, 4, game.player); game.boss.health = 0; game.boss.diedAt = 1; game.time = 1.15;
		const recorder = ctx(); drawBossFight(recorder.context, game, sprites); expect(recorder.calls.images).toBeGreaterThan(0); expect(recorder.calls.arcs).toBe(0);
	}
});


test("reused rig draws skip hidden parts and restore them without retaining a previous skin", () => {
	const rig = [{ id: "root", x: 0, y: 0, slot: "body", layer: 0 }];
	const recorder = ctx();
	drawRig(recorder.context, sprites, rig, { body: "bossRhinoBody" }, { root: { opacity: 0 } }, 0, 0);
	drawRig(recorder.context, sprites, rig, { body: "bossScorpionBody" }, { root: { scaleY: 0 } }, 0, 0);
	drawRig(recorder.context, sprites, rig, {}, {}, 0, 0);
	expect(recorder.calls.images).toBe(0);
	drawRig(recorder.context, sprites, rig, { body: "bossMillipedeBody" }, {}, 0, 0);
	expect(recorder.calls.images).toBe(1);
});

test("vulnerability rings draw above articulated artwork so legs cannot obscure weak points", () => {
	const game = newGame(); game.boss = createBoss("scorpion", 4, game.player); game.boss.phase = "embedded";
	game.player.angle = 0; game.boss.x = game.player.x + 100; game.boss.y = game.player.y;
	const events = [], context = new Proxy({ globalAlpha: 1, drawImage: () => events.push("art"), stroke: () => events.push("ring") }, { get: (target, key) => key in target ? target[key] : () => {} });
	drawBossFight(context, game, sprites);
	expect(events.lastIndexOf("ring")).toBeGreaterThan(events.lastIndexOf("art"));
});


test("wind-ups do not draw circular charging meters around bosses", () => {
	for (const [variant, phase] of [["rhinoceros", "chargeWindup"], ["rhinoceros", "sweepWindup"], ["scorpion", "clawWindup"], ["scorpion", "stingWindup"], ["millipede", "crossingWindup"]]) {
		const game = newGame(); game.boss = createBoss(variant, 4, game.player); game.player.angle = 0;
		Object.assign(game.boss, { x: game.player.x + 100, y: game.player.y, phase, remaining: .4 });
		const arcs = [], context = new Proxy({ globalAlpha: 1, arc: (...args) => arcs.push(args) }, { get: (target, key) => key in target ? target[key] : () => {} });
		drawBossFight(context, game, sprites); expect(arcs.some(([, , radius]) => radius === 54)).toBe(false);
	}
});

test("millipede rampages have no vulnerability rings; the close swipe footprint follows source lighting", () => {
	const game = newGame(); game.boss = createBoss("millipede", 4, game.player);
	Object.assign(game.boss, { x: game.player.x + 100, y: game.player.y, phase: "crossing" }); game.player.angle = 0;
	const invulnerable = ctx(); drawBossFight(invulnerable.context, game, sprites); expect(invulnerable.calls.arcs).toBe(0);
	game.boss.phase = "sweepWindup"; const warning = ctx(); drawBossFight(warning.context, game, sprites); expect(warning.calls.arcs).toBe(1);
	game.lightCover.front = 4; game.lightCover.rearLeft = 4; game.lightCover.rearRight = 4;
	const hidden = ctx(); drawBossFight(hidden.context, game, sprites); expect(hidden.calls.arcs).toBe(0);
});
