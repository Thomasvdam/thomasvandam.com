import * as THREE from "three";
import type { Builders } from "./encounters";

export function cropVariant(detail: number) { return detail % 3; }
export function farmMachine(detail: number) { return Math.floor(detail / 3) % 3; }
export function pastureVariant(detail: number) { return detail % 3; }

export function createFarmland({ material, box, cylinder, sphere, batch }: Builders) {
	const soil = material("#68533c"), grass = material("#829461"), straw = material("#c7ad62"), leaf = material("#749147"), stalk = material("#8c9851");
	const tire = material("#292e2b"), metal = material("#b5b9ae", 0.5), glass = material("#415863"), green = material("#627f48"), red = material("#a65c44");
	const fence = material("#a3997d"), cream = material("#e2d7bc"), brown = material("#80614c"), black = material("#3f423b");
	const crops = new THREE.Group(), cattle = new THREE.Group();
	box(crops, soil, [0, 0.035, 0], [22, 0.06, 28]);
	for (let variant = 0; variant < 3; variant++) {
		const plants = new THREE.Group(); plants.name = `crop-${variant}`; plants.userData.moving = true; crops.add(plants);
		for (let row = 0; row < 10; row++) {
			box(plants, soil, [-9 + row * 2, 0.12, 0], [0.6, 0.12, 26]);
			for (let plant = 0; plant < 14; plant++) {
				const x = -9 + row * 2, z = -12 + plant * 1.8;
				if (variant === 2) {
					sphere(plants, leaf, [x, 0.34, z], [0.58, 0.3, 0.48]);
					sphere(plants, cream, [x, 0.48, z], [0.25, 0.2, 0.25]);
				} else {
					cylinder(plants, variant === 0 ? straw : stalk, [x, variant === 0 ? 0.6 : 1.1, z], [0.045, variant === 0 ? 1 : 2, 0.045]);
					if (variant === 0) {
						sphere(plants, straw, [x, 1.1, z], [0.16, 0.3, 0.12]);
					} else {
						for (const side of [-1, 1]) {
							const blade = box(plants, leaf, [x + side * 0.25, 1.1, z], [0.7, 0.09, 0.22]); blade.rotation.z = side * 0.4;
						}
						sphere(plants, straw, [x + 0.12, 1.45, z], [0.12, 0.32, 0.12]);
					}
				}
			}
		}
		batch(plants);
	}
	for (const combine of [false, true]) {
		const vehicle = new THREE.Group(); vehicle.name = combine ? "combine" : "tractor"; vehicle.userData.moving = true; crops.add(vehicle);
		vehicle.position.set(3, 0, -1); const paint = combine ? straw : green;
		box(vehicle, paint, [0, 1.5, 0.2], [combine ? 3.4 : 1.7, combine ? 2.1 : 0.8, combine ? 4.2 : 2.7]);
		box(vehicle, glass, [0, 2.65, -0.8], [1.6, 1.5, 1.6]); box(vehicle, paint, [0, 3.45, -0.8], [1.85, 0.18, 1.9]);
		for (const side of [-1, 1]) for (const z of [-1.4, 1.5]) {
			cylinder(vehicle, tire, [side * (combine ? 1.75 : 1.05), z > 0 ? 0.9 : 0.65, z], [z > 0 ? 0.9 : 0.65, 0.55, z > 0 ? 0.9 : 0.65], "x");
			cylinder(vehicle, metal, [side * (combine ? 2.04 : 1.34), z > 0 ? 0.9 : 0.65, z], [0.35, 0.03, 0.35], "x");
		}
		cylinder(vehicle, black, [0.65, 2.2, 0.9], [0.07, 1.6, 0.07]);
		if (combine) {
			box(vehicle, red, [0, 0.55, -3.1], [6, 0.3, 1.3]);
			cylinder(vehicle, metal, [0, 1, -3.1], [0.4, 5.8, 0.4], "x");
			for (let i = 0; i < 12; i++) box(vehicle, black, [-2.75 + i * 0.5, 0.35, -3.8], [0.08, 0.12, 0.7]);
			cylinder(vehicle, paint, [2.7, 3, 1], [0.16, 3, 0.16], "x");
		}
		batch(vehicle);
	}
	box(cattle, grass, [0, 0.04, 0], [22, 0.07, 28]);
	for (const side of [-1, 1]) {
		for (let i = 0; i < 8; i++) cylinder(cattle, fence, [side * 11, 0.65, -14 + i * 4], [0.1, 1.3, 0.1]);
		for (const y of [0.45, 0.95]) box(cattle, fence, [side * 11, y, 0], [0.09, 0.1, 28]);
		for (let i = 0; i < 7; i++) cylinder(cattle, fence, [-11 + i * 22 / 6, 0.65, side * 14], [0.1, 1.3, 0.1]);
		for (const y of [0.45, 0.95]) box(cattle, fence, [0, y, side * 14], [22, 0.1, 0.09]);
	}
	for (let variant = 0; variant < 3; variant++) {
		const herd = new THREE.Group(); herd.name = `herd-${variant}`; herd.userData.moving = true; cattle.add(herd);
		for (let i = 0; i < 6; i++) {
			const animal = new THREE.Group(); animal.position.set(-6 + i % 3 * 5, 0, -6 + Math.floor(i / 3) * 11); animal.rotation.y = i * 1.7;
			herd.add(animal); const fur = variant === 1 ? brown : cream, sheep = variant === 2;
			sphere(animal, fur, [0, sheep ? 0.8 : 1.15, 0], [sheep ? 0.7 : 0.85, sheep ? 0.55 : 0.7, sheep ? 1 : 1.5]);
			if (variant === 0) for (let patch = 0; patch < 3; patch++) sphere(animal, black, [patch % 2 ? -0.73 : 0.73, 1.35, -0.8 + patch * 0.7], [0.2, 0.35, 0.4]);
			for (const x of [-0.5, 0.5]) for (const z of [-0.75, 0.75]) cylinder(animal, sheep ? black : fur, [x, 0.4, z], [0.12, 0.8, 0.12]);
			sphere(animal, sheep ? black : fur, [0, sheep ? 0.55 : 0.9, sheep ? -1 : -1.55], [0.36, 0.43, 0.55]);
			for (const side of [-1, 1]) sphere(animal, fur, [side * 0.38, sheep ? 0.8 : 1.15, sheep ? -1 : -1.45], [0.25, 0.1, 0.12]);
			if (!sheep) for (const side of [-1, 1]) cylinder(animal, cream, [side * 0.25, 1.35, -1.4], [0.055, 0.35, 0.055]);
		}
		batch(herd);
	}
	batch(crops); batch(cattle); return { crops, cattle };
}
export function animateFarmland(models: ReturnType<typeof createFarmland>, detail: number, seconds: number, reducedMotion: boolean) {
	for (let i = 0; i < 3; i++) {
		models.crops.getObjectByName(`crop-${i}`)!.visible = i === cropVariant(detail);
		models.cattle.getObjectByName(`herd-${i}`)!.visible = i === pastureVariant(detail);
	}
	const tractor = models.crops.getObjectByName("tractor")!, combine = models.crops.getObjectByName("combine")!;
	tractor.visible = farmMachine(detail) === 1; combine.visible = farmMachine(detail) === 2;
	for (const vehicle of [tractor, combine]) vehicle.position.z = reducedMotion ? -1 : -1 + Math.sin(seconds * 0.09 + detail % 11) * 5;
}
