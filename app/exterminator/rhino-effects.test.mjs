import { expect, test } from "bun:test";
import { createBoss } from "./bosses";
import { newGame } from "./game";
import { drawBossFight } from "./boss-renderer";
import { modelBossPose } from "./model-boss-renderer";
import { drawRhinoRocks, rockFallHeight, ROCK_FALL_TIME } from "./rhino-rocks-renderer";

function recorder() {
	const arcs = [], lines = [], translations = [], fills = [], polygons = [];
	const ctx = new Proxy({ globalAlpha: 1, arc: (...v) => arcs.push(v), lineTo: (...v) => lines.push(v), translate: (...v) => translations.push(v), fillRect: (...v) => fills.push(v), moveTo: (...v) => polygons.push(v) }, { get: (t, k) => k in t ? t[k] : () => {} });
	return { ctx, arcs, lines, translations, fills, polygons };
}
test("rhino vulnerability uses opening shell poses without green-circle overlays or a get-up cone", () => {
	const game = newGame(), sprites = new Proxy({}, { get: (_, key) => key });
	game.boss = createBoss("rhinoceros", 4, game.player); Object.assign(game.boss, { x: 650, y: 360, angle: 0, remaining: 1 });
	game.player.angle = 0;
	for (const phase of ["stuck", "dazed", "rising"]) {
		game.boss.phase = phase; const pose = modelBossPose(game.boss, 1); expect(pose.row.startsWith("open")).toBe(true);
		const r = recorder(); drawBossFight(r.ctx, game, sprites); expect(r.arcs).toHaveLength(0); expect(r.lines).toHaveLength(phase === "rising" ? 0 : 6);
	}
	game.boss.phase = "sweep"; const r = recorder(); drawBossFight(r.ctx, game, sprites); expect(r.arcs.some(v => v[2] === 150)).toBe(true);
});

test("rocks retain landing warnings while the boulder drops only during the final 220ms, then throws impact debris", () => {
	const game = newGame(); game.player.angle = 0; game.boss = createBoss("rhinoceros", 4, game.player); game.time = 5;
	const rock = { id: 1, x: 650, y: 360, remaining: 1, health: 6, hitAt: -10, landedAt: -10 }; game.boss.rhino.rocks.push(rock);
	let r = recorder(); drawRhinoRocks(r.ctx, game); expect(r.arcs.some(v => v[2] === 54)).toBe(true); expect(r.translations).toHaveLength(0);
	rock.remaining = ROCK_FALL_TIME / 2; r = recorder(); drawRhinoRocks(r.ctx, game); expect(r.translations).toContainEqual([650, 360 - rockFallHeight(rock.remaining)]);
	expect(rockFallHeight(ROCK_FALL_TIME)).toBe(400); expect(rockFallHeight(0)).toBe(0);
	const earlyTravel = rockFallHeight(ROCK_FALL_TIME) - rockFallHeight(ROCK_FALL_TIME * .75), lateTravel = rockFallHeight(ROCK_FALL_TIME * .25) - rockFallHeight(0); expect(lateTravel).toBeGreaterThan(earlyTravel * 3);
	rock.remaining = 0; rock.landedAt = 4.95; r = recorder(); drawRhinoRocks(r.ctx, game); expect(r.fills.length).toBe(8);
	expect(rock.health).toBe(6); expect(rock.landedAt).toBe(4.95); // Rendering cannot alter collision/damage timing.
});
