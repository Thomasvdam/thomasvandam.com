import * as THREE from "three";
import type { EncounterKind } from "./motion";

type Shape = (parent: THREE.Object3D, surface: THREE.Material, position: number[], scale: number[]) => THREE.Mesh;
type Builders = {
	material: (color: string, metalness?: number, roughness?: number) => THREE.MeshStandardMaterial;
	box: Shape; sphere: Shape;
	cylinder: (parent: THREE.Object3D, surface: THREE.Material, position: number[], scale: number[], axis?: "x" | "z" | "y") => THREE.Mesh;
	batch: (parent: THREE.Object3D) => void;
};

export function createEncounterModels({ material, box, sphere, cylinder, batch }: Builders) {
	const timber = material("#806348"), roof = material("#474e4b"), dark = material("#242c2d"), cream = material("#e0d8bc");
	const skin = material("#c99c77"), plaid = material("#9e4b38"), denim = material("#374d62"), cutWood = material("#cda56c");
	const silver = material("#a6acab", 0.6, 0.4), road = material("#5e625c"), white = material("#e7e6da");
	const models = {} as Record<EncounterKind, THREE.Group>;
	const hut = new THREE.Group(); models.hut = hut;
	box(hut, timber, [0, 1.45, 0], [4.4, 2.9, 3.8]);
	for (const side of [-1, 1]) {
		const slope = box(hut, roof, [side * 1.25, 3.5, 0], [2.9, 0.18, 4.5]); slope.rotation.z = side * -0.46;
		box(hut, cream, [side * 1.2, 1.7, -1.92], [0.85, 0.85, 0.07]);
		box(hut, dark, [side * 1.2, 1.7, -1.97], [0.68, 0.68, 0.04]);
		box(hut, timber, [side * 1.2, 1.7, -2], [0.05, 0.7, 0.04]);
	}
	box(hut, dark, [0, 1.05, -1.94], [0.8, 2.1, 0.08]);
	sphere(hut, silver, [0.24, 1.1, -2.01], [0.06, 0.06, 0.05]);
	box(hut, roof, [1, 3.8, 0.8], [0.45, 1.8, 0.5]);
	for (let i = 0; i < 6; i++) box(hut, cream, [0, 0.3 + i * 0.43, -1.92], [4.5, 0.035, 0.035]);

	const lumberjack = new THREE.Group(); models.lumberjack = lumberjack;
	cylinder(lumberjack, timber, [-1.4, 0.35, 0], [0.75, 0.7, 0.75]);
	cylinder(lumberjack, cutWood, [-1.4, 0.72, 0], [0.7, 0.035, 0.7]);
	const trunk = cylinder(lumberjack, timber, [-2, 0.42, 2.8], [0.43, 5.5, 0.43], "z"); trunk.rotation.y = 0.35;
	cylinder(lumberjack, cutWood, [-2.95, 0.42, 0.19], [0.4, 0.035, 0.4], "z");
	for (const side of [-1, 1]) {
		cylinder(lumberjack, denim, [side * 0.22, 0.52, 0], [0.19, 0.95, 0.19]);
		box(lumberjack, dark, [side * 0.22, 0.12, -0.14], [0.4, 0.22, 0.65]);
		cylinder(lumberjack, plaid, [side * 0.5, 1.3, -0.03], [0.18, 0.85, 0.18]);
		sphere(lumberjack, skin, [side * 0.5, 0.86, -0.03], [0.18, 0.2, 0.18]);
	}
	box(lumberjack, plaid, [0, 1.35, 0], [0.78, 0.95, 0.48]);
	for (let i = 0; i < 4; i++) box(lumberjack, dark, [-0.3 + i * 0.2, 1.35, -0.25], [0.045, 0.92, 0.015]);
	sphere(lumberjack, skin, [0, 2.1, 0], [0.3, 0.34, 0.28]);
	sphere(lumberjack, timber, [0, 1.94, -0.22], [0.25, 0.22, 0.13]);
	box(lumberjack, plaid, [0, 2.39, 0], [0.64, 0.17, 0.62]);
	const axe = cylinder(lumberjack, timber, [-1.15, 1.2, 0], [0.055, 1.1, 0.055]); axe.rotation.z = -0.25;
	box(lumberjack, silver, [-1.32, 1.7, 0], [0.45, 0.28, 0.07]);

	const crossing = new THREE.Group(); models.crossing = crossing;
	box(crossing, road, [0, 0.075, 0], [54, 0.08, 4.2]);
	for (const side of [-1, 1]) {
		box(crossing, cream, [side * 14, 0.12, -1.8], [24, 0.02, 0.08]);
		box(crossing, cream, [side * 14, 0.12, 1.8], [24, 0.02, 0.08]);
		cylinder(crossing, silver, [side * 4.2, 1.6, -2.4], [0.11, 3.2, 0.11]);
		for (const angle of [-0.55, 0.55]) {
			const sign = box(crossing, white, [side * 4.2, 2.9, -2.4], [1.7, 0.19, 0.12]); sign.rotation.z = angle;
		}
		box(crossing, dark, [side * 4.2, 2, -2.4], [0.8, 0.4, 0.2]);
		for (const x of [-0.22, 0.22]) sphere(crossing, plaid, [side * 4.2 + x, 2, -2.54], [0.13, 0.13, 0.06]);
		box(crossing, white, [side * 7, 0.85, 0], [0.14, 0.14, 4.2]);
		for (let z = -1.8; z < 2; z += 0.6) box(crossing, plaid, [side * 7, 0.85, z], [0.15, 0.15, 0.25]);
	}
	for (let i = 0; i < 3; i++) {
		const car = new THREE.Group(); car.name = `waiting-car-${i}`; car.userData.moving = true; crossing.add(car);
		car.position.set(10 + i * 5, 0, i % 2 ? -0.9 : 0.9);
		const paint = material(["#8b5340", "#48657c", "#b9a364"][i]);
		box(car, paint, [0, 0.72, 0], [3.5, 0.7, 1.5]);
		box(car, dark, [0.1, 1.22, 0], [1.8, 0.65, 1.35]);
		box(car, paint, [0.1, 1.58, 0], [1.9, 0.1, 1.4]);
		for (const x of [-1.1, 1.1]) for (const z of [-0.76, 0.76]) cylinder(car, dark, [x, 0.4, z], [0.36, 0.17, 0.36], "z");
		for (const z of [-0.5, 0.5]) box(car, cream, [-1.78, 0.8, z], [0.05, 0.18, 0.25]);
		batch(car);
	}

	const bears = new THREE.Group(); models.bears = bears;
	cylinder(bears, timber, [0, 0.03, 0], [1.5, 0.06, 1.5]);
	cylinder(bears, dark, [0, 0.07, 0], [1.22, 0.04, 1.22]);
	for (const side of [-1, 1]) {
		const bear = new THREE.Group(); bear.position.set(side * 2.2, 0, 0); bear.rotation.y = side * Math.PI / 2; bears.add(bear);
		sphere(bear, white, [0, 0.95, 0], [0.7, 0.95, 0.65]);
		sphere(bear, white, [0, 1.95, -0.2], [0.52, 0.48, 0.5]);
		sphere(bear, cream, [0, 1.83, -0.67], [0.31, 0.2, 0.3]);
		sphere(bear, dark, [0, 1.9, -0.93], [0.1, 0.08, 0.065]);
		for (const x of [-1, 1]) {
			sphere(bear, white, [x * 0.38, 2.33, -0.1], [0.14, 0.16, 0.13]);
			sphere(bear, dark, [x * 0.23, 2.02, -0.65], [0.04, 0.04, 0.025]);
			sphere(bear, white, [x * 0.55, 0.82, -0.38], [0.23, 0.6, 0.23]);
			sphere(bear, white, [x * 0.46, 0.22, -0.55], [0.28, 0.23, 0.43]);
		}
	}
	for (const model of Object.values(models)) batch(model);
	return models;
}
