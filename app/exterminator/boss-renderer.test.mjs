import { expect, test } from "bun:test";
import { drawBossFight } from "./boss-renderer";
import { createBoss } from "./bosses";
import { newGame } from "./game";
import { BOSS_TYPES } from "./boss-types";
function ctx() {
	const calls = { arcs: 0, images: 0, strokes: 0 };
	const context = new Proxy({ globalAlpha: 1, arc: () => calls.arcs++, strokeRect: () => calls.strokes++, drawImage: () => calls.images++ }, { get: (target, key) => key in target ? target[key] : () => {} });
	return { context, calls };
}
const sprites = new Proxy({}, { get: (_, id) => id });

test("boss warnings continuously require a lit source, including locked sting targets and pulses", () => {
	for (const [variant, phase] of [["rhinoceros", "chargeWindup"], ["scorpion", "stingWindup"], ["millipede", "coilWindup"]]) {
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
		const recorder = ctx(); drawBossFight(recorder.context, game, sprites); expect(recorder.calls.images).toBeGreaterThan(8); expect(recorder.calls.arcs).toBe(0);
	}
});
