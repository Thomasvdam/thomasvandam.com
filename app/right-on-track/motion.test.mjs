import * as THREE from "three";
import { newRun } from "./rhythm.ts";
import { expect, test } from "bun:test";
import { beatForSlot, landscapeBands, landscapeBlend, PLACEMENT_Z, sceneryOffsets, surfaceOffset, TRACK_LENGTH } from "./motion.ts";

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
