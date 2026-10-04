import { expect, test } from "bun:test";
import * as THREE from "three";
import { createTerrainMeshes } from "./terrain-mesh.ts";
import { railwayHeight, routeCenter } from "./motion.ts";
import { terrainHeight } from "./terrain.ts";

// Preserve the original per-vertex calculation as the visual regression oracle.
function originalTerrain(seed, distance, junctions, base) {
	const geometries = [new THREE.PlaneGeometry(600, 600, 60, 120), new THREE.PlaneGeometry(5.8, 270, 1, 90), new THREE.PlaneGeometry(16, 270, 8, 90)];
	const position = z => routeCenter(distance - z, junctions, base) - routeCenter(distance, junctions, base);
	for (const [kind, geometry] of geometries.entries()) {
		const vertices = geometry.getAttribute("position");
		for (let i = 0; i < vertices.count; i++) {
			const x = vertices.getX(i), z = -vertices.getY(i) - (kind === 0 ? 100 : 95);
			const ground = terrainHeight(seed, distance - z), rail = railwayHeight(seed, distance - z);
			if (kind !== 0) vertices.setX(i, x + position(z));
			vertices.setZ(i, kind === 0 ? ground : kind === 1 ? rail : ground + (rail - ground) * Math.max(0, Math.min(1, (8 - Math.abs(x)) / 5)) - 0.02);
		}
		geometry.computeVertexNormals();
	}
	return geometries;
}

test("terrain row updates preserve every original vertex and lighting normal", () => {
	const scene = new THREE.Scene(), material = new THREE.MeshStandardMaterial();
	const terrain = createTerrainMeshes(scene, material, material);
	try {
		for (const [seed, distance, junctions, base] of [
			[12, 0, [], 0], [12, 230.125, [{ beat: 24, side: -1 }], 0],
			[12, 230.125, [{ beat: 24, side: 1 }], 0], [4, 1740.25, [{ beat: 280, side: 1 }], -9],
		]) {
			terrain.update(seed, distance, junctions, base);
			const original = originalTerrain(seed, distance, junctions, base);
			try {
				for (const [i, geometry] of terrain.geometries.entries()) {
					expect(geometry.getAttribute("position").array).toEqual(original[i].getAttribute("position").array);
					expect(geometry.getAttribute("normal").array).toEqual(original[i].getAttribute("normal").array);
				}
			} finally { original.forEach(geometry => geometry.dispose()); }
		}
	} finally { terrain.geometries.forEach(geometry => geometry.dispose()); material.dispose(); }
});

test("stationary terrain skips uploads but refreshes for route, seed and distance changes", () => {
	const scene = new THREE.Scene(), material = new THREE.MeshStandardMaterial();
	const terrain = createTerrainMeshes(scene, material, material);
	const junctions = [{ beat: 24, side: -1 }];
	const versions = () => terrain.geometries.map(geometry => geometry.getAttribute("position").version);
	try {
		terrain.update(12, 230, junctions, 0);
		const initial = versions();
		terrain.update(12, 230, [{ ...junctions[0] }], 0);
		expect(versions()).toEqual(initial);
		junctions[0].side = 1;
		terrain.update(12, 230, junctions, 0);
		expect(versions()).toEqual(initial.map(version => version + 1));
		terrain.update(12, 230, junctions, 9);
		terrain.update(4, 230, junctions, 9);
		terrain.update(4, 231, junctions, 9);
		terrain.update(4, 231, [], 9);
		expect(versions()).toEqual(initial.map(version => version + 5));
	} finally { terrain.geometries.forEach(geometry => geometry.dispose()); material.dispose(); }
});
