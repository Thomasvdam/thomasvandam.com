import * as THREE from "three";
import { railwayHeight, routeCenter, type Junction } from "./motion";
import { terrainHeight } from "./terrain";

export function createTerrainMeshes(scene: THREE.Scene, groundMaterial: THREE.Material, ballastMaterial: THREE.Material) {
	const groundGeometry = new THREE.PlaneGeometry(600, 600, 60, 120);
	const ground = new THREE.Mesh(groundGeometry, groundMaterial); ground.rotation.x = -Math.PI / 2;
	ground.name = "rolling-ground";
	ground.position.z = -100; ground.receiveShadow = true; ground.frustumCulled = false; scene.add(ground);
	const groundVertices = groundGeometry.getAttribute("position"), groundOriginal = new Float32Array(groundVertices.array);
	const ballastGeometry = new THREE.PlaneGeometry(5.8, 270, 1, 90);
	const ballast = new THREE.Mesh(ballastGeometry, ballastMaterial); ballast.rotation.x = -Math.PI / 2;
	ballast.position.set(0, 0.09, -95); ballast.receiveShadow = true; ballast.frustumCulled = false; scene.add(ballast);
	const ballastVertices = ballastGeometry.getAttribute("position"), ballastOriginal = new Float32Array(ballastVertices.array);
	const rampGeometry = new THREE.PlaneGeometry(16, 270, 8, 90);
	const ramp = new THREE.Mesh(rampGeometry, groundMaterial); ramp.rotation.x = -Math.PI / 2;
	ramp.position.set(0, 0, -95); ramp.receiveShadow = true; ramp.frustumCulled = false; scene.add(ramp);
	const rampVertices = rampGeometry.getAttribute("position"), rampOriginal = new Float32Array(rampVertices.array);
	let previousSeed: number | undefined, previousDistance: number | undefined, previousBase: number | undefined;
	let previousJunctions: Junction[] = [];

	function update(seed: number, distance: number, junctions: Junction[], base: number, heightAt = (d: number) => terrainHeight(seed, d)) {
		if (seed === previousSeed && distance === previousDistance && base === previousBase && junctions.length === previousJunctions.length
			&& junctions.every((junction, i) => junction.beat === previousJunctions[i].beat && junction.side === previousJunctions[i].side)) return;
		previousSeed = seed; previousDistance = distance; previousBase = base;
		previousJunctions = junctions.map(junction => ({ ...junction }));
		const origin = routeCenter(distance, junctions, base);
		const position = (z: number) => routeCenter(distance - z, junctions, base) - origin;
		// Each cross-section shares a height and route offset. Calculate once per row.
		for (let row = 0; row <= 120; row++) {
			const first = row * 61, z = -groundOriginal[first * 3 + 1] - 100;
			const height = heightAt(distance - z);
			for (let col = 0; col < 61; col++) groundVertices.setZ(first + col, height);
		}
		groundVertices.needsUpdate = true; groundGeometry.computeVertexNormals();
		for (let row = 0; row <= 90; row++) {
			const first = row * 2, z = -ballastOriginal[first * 3 + 1] - 95;
			const offset = position(z), height = railwayHeight(seed, distance - z);
			for (let col = 0; col < 2; col++) {
				ballastVertices.setX(first + col, ballastOriginal[(first + col) * 3] + offset);
				ballastVertices.setZ(first + col, height);
			}
		}
		ballastVertices.needsUpdate = true; ballastGeometry.computeVertexNormals();
		for (let row = 0; row <= 90; row++) {
			const first = row * 9, z = -rampOriginal[first * 3 + 1] - 95;
			const offset = position(z), height = railwayHeight(seed, distance - z), groundHeight = heightAt(distance - z);
			for (let col = 0; col < 9; col++) {
				const index = first + col, x = rampOriginal[index * 3];
				rampVertices.setX(index, x + offset);
				rampVertices.setZ(index, groundHeight + (height - groundHeight) * Math.max(0, Math.min(1, (8 - Math.abs(x)) / 5)) - 0.02);
			}
		}
		rampVertices.needsUpdate = true; rampGeometry.computeVertexNormals();
	}
	return { geometries: [groundGeometry, ballastGeometry, rampGeometry], update };
}
