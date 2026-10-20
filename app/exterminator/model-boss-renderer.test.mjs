import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import sheets from "./boss-sheets.json";
import { createBoss } from "./bosses";
import { modelBossPose, modelTailNodes, drawModelBoss } from "./model-boss-renderer";

const boss = (variant = "scorpion") => createBoss(variant, 4, { x: 560, y: 360 });

test("directional model sheets include every pose and valid cropped frames for all 16 directions", () => {
	for (const [variant, sheet] of Object.entries(sheets)) {
		for (const suffix of ["", "-hit"]) {
			const file = readFileSync(`public/images/exterminator/bosses/${variant}${suffix}.png`);
			expect(file.subarray(1, 4).toString()).toBe("PNG"); expect(file.readUInt32BE(16)).toBe(sheet.width); expect(file.readUInt32BE(20)).toBe(sheet.height);
		}
		expect(sheet.directions).toBe(16);
		expect(Object.keys(sheet.frames)).toHaveLength(variant === "rhinoceros" ? 8 : 16);
		for (const frames of Object.values(sheet.frames)) {
			expect(frames).toHaveLength(16);
			for (const frame of frames) {
				expect(frame.w).toBeGreaterThan(0); expect(frame.h).toBeGreaterThan(0); expect(frame.x).toBeGreaterThanOrEqual(0); expect(frame.y).toBeGreaterThanOrEqual(0);
				expect(frame.x + frame.w).toBeLessThanOrEqual(sheet.width); expect(frame.y + frame.h).toBeLessThanOrEqual(sheet.height);
				expect(Number.isFinite(frame.dx + frame.dy)).toBe(true);
			}
		}
	}
});

test("model poses select walking, horn attacks and only the active scorpion claw", () => {
	const rhino = boss("rhinoceros"); rhino.angle = -.01; expect(modelBossPose(rhino, 0).direction).toBe(0);
	for (let i = 0; i < 16; i++) { rhino.angle = i * Math.PI / 8; expect(modelBossPose(rhino, 0).direction).toBe(i); }
	for (const [phase, row] of [["sweepWindup", "windup"], ["sweep", "sweep"], ["lift", "lift"], ["charge", "charge"]]) { rhino.phase = phase; expect(modelBossPose(rhino, 0).row).toBe(row); }
	rhino.phase = "approach"; const rows = new Set(); for (let i = 0; i < 4; i++) rows.add(modelBossPose(rhino, i * Math.PI / 2).row); expect(rows.size).toBe(4);
	const scorpion = boss(); scorpion.phase = "clawWindup"; scorpion.attackIndex = 1;
	expect(modelBossPose(scorpion, 0).claws).toEqual(["clawL1", "clawR0"]);
	scorpion.phase = "claw"; scorpion.attackIndex = 2; expect(modelBossPose(scorpion, 0).claws).toEqual(["clawL0", "clawR2"]);
});

test("scorpion tail starts attached, interpolates continuously, reaches the locked target and stays finite", () => {
	const scorpion = boss(); scorpion.target = { x: 830, y: 225 };
	for (let direction = 0; direction < 16; direction++) {
		scorpion.phase = "approach"; const rest = modelTailNodes(scorpion, direction); expect(rest.posed).toBe(rest.rest); expect(rest.rest).toHaveLength(7);
		scorpion.phase = "stingWindup"; scorpion.remaining = 1.15; expect(modelTailNodes(scorpion, direction).posed).toBe(rest.rest);
		scorpion.remaining = .575; const halfway = modelTailNodes(scorpion, direction).posed;
		scorpion.phase = "embedded"; const strike = modelTailNodes(scorpion, direction).posed;
		expect(strike[0]).toEqual(rest.rest[0]); expect(strike.at(-1).x + scorpion.x).toBeCloseTo(scorpion.target.x); expect(strike.at(-1).y + scorpion.y).toBeCloseTo(scorpion.target.y);
		for (let i = 0; i < 7; i++) { expect(halfway[i].x).toBeCloseTo((rest.rest[i].x + strike[i].x) / 2); expect(halfway[i].y).toBeCloseTo((rest.rest[i].y + strike[i].y) / 2); }
	}
});

test("model draws use cropped sheet art, remove destroyed claws and never apply live filters", () => {
	const draws = [], filters = [], sprites = { bossRhinoSheet: "rhino", bossScorpionSheet: "scorpion" };
	const ctx = new Proxy({ globalAlpha: 1, drawImage: (...args) => draws.push(args) }, { get: (t, k) => k in t ? t[k] : () => {}, set: (t, k, v) => { if (k === "filter") filters.push(v); t[k] = v; return true; } });
	expect(drawModelBoss(ctx, sprites, boss("rhinoceros"), 0)).toBe(true); expect(draws).toHaveLength(1); expect(draws[0]).toHaveLength(9);
	const scorpion = boss(); draws.length = 0; drawModelBoss(ctx, sprites, scorpion, 0); expect(draws).toHaveLength(9);
	scorpion.claws[0] = 0; draws.length = 0; drawModelBoss(ctx, sprites, scorpion, 0); expect(draws).toHaveLength(8);
	scorpion.claws[1] = 0; draws.length = 0; drawModelBoss(ctx, sprites, scorpion, 0); expect(draws).toHaveLength(7); expect(filters).toHaveLength(0);
	expect(drawModelBoss(ctx, sprites, boss("millipede"), 0)).toBe(false);
});
