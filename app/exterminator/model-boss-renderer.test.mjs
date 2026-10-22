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
		expect(Object.keys(sheet.frames)).toHaveLength(variant === "rhinoceros" ? 26 : 25);
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
	for (const [phase, row] of [["sweep", "headSweep"], ["lift", "headLift"], ["charge", "headCharge"]]) { rhino.phase = phase; expect(modelBossPose(rhino, 0).head).toBe(row); }
	rhino.phase = "approach"; const rows = new Set(); for (let i = 0; i < 4; i++) rows.add(modelBossPose(rhino, i * Math.PI / 2).row); expect(rows.size).toBe(4);
	const scorpion = boss(); scorpion.phase = "clawWindup"; scorpion.attackIndex = 1; scorpion.remaining = .3;
	expect(modelBossPose(scorpion, 0).claws).toEqual(["clawLTell2", "clawR0"]);
	scorpion.phase = "claw"; scorpion.attackIndex = 2; expect(modelBossPose(scorpion, 0).claws).toEqual(["clawL0", "clawR2"]);
});

test("scorpion tail starts attached, interpolates continuously, reaches the locked target and stays finite", () => {
	const scorpion = boss(); scorpion.target = { x: 830, y: 225 };
	for (let direction = 0; direction < 16; direction++) {
		scorpion.phase = "approach"; const rest = modelTailNodes(scorpion, direction); expect(rest.posed).toBe(rest.rest); expect(rest.rest).toHaveLength(7);
		scorpion.phase = "stingWindup"; scorpion.remaining = 1.15; expect(modelTailNodes(scorpion, direction).posed).toBe(rest.rest);
		scorpion.remaining = .575; const coiled = modelTailNodes(scorpion, direction).posed;
		scorpion.phase = "embedded"; const strike = modelTailNodes(scorpion, direction).posed;
		expect(strike[0]).toEqual(rest.rest[0]); expect(strike.at(-1).x + scorpion.x).toBeCloseTo(scorpion.target.x); expect(strike.at(-1).y + scorpion.y).toBeCloseTo(scorpion.target.y);
		expect(coiled[0]).toEqual(rest.rest[0]); expect(coiled.at(-1).y).toBeLessThan(rest.rest.at(-1).y);
		for (let i = 0; i < 7; i++) expect(Number.isFinite(coiled[i].x + coiled[i].y)).toBe(true);
	}
});

test("model draws use cropped sheet art, remove destroyed claws and never apply live filters", () => {
	const draws = [], filters = [], sprites = { bossRhinoSheet: "rhino", bossScorpionSheet: "scorpion" };
	const ctx = new Proxy({ globalAlpha: 1, drawImage: (...args) => draws.push(args) }, { get: (t, k) => k in t ? t[k] : () => {}, set: (t, k, v) => { if (k === "filter") filters.push(v); t[k] = v; return true; } });
	expect(drawModelBoss(ctx, sprites, boss("rhinoceros"), 0)).toBe(true); expect(draws).toHaveLength(2); expect(draws[0]).toHaveLength(9);
	const scorpion = boss(); draws.length = 0; drawModelBoss(ctx, sprites, scorpion, 0); expect(draws).toHaveLength(9);
	scorpion.claws[0] = 0; draws.length = 0; drawModelBoss(ctx, sprites, scorpion, 0); expect(draws).toHaveLength(8);
	scorpion.claws[1] = 0; draws.length = 0; drawModelBoss(ctx, sprites, scorpion, 0); expect(draws).toHaveLength(7); expect(filters).toHaveLength(0);
	expect(drawModelBoss(ctx, sprites, boss("millipede"), 0)).toBe(false);
});

test("model wind-ups progress through distinct authored poses before the strike", () => {
	const rhino = boss("rhinoceros");
	for (const [phase, duration, prefix] of [["chargeWindup", 1.1, "charge"], ["sweepWindup", .9, "sweep"], ["liftWindup", .85, "lift"]]) {
		rhino.phase = phase; const heads = new Set(), bodies = new Set();
		for (const progress of [0, .3, .6, .9]) {
			rhino.remaining = duration * (1 - progress); const pose = modelBossPose(rhino, 0);
			heads.add(pose.head); bodies.add(pose.row); expect(pose.head.startsWith(prefix)).toBe(true);
		}
		expect(heads.size).toBe(4); expect(bodies.size).toBe(3);
	}
	const scorpion = boss(); scorpion.phase = "clawWindup"; scorpion.comboStep = 1;
	const claws = new Set(); for (const progress of [0, .3, .6, .9]) { scorpion.remaining = .8 * (1 - progress); const pose = modelBossPose(scorpion, 0); claws.add(pose.claws[1]); expect(pose.claws[0]).toBe("clawL0"); }
	expect(claws.size).toBe(4);
	scorpion.phase = "chargeWindup"; const braces = new Set(); for (const progress of [0, .5, 1]) { scorpion.remaining = .9 * (1 - progress); braces.add(modelBossPose(scorpion, 0).row); } expect(braces.size).toBe(3);
});
