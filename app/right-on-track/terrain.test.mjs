import { expect, test } from "bun:test";
import { terrainHeight, terrainPitch } from "./terrain.ts";
import { encounterAt } from "./scenery-schedule.ts";
import { railwayHeight, BRIDGE_HEIGHT } from "./motion.ts";
import { createDebugPreview } from "./debug.ts";
import { concertsAhead } from "./concert.ts";
import { flourishesAhead } from "./flourishes.ts";
import { yardsAhead } from "./yard.ts";
import { phaseAt } from "./rhythm.ts";

test("rolling ground is bounded, gently graded and continuous at every recycled region", () => {
	let low = Infinity, high = -Infinity;
	for (let d = 0; d < 5000; d += 2) {
		const h = terrainHeight(12, d); low = Math.min(low, h); high = Math.max(high, h);
		expect(Math.abs(h)).toBeLessThan(4);
		expect(Math.abs(terrainPitch(12, d))).toBeLessThan(0.15);
	}
	expect(high - low).toBeGreaterThan(3);
	for (let d = 220; d < 5000; d += 220) expect(Math.abs(terrainHeight(12, d + 0.001) - terrainHeight(12, d - 0.001))).toBeLessThan(0.001);
	const old = terrainHeight(12, 310);
	terrainHeight(4, 12000); terrainHeight(12, 12000);
	expect(terrainHeight(12, 310)).toBe(old);
});

test("fields occupy gentle planar slopes with their surrounding forest", () => {
	const p = createDebugPreview("corn"), event = encounterAt(p.run.seed, 0);
	const h = terrainHeight(p.run.seed, event.distance), slope = Math.tan(terrainPitch(p.run.seed, event.distance));
	expect(Math.abs(h)).toBeGreaterThan(0.1);
	for (const z of [-16, -8, 0, 8, 16]) expect(terrainHeight(p.run.seed, event.distance + z)).toBeCloseTo(h + slope * z, 5);
});

test("crossings and rivers remain level and bridge ramps retain their clearance", () => {
	for (const id of ["crossing-cars", "river-cargo"]) {
		const p = createDebugPreview(id), event = encounterAt(p.run.seed, 0);
		for (let offset = -10; offset <= 10; offset++) expect(terrainHeight(p.run.seed, event.distance + offset)).toBe(0);
		if (event.kind === "river") expect(railwayHeight(p.run.seed, event.distance)).toBe(BRIDGE_HEIGHT);
	}
});

test("large special landmarks and crane handoff stay on level plots", () => {
	for (const id of ["concert", "fairground", "quarry", "yard"]) {
		const p = createDebugPreview(id), phase = phaseAt(p.run.seconds);
		const event = id === "concert" ? concertsAhead(p.run, phase)[0] : id === "yard" ? yardsAhead(p.run, phase)[0] : flourishesAhead(p.run, phase)[0];
		for (const offset of [-50, 0, 50]) expect(terrainHeight(p.run.seed, event.distance + offset)).toBe(0);
	}
});
