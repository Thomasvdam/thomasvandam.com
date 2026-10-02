import { expect, test } from "bun:test";
import * as THREE from "three";
import { configureRailwayShadows } from "./shadows.ts";

test("shadow caster volume includes tall scenery around the entire visible railway", () => {
	const sun = new THREE.DirectionalLight(); configureRailwayShadows(sun);
	sun.updateMatrixWorld(); sun.target.updateMatrixWorld(); sun.shadow.updateMatrices(sun);
	const matrix = new THREE.Matrix4().multiplyMatrices(sun.shadow.camera.projectionMatrix, sun.shadow.camera.matrixWorldInverse);
	const frustum = new THREE.Frustum().setFromProjectionMatrix(matrix);
	for (const x of [-75, 0, 75]) for (const z of [-200, -95, 0, 60]) for (const y of [0, 12, 24]) {
		expect(frustum.containsPoint(new THREE.Vector3(x, y, z))).toBe(true);
	}
});
