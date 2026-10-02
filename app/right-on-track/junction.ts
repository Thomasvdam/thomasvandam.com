import * as THREE from "three";
import type { Builders } from "./encounters";

export function createSignal({ material, box, cylinder, sphere, cone, batch }: Builders) {
	const root = new THREE.Group(), iron = material("#394844"), cream = material("#ddd7b4"), green = material("#96bd8c");
	green.emissive.set("#608f49"); green.emissiveIntensity = 0.8;
	// A lever between the rails and a large directional signal beside them.
	box(root, iron, [0, 0.24, 0], [0.6, 0.25, 2]);
	cylinder(root, iron, [3.1, 1.9, 0], [0.13, 3.8, 0.13]);
	box(root, iron, [3.1, 3.7, 0], [2.5, 1.15, 0.25]);
	for (const side of [-1, 1]) {
		const arrow = new THREE.Group(); arrow.name = side < 0 ? "left" : "right"; arrow.userData.moving = true; root.add(arrow);
		box(arrow, cream, [3.1, 3.7, 0.18], [1.25, 0.17, 0.12]);
		const tip = cone(arrow, cream, [3.1 + side * 0.75, 3.7, 0.18], [0.4, 0.5, 0.09]); tip.rotation.z = -side * Math.PI / 2;
		const lever = box(arrow, iron, [side * 0.35, 0.65, 0], [0.12, 0.9, 0.12]); lever.rotation.z = -side * 0.4;
		sphere(arrow, green, [side * 0.52, 1.08, 0], [0.2, 0.2, 0.2]); batch(arrow);
	}
	batch(root); return root;
}
