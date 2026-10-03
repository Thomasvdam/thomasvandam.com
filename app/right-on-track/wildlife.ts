import * as THREE from "three";
import type { Builders } from "./encounters";

export function createBird({ material, sphere, box, batch }: Builders, water = false) {
	const bird = new THREE.Group(); bird.userData.moving = true; bird.userData.birdVoice = water ? "water" : "woodland";
	const feathers = material(water ? "#d6d2bc" : "#5a5144"), beak = material("#c69a4f"), eye = material("#212a29");
	sphere(bird, feathers, [0, 0, 0], water ? [0.36, 0.22, 0.5] : [0.23, 0.17, 0.32]);
	sphere(bird, feathers, [0, 0.2, -0.3], [0.17, 0.18, 0.19]);
	box(bird, beak, [0, 0.18, -0.5], [0.12, 0.06, 0.22]);
	for (const side of [-1, 1]) sphere(bird, eye, [side * 0.13, 0.25, -0.41], [0.026, 0.026, 0.026]);
	for (const side of [-1, 1]) {
		const wing = new THREE.Group(); wing.name = side < 0 ? "wing-left" : "wing-right"; wing.userData.moving = true; bird.add(wing);
		box(wing, feathers, [side * 0.36, 0, 0.07], [0.65, 0.04, 0.28]); batch(wing);
	}
	batch(bird); return bird;
}

export function flapBird(bird: THREE.Object3D, time: number, flying: boolean) {
	for (const [index, name] of ["wing-left", "wing-right"].entries()) {
		const wing = bird.getObjectByName(name);
		if (wing) wing.rotation.z = (index ? 1 : -1) * (flying ? Math.sin(time * 18) * 0.75 : 1.2);
	}
}

export function createTreeDetails(builders: Builders) {
	const { material, sphere, box, cylinder, batch } = builders;
	const brown = material("#896346"), pale = material("#bd9571"), dark = material("#252c28"), twig = material("#70553e"), egg = material("#d8d8bc");
	const squirrel = new THREE.Group(); squirrel.userData.moving = true;
	sphere(squirrel, brown, [0, 0, 0.15], [0.23, 0.4, 0.22]);
	sphere(squirrel, brown, [0, 0.39, 0.08], [0.23, 0.22, 0.22]);
	sphere(squirrel, pale, [0, 0.32, -0.08], [0.13, 0.12, 0.12]);
	for (const side of [-1, 1]) {
		sphere(squirrel, brown, [side * 0.14, 0.62, 0.12], [0.07, 0.13, 0.07]);
		sphere(squirrel, dark, [side * 0.18, 0.41, -0.04], [0.029, 0.029, 0.029]);
		for (const y of [-0.25, 0.2]) sphere(squirrel, pale, [side * 0.2, y, -0.04], [0.07, 0.12, 0.08]);
	}
	sphere(squirrel, brown, [0, -0.24, 0.5], [0.18, 0.4, 0.22]);
	sphere(squirrel, brown, [0, 0.08, 0.7], [0.2, 0.32, 0.22]); batch(squirrel);
	const nest = new THREE.Group(); nest.userData.moving = true;
	cylinder(nest, twig, [-0.5, -0.25, 0], [0.085, 1.65, 0.085], "x");
	cylinder(nest, twig, [0, 0, 0], [0.5, 0.19, 0.5]);
	cylinder(nest, dark, [0, 0.1, 0], [0.35, 0.025, 0.35]);
	for (let i = 0; i < 12; i++) {
		const angle = i * Math.PI / 6;
		const stick = box(nest, twig, [Math.cos(angle) * 0.42, 0.14, Math.sin(angle) * 0.42], [0.5, 0.075, 0.065]); stick.rotation.y = -angle + Math.PI / 2;
	}
	for (const x of [-0.12, 0.12]) sphere(nest, egg, [x, 0.19, 0], [0.09, 0.13, 0.08]);
	const visitor = createBird(builders); visitor.name = "nest-bird"; nest.add(visitor); batch(nest);
	const flock = new THREE.Group(); flock.userData.moving = true;
	const prototype = createBird(builders);
	for (let i = 0; i < 4; i++) { const bird = prototype.clone(); bird.name = `flock-${i}`; bird.position.set((i - 1.5) * 0.8, 0.25, i % 2 * 0.65); flock.add(bird); }
	return { squirrel, nest, flock };
}

export function animateTreeDetail(root: THREE.Object3D, kind: string, seconds: number, ahead: number, reducedMotion: boolean) {
	if (kind === "squirrel") {
		const cycle = seconds * 0.45 + root.userData.treeIndex;
		root.position.y = 2.6 + (reducedMotion ? 0 : Math.sin(cycle) * 1.4);
		root.rotation.z = reducedMotion ? 0 : Math.PI * 0.5 * (1 - Math.tanh(Math.cos(cycle) * 4));
	} else if (kind === "nest") {
		const bird = root.getObjectByName("nest-bird")!;
		bird.visible = root.userData.visitor && ahead < 80;
		const progress = reducedMotion ? 1 : Math.max(0, Math.min(1, (80 - ahead) / 60));
		bird.rotation.y = 1.85 * Math.max(0, Math.min(1, (1 - progress) * 5));
		bird.position.set((1 - progress) * 14, 0.37 + (1 - progress) * 6, (1 - progress) * -4);
		flapBird(bird, seconds, progress < 1);
	} else {
		const age = Math.max(0, ahead < 0 ? -ahead / 10 : 0);
		root.children.forEach((bird, index) => {
			const flight = reducedMotion ? 0 : Math.max(0, age - index * 0.08);
			bird.visible = flight < 5;
			bird.position.set((index - 1.5) * 0.8 + flight * (index % 2 ? 1 : -1), 0.25 + flight * 2.2, index % 2 * 0.65 - flight * 3);
			flapBird(bird, seconds + index, flight > 0);
		});
	}
}
