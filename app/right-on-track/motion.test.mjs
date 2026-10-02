import * as THREE from "three";
import { newRun } from "./rhythm.ts";
import { expect, test } from "bun:test";
import { roadsideCenter, treeOnFork, fixedBranchCenter, FORK_OFFSET, forkOffset, routeCenter, routeHeading, railwayHeight, railwayPitch, BRIDGE_HEIGHT, beatForSlot, landscapeBands, landscapeBlend, PLACEMENT_Z, sceneryOffsets, surfaceOffset, trackCenter, trackHeading, trackPosition, encounterAt, approachCar, waterScene, treeOnFeature, mountainOffset, SCENERY_LENGTH, TRACK_LENGTH } from "./motion.ts";

test("visible trees move continuously across scenery wrap boundaries", () => {
	const positions = (distance) => sceneryOffsets(distance).flatMap(offset =>
		Array.from({ length: 60 }, (_, i) => offset - i * 13 % 220))
		.filter(z => z > -170.4 && z < 35.4).sort((a, b) => a - b);
	for (const boundary of [26, 220, 440, 2200]) {
		const before = positions(boundary - 0.01);
		const after = positions(boundary + 0.01);
		expect(after.length).toBe(before.length);
		before.forEach((position, index) => expect(after[index] - position).toBeCloseTo(0.02, 8));
	}
});

test("track models keep their beat when crossing integer beats", () => {
	for (let first = -5; first < 100; first++) {
		const beats = Array.from({ length: 30 }, (_, slot) => beatForSlot(slot, first, 30));
		expect(new Set(beats).size).toBe(30);
		for (let slot = 0; slot < 30; slot++) {
			const next = beatForSlot(slot, first + 1, 30);
			expect(next).toBe(beats[slot] === first ? first + 30 : beats[slot]);
		}
	}
});


test("landscape stretches approach the train without changing a tree's world identity", () => {
	const run = newRun(); run.seed = 0;
	const before = landscapeBands(run, 40);
	expect(landscapeBlend(before, 40)).toBe(0);
	expect(landscapeBlend(before, 52)).toBe(1);
	expect(landscapeBlend(before, 64)).toBe(0);
	for (const worldBeat of [47, 48, 49, 50, 59, 60, 61, 62]) {
		const values = [40, 44, 48, 52, 60].map(phase => {
			const z = PLACEMENT_Z - (worldBeat - phase) * TRACK_LENGTH;
			return landscapeBlend(landscapeBands(run, phase), phase + (PLACEMENT_Z - z) / TRACK_LENGTH);
		});
		values.forEach(value => expect(value).toBeCloseTo(values[0], 8));
	}
	expect(landscapeBlend(before, 48)).toBe(0);
	expect(landscapeBlend(before, 49)).toBeCloseTo(0.5);
	expect(landscapeBlend(before, 50)).toBe(1);
});

test("ground and ballast texture features travel in the same direction as the trees", () => {
	// Derive top-face UV orientation from the actual Three.js geometry.
	const geometry = new THREE.BoxGeometry(600, 1, 600);
	const positions = geometry.getAttribute("position"), normals = geometry.getAttribute("normal"), uvs = geometry.getAttribute("uv");
	const top = Array.from({ length: positions.count }, (_, index) => index).filter(index => normals.getY(index) === 1);
	const low = top.find(index => positions.getZ(index) === -300);
	const high = top.find(index => positions.getZ(index) === 300);
	const gradient = (uvs.getY(high) - uvs.getY(low)) / 600;
	for (const [repeats, length] of [[90, 600], [5, 270]]) {
		const dv = surfaceOffset(20, repeats, length) - surfaceOffset(10, repeats, length);
		const dz = -dv / (gradient * 600 / length * repeats);
		expect(dz).toBeCloseTo(10, 8);
	}
	geometry.dispose();
});


test("bends stay shallow and keep landmarks continuous as the train advances", () => {
	for (let distance = 0; distance < 4000; distance += 13) {
		expect(Math.abs(trackHeading(distance))).toBeLessThan(0.1);
		expect(Math.abs(trackPosition(distance, -30))).toBeLessThan(3);
		const worldDistance = distance + 70;
		const before = trackPosition(distance, distance - worldDistance) + trackCenter(distance);
		const after = trackPosition(distance + 0.1, distance + 0.1 - worldDistance) + trackCenter(distance + 0.1);
		expect(after).toBeCloseTo(before, 8);
		expect(Math.abs(trackHeading(distance + 6) - trackHeading(distance))).toBeLessThan(0.015);
	}
});

test("encounters are sparse, seeded, and include empty crossings and rare bear pairs", () => {
	const counts = { hut: 0, lumberjack: 0, crossing: 0, bears: 0, river: 0, empty: 0 };
	const cars = new Set();
	for (let index = 0; index < 2000; index++) {
		const encounter = encounterAt(7, index);
		expect(encounter).toEqual(encounterAt(7, index));
		counts[encounter.kind ?? "empty"]++;
		if (encounter.kind === "crossing") cars.add(encounter.cars);
		expect(encounterAt(7, index + 1).distance - encounter.distance).toBeGreaterThanOrEqual(SCENERY_LENGTH - 50);
	}
	expect([...cars].sort()).toEqual([0, 1, 2, 3]);
	expect(counts.bears).toBeGreaterThan(0);
	expect(counts.bears).toBeLessThan(70);
	expect(counts.empty).toBeGreaterThan(600);
	for (const kind of ["hut", "lumberjack", "crossing"]) expect(counts[kind]).toBeGreaterThan(250);
});

test("mountain parallax stays slow and continuous without a wrap", () => {
	for (const layer of [0, 1]) for (const distance of [0, 220, 440, 10000]) {
		const before = mountainOffset(distance - 0.01, layer), after = mountainOffset(distance + 0.01, layer);
		expect(Math.abs(after.x - before.x)).toBeLessThan(0.001);
		expect(Math.abs(after.z - before.z)).toBeLessThan(0.001);
	}
});


test("an approaching car brakes before the crossing and stays stopped", () => {
	let previous = approachCar(-1);
	for (let age = 0; age <= 12; age += 0.1) {
		const position = approachCar(age);
		expect(position).toBeGreaterThanOrEqual(previous);
		expect(position).toBeLessThanOrEqual(-10);
		previous = position;
	}
	expect(approachCar(7)).toBe(-10); expect(approachCar(100)).toBe(-10);
});

test("rivers vary their decorations, with Ness much rarer than boats and birds", () => {
	const counts = new Map(); let rivers = 0, traffic = 0;
	for (let i = 0; i < 5000; i++) {
		const encounter = encounterAt(11, i);
		if (encounter.kind === "river") { rivers++; const kind = waterScene(encounter.detail); counts.set(kind, (counts.get(kind) ?? 0) + 1); }
		if (encounter.kind === "crossing" && encounter.traffic) traffic++;
	}
	expect(rivers).toBeGreaterThan(250); expect(rivers).toBeLessThan(600);
	expect(counts.size).toBe(7); expect(counts.get("ness")).toBeGreaterThan(0); expect(counts.get("ness")).toBeLessThan(20);
	expect(traffic).toBeGreaterThan(100); expect(traffic).toBeLessThan(250);
});

test("river and road clearance stays fixed in the world as the train moves", () => {
	const river = { ...encounterAt(0, 0), kind: "river", distance: 100 };
	const road = { ...river, kind: "crossing" };
	for (const distance of [60, 90, 110, 150]) {
		const x = trackCenter(100) - trackCenter(distance), z = distance - 100;
		expect(treeOnFeature(x, z, distance, [river])).toBe(true);
		expect(treeOnFeature(x, z + 15, distance, [river])).toBe(false);
		expect(treeOnFeature(x, z, distance, [road])).toBe(true);
		expect(treeOnFeature(x, z + 6, distance, [road])).toBe(false);
	}
});


test("bridge ramps share a smooth world-space elevation with a flat supported deck", () => {
	const river = encounterAt(7, 0);
	expect(river.kind).toBe("river");
	for (const offset of [-13, 0, 13]) expect(railwayHeight(7, river.distance + offset)).toBeCloseTo(BRIDGE_HEIGHT, 8);
	for (const offset of [-44, 44]) expect(railwayHeight(7, river.distance + offset)).toBe(0);
	for (let d = river.distance - 45; d < river.distance + 45; d += 0.2) {
		expect(Math.abs(railwayHeight(7, d + 0.01) - railwayHeight(7, d))).toBeLessThan(0.002);
		expect(Math.abs(railwayPitch(7, d))).toBeLessThan(0.13);
	}
	expect(railwayPitch(7, river.distance - 25)).toBeGreaterThan(0);
	expect(railwayPitch(7, river.distance + 25)).toBeLessThan(0);
});

test("both fork paths are fixed when selection changes", () => {
	const beat = 24, start = (beat + 5) * 6 + 4;
	for (let d = start - 10; d <= start + 240; d++) {
		const left = [{ beat, side: -1 }], right = [{ beat, side: 1 }];
		for (const side of [-1, 1]) expect(fixedBranchCenter(d, left[0], side, left)).toBeCloseTo(fixedBranchCenter(d, right[0], side, right), 8);
		for (const chosen of [left, right]) expect(Math.abs(routeHeading(d, chosen))).toBeLessThan(0.72);
	}
	expect(forkOffset(start, beat)).toBe(0);
	expect(forkOffset(start + 84, beat)).toBe(FORK_OFFSET);
	expect(fixedBranchCenter(start + 240, { beat, side: -1 }, 1, [{ beat, side: -1 }]) - fixedBranchCenter(start + 240, { beat, side: 1 }, -1, [{ beat, side: 1 }])).toBeCloseTo(FORK_OFFSET * 2, 8);
});
test("tree clearance covers both fixed branches without changing on a switch", () => {
	const beat = 24, world = (beat + 5) * 6 + 4 + 90, distance = 165;
	for (const branchSide of [-1, 1]) {
		const branchX = trackCenter(world) + branchSide * forkOffset(world, beat);
		for (const side of [-1, 1]) {
			const junctions = [{ beat, side }], x = branchX - routeCenter(distance, junctions), z = distance - world;
			expect(treeOnFork(x, z, distance, junctions)).toBe(true);
			expect(treeOnFork(x + branchSide * 8, z, distance, junctions)).toBe(false);
		}
	}
});
test("archiving a passed fork preserves the train and future track positions", () => {
	const beat = 24;
	for (const side of [-1, 1]) for (const d of [418, 425, 450, 600]) {
		expect(routeCenter(d, [{ beat, side }])).toBeCloseTo(routeCenter(d, [], side * FORK_OFFSET), 8);
		expect(routeHeading(d, [{ beat, side }])).toBeCloseTo(routeHeading(d, [], side * FORK_OFFSET), 8);
	}
});

test("road clearance follows its fixed scenery anchor after a fork", () => {
	const road = { ...encounterAt(0, 0), kind: "crossing", distance: 100, x: 30, heading: 0.3 };
	expect(treeOnFeature(30, -20, 80, [road])).toBe(true);
	expect(treeOnFeature(30, -14, 80, [road])).toBe(false);
});

test("roadside models clear the whole footprint of either fork independent of selection", () => {
	const beat = 24, start = (beat + 5) * 6 + 4;
	for (let world = start; world < start + 240; world += 6) for (const side of [-1, 1]) {
		const left = [{ beat, side: -1 }], right = [{ beat, side: 1 }];
		const x = roadsideCenter(world, side, left);
		expect(x).toBeCloseTo(roadsideCenter(world, side, right), 8);
		for (let d = world - 7; d <= world + 7; d++) for (const branch of [-1, 1]) {
			const path = fixedBranchCenter(d, left[0], branch, left);
			expect(side * (x - path)).toBeGreaterThanOrEqual(9.999);
		}
	}
});

test("tree clearance follows the continuing track after a fork is archived", () => {
	const distance = 430, world = 480, base = FORK_OFFSET;
	const x = routeCenter(world, [], base) - routeCenter(distance, [], base), z = distance - world;
	expect(treeOnFork(x, z, distance, [], base)).toBe(true);
	expect(treeOnFork(x + 8, z, distance, [], base)).toBe(false);
});
